// Package api expone la API HTTP y los WebSockets del buzón.
package api

import (
	"context"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/wizends/rp-viejito-pascuero/backend/internal/config"
	"github.com/wizends/rp-viejito-pascuero/backend/internal/hub"
	"github.com/wizends/rp-viejito-pascuero/backend/internal/security"
	"github.com/wizends/rp-viejito-pascuero/backend/internal/store"
	"github.com/wizends/rp-viejito-pascuero/backend/internal/vision"
)

// Server reúne configuración, datos, eventos y la cola de cartas.
type Server struct {
	cfg     *config.Config
	store   *store.Store
	hub     *hub.Hub
	vision  vision.Reader
	limiter *limiter
	now     func() time.Time
	loc     *time.Location

	// cola de cartas por procesar (lectura opcional con IA)
	jobs   chan string
	inline bool
	wg     sync.WaitGroup

	dummyHash string
}

// Options permite inyectar dependencias en las pruebas.
type Options struct {
	Vision vision.Reader
	// Hub permite inyectar el reparto de eventos (pruebas con Redis).
	Hub *hub.Hub
	// Inline procesa cada carta antes de responder (pruebas).
	Inline bool
	Now    func() time.Time
}

func New(cfg *config.Config, st *store.Store, opt Options) *Server {
	now := opt.Now
	if now == nil {
		now = time.Now
	}
	loc, err := time.LoadLocation(cfg.Timezone)
	if err != nil {
		slog.Warn("zona horaria desconocida, se usa UTC", "tz", cfg.Timezone)
		loc = time.UTC
	}
	reader := opt.Vision
	if reader == nil {
		reader = vision.New(vision.Config{
			Provider: cfg.VisionProvider, Timeout: cfg.VisionTimeout,
			GeminiKey: cfg.GeminiAPIKey, GeminiModel: cfg.GeminiModel,
			GroqKey: cfg.GroqAPIKey, GroqModel: cfg.GroqModel,
			OpenRouterKey: cfg.OpenRouterAPIKey, OpenRouterModel: cfg.OpenRouterModel,
		})
	}
	h := opt.Hub
	if h == nil {
		h = hub.New()
		if cfg.RedisURL != "" {
			if rh, err := hub.NewRedis(cfg.RedisURL); err == nil {
				h = rh
			} else {
				slog.Error("REDIS_URL inválida; eventos solo en memoria", "err", err)
			}
		}
	}
	// hash de relleno para igualar el tiempo de respuesta cuando el email no existe
	dummy, _ := security.HashPassword("duende-de-relleno-123")
	return &Server{
		cfg: cfg, store: st, hub: h, vision: reader,
		limiter: newLimiter(cfg.RateWindow, now), now: now, loc: loc,
		jobs: make(chan string, 512), inline: opt.Inline, dummyHash: dummy,
	}
}

// Hub expone el hub (pruebas).
func (s *Server) Hub() *hub.Hub { return s.hub }

