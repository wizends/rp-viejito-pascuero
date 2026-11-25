package api

import (
	"bufio"
	"crypto/subtle"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Endpoints que crean la sesión: aún no existe cookie CSRF.
var csrfExempt = map[string]bool{
	"/api/auth/login":    true,
	"/api/auth/register": true,
	"/api/auth/refresh":  true,
}

func safeMethod(m string) bool {
	return m == http.MethodGet || m == http.MethodHead || m == http.MethodOptions
}

// middleware aplica, de afuera hacia adentro: recuperación, cabeceras, CORS,
// límite por IP y verificación CSRF (double-submit).
func (s *Server) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: 200}
		defer func() {
			if p := recover(); p != nil {
				slog.Error("pánico en el taller", "err", p, "path", r.URL.Path)
				writeJSON(rec, http.StatusInternalServerError, map[string]string{"detail": "Algo se enredó en el taller."})
			}
			if r.URL.Path != "/api/health" {
				slog.Info("http", "method", r.Method, "path", r.URL.Path, "status", rec.status, "ms", time.Since(start).Milliseconds())
			}
		}()

		h := rec.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		h.Set("Cross-Origin-Opener-Policy", "same-origin")
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		if s.cfg.IsProduction() {
			h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
		}

		// CORS: solo para orígenes permitidos (en Docker y Vercel todo es mismo origen).
		if origin := r.Header.Get("Origin"); origin != "" && slices.Contains(s.cfg.CORSOrigins, origin) {
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Credentials", "true")
			h.Add("Vary", "Origin")
			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE")
				h.Set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token")
				h.Set("Access-Control-Max-Age", "600")
				rec.WriteHeader(http.StatusOK)
				return
			}
		}

		path := r.URL.Path
		if strings.HasPrefix(path, "/api") && path != "/api/health" {
			if err := s.limiter.check("ip:"+s.clientIP(r), s.cfg.RateIP); err != nil {
				s.tooMany(rec, err)
				return
			}
			if !safeMethod(r.Method) && !csrfExempt[path] {
				c, _ := r.Cookie(csrfCookie)
				header := r.Header.Get("X-CSRF-Token")
				if c == nil || c.Value == "" || subtle.ConstantTimeCompare([]byte(c.Value), []byte(header)) != 1 {
					writeJSON(rec, http.StatusForbidden, map[string]string{"detail": "Token CSRF inválido."})
					return
				}
			}
		}
		next.ServeHTTP(rec, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// Unwrap permite que el WebSocket tome la conexión (http.ResponseController).
func (r *statusRecorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

// Hijack entrega la conexión al WebSocket.
func (r *statusRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hj, ok := r.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("la conexión no se puede tomar")
	}
	r.status = http.StatusSwitchingProtocols
	return hj.Hijack()
}

// clientIP usa X-Forwarded-For solo si TRUST_FORWARDED_FOR (detrás de un proxy propio).
func (s *Server) clientIP(r *http.Request) string {
	if s.cfg.TrustForwardedFor {
		if fwd := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0]); fwd != "" {
			return fwd
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (s *Server) tooMany(w http.ResponseWriter, _ error) {
	w.Header().Set("Retry-After", strconv.Itoa(int(s.cfg.RateWindow.Seconds())))
	writeJSON(w, http.StatusTooManyRequests, map[string]string{"detail": "Los duendes necesitan un respiro. Intenta de nuevo en un ratito."})
}

// ---------- límite de ventana fija en memoria ----------

type limiter struct {
	mu     sync.Mutex
	window time.Duration
	hits   map[string]*bucket
	now    func() time.Time
}

type bucket struct {
	count int
	reset time.Time
}

func newLimiter(window time.Duration, now func() time.Time) *limiter {
	return &limiter{window: window, hits: map[string]*bucket{}, now: now}
}

type limitErr struct{}

func (limitErr) Error() string { return "límite" }

func (l *limiter) check(key string, limit int) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if len(l.hits) > 50_000 { // limpieza ocasional
		for k, b := range l.hits {
			if now.After(b.reset) {
				delete(l.hits, k)
			}
		}
	}
	b := l.hits[key]
	if b == nil || !now.Before(b.reset) {
		b = &bucket{reset: now.Add(l.window)}
		l.hits[key] = b
	}
	b.count++
	if b.count > limit {
		return limitErr{}
	}
	return nil
}

func (l *limiter) reset() {
	l.mu.Lock()
	l.hits = map[string]*bucket{}
	l.mu.Unlock()
}
