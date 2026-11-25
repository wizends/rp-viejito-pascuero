package api

import (
	"context"
	"net/http"
	"slices"
	"time"

	"github.com/coder/websocket"

	"github.com/wizends/rp-viejito-pascuero/backend/internal/security"
)

// wsConn adapta una conexión al hub con una cola de salida no bloqueante.
type wsConn struct {
	out chan []byte
}

func (c *wsConn) Send(p []byte) bool {
	select {
	case c.out <- p:
		return true
	default:
		return false // cliente lento: se le desuscribe
	}
}

func (s *Server) originOK(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	return origin == "" || slices.Contains(s.cfg.CORSOrigins, origin)
}

// closeServerless: en Vercel sin Redis cada WebSocket quedaría en una instancia distinta
// y no recibiría los eventos de las demás. Se cierra con un código 44xx (el navegador no
// reintenta) y la web se actualiza consultando cada pocos segundos.
const closeServerless websocket.StatusCode = 4410

// noLiveEvents: serverless sin Redis no puede repartir eventos entre instancias.
func (s *Server) noLiveEvents() bool { return s.cfg.Serverless && s.cfg.RedisURL == "" }

// wsLetters: estados de las cartas del padre (requiere la cookie de sesión).
func (s *Server) wsLetters(w http.ResponseWriter, r *http.Request) {
	if s.noLiveEvents() {
		s.rejectWS(w, r, closeServerless, "usa consultas")
		return
	}
	var userID string
	if c, err := r.Cookie(accessCookie); err == nil {
		if claims, err := security.ParseToken(s.cfg.SecretKey, c.Value, "access", s.now()); err == nil {
			userID = claims.Sub
		}
	}
	if userID == "" || !s.originOK(r) {
		s.rejectWS(w, r, 4401, "sin sesión")
		return
	}
	s.serveWS(w, r, "user:"+userID)
}

// wsTracking: vista pública del niño por código de seguimiento.
func (s *Server) wsTracking(w http.ResponseWriter, r *http.Request) {
	if s.noLiveEvents() {
		s.rejectWS(w, r, closeServerless, "usa consultas")
		return
	}
	code := r.PathValue("code")
	if !s.originOK(r) {
		s.rejectWS(w, r, 4403, "origen no permitido")
		return
	}
	if !s.store.ShipmentExists(r.Context(), code) {
		s.rejectWS(w, r, 4404, "código inexistente")
		return
	}
	s.serveWS(w, r, "track:"+code)
}

// rejectWS acepta y cierra con un código 44xx: el cliente no reintenta.
func (s *Server) rejectWS(w http.ResponseWriter, r *http.Request, code websocket.StatusCode, reason string) {
	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		return
	}
	c.Close(code, reason)
}

func (s *Server) serveWS(w http.ResponseWriter, r *http.Request, channel string) {
	// el origen ya se validó contra CORS_ORIGINS
	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		return
	}
	c.SetReadLimit(1024)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sub := &wsConn{out: make(chan []byte, 32)}
	s.hub.Subscribe(channel, sub)
	defer s.hub.Unsubscribe(channel, sub)

	// lector: responde "ping" del cliente con "pong"
	go func() {
		defer cancel()
		for {
			_, msg, err := c.Read(ctx)
			if err != nil {
				return
			}
			if string(msg) == "ping" {
				sub.Send([]byte(`{"event":"pong","data":{}}`))
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			c.Close(websocket.StatusNormalClosure, "")
			return
		case p := <-sub.out:
			wctx, wcancel := context.WithTimeout(ctx, 10*time.Second)
			err := c.Write(wctx, websocket.MessageText, p)
			wcancel()
			if err != nil {
				return
			}
		}
	}
}