// Handler arma las rutas con el middleware de seguridad.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"estado": "jo jo jo"})
	})

	// sesión
	mux.HandleFunc("POST /api/auth/register", s.register)
	mux.HandleFunc("POST /api/auth/login", s.login)
	mux.HandleFunc("POST /api/auth/refresh", s.refresh)
	mux.HandleFunc("POST /api/auth/logout", s.logout)
	mux.HandleFunc("GET /api/auth/me", s.authed(s.me))
	mux.HandleFunc("PATCH /api/auth/me", s.authed(s.updateMe))

	// niños
	mux.HandleFunc("GET /api/children", s.authed(s.listChildren))
	mux.HandleFunc("POST /api/children", s.authed(s.createChild))
	mux.HandleFunc("PATCH /api/children/{id}", s.authed(s.updateChild))
	mux.HandleFunc("DELETE /api/children/{id}", s.authed(s.deleteChild))

	// cartas
	mux.HandleFunc("GET /api/letters", s.authed(s.listLetters))
	mux.HandleFunc("POST /api/letters", s.authed(s.writeLetter))
	mux.HandleFunc("POST /api/letters/upload", s.authed(s.uploadLetter))
	mux.HandleFunc("GET /api/letters/{id}", s.authed(s.getLetter))
	mux.HandleFunc("GET /api/letters/{id}/image", s.authed(s.letterImage))
	mux.HandleFunc("PATCH /api/letters/{id}", s.authed(s.updateLetter))
	mux.HandleFunc("DELETE /api/letters/{id}", s.authed(s.deleteLetter))
	mux.HandleFunc("GET /api/letters/{id}/postcard", s.authed(s.getPostcard))
	mux.HandleFunc("PUT /api/letters/{id}/postcard", s.authed(s.putPostcard))

	// trayecto del regalo
	mux.HandleFunc("GET /api/children/{id}/shipment", s.authed(s.getShipment))
	mux.HandleFunc("PATCH /api/shipments/{id}", s.authed(s.updateShipment))
	mux.HandleFunc("POST /api/shipments/{id}/stops", s.authed(s.addStop))
	mux.HandleFunc("POST /api/shipments/{id}/stops/templates", s.authed(s.addTemplates))
	mux.HandleFunc("PUT /api/shipments/{id}/stops/order", s.authed(s.reorderStops))
	mux.HandleFunc("PATCH /api/stops/{id}", s.authed(s.updateStop))
	mux.HandleFunc("DELETE /api/stops/{id}", s.authed(s.deleteStop))
	mux.HandleFunc("PUT /api/shipments/{id}/tree", s.authed(s.putTreePhoto))
	mux.HandleFunc("GET /api/shipments/{id}/tree", s.authed(s.getTreePhoto))
	mux.HandleFunc("DELETE /api/shipments/{id}/tree", s.authed(s.deleteTreePhoto))
	mux.HandleFunc("GET /api/tracking/{code}", s.publicTracking)
	mux.HandleFunc("GET /api/tracking/{code}/selfie", s.publicSelfie)
	mux.HandleFunc("GET /api/cron/tick", s.cronTick)

	// tiempo real
	mux.HandleFunc("GET /ws/letters", s.wsLetters)
	mux.HandleFunc("GET /ws/tracking/{code}", s.wsTracking)

	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, _ *http.Request) {
		// quien abre la URL del backend ve que está vivo y dónde está la API
		writeJSON(w, http.StatusOK, map[string]string{"estado": "jo jo jo", "api": "/api", "salud": "/api/health"})
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusNotFound, map[string]string{"detail": "Not Found"})
	})
	return s.middleware(mux)
}

// Start lanza los trabajos de fondo: cola de cartas, auto-avance y retención.
// En modo serverless (Vercel) no hay nada corriendo entre visitas: las cartas se
// procesan al recibirlas, las paradas avanzan al consultarse y un cron diario limpia.
func (s *Server) Start(ctx context.Context) {
	if s.cfg.Serverless {
		return
	}
	for i := 0; i < 2; i++ {
		s.wg.Add(1)
		go func() {
			defer s.wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case id := <-s.jobs:
					s.processLetter(ctx, id)
				}
			}
		}()
	}
	// cartas que quedaron a medias antes de un reinicio
	if ids, err := s.store.PendingLetters(ctx); err == nil {
		for _, id := range ids {
			s.enqueue(id)
		}
	}
	s.every(ctx, s.cfg.AutoAdvanceInterval, func() { s.advanceDueStops(ctx) })
	s.every(ctx, 6*time.Hour, func() { s.purgeExpiredImages(ctx) })
}

// Wait espera a que terminen los trabajos de fondo (tras cancelar el contexto).
func (s *Server) Wait() { s.wg.Wait() }

func (s *Server) every(ctx context.Context, d time.Duration, fn func()) {
	if d <= 0 {
		return
	}
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		fn()
		t := time.NewTicker(d)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				fn()
			}
		}
	}()
}

func (s *Server) enqueue(id string) {
	if s.inline || s.cfg.Serverless {
		s.processLetter(context.Background(), id)
		return
	}
	select {
	case s.jobs <- id:
	default:
		// cola llena: se procesa aparte para no perder la carta
		go s.processLetter(context.Background(), id)
	}
}
