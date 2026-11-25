package api

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/wizends/rp-viejito-pascuero/backend/internal/security"
	"github.com/wizends/rp-viejito-pascuero/backend/internal/store"
)

const (
	accessCookie  = "vp_access"
	refreshCookie = "vp_refresh"
	csrfCookie    = "vp_csrf"
	refreshPath   = "/api/auth"
)

type userOut struct {
	ID              string `json:"id"`
	Email           string `json:"email"`
	DisplayName     string `json:"display_name"`
	AllowExternalAI bool   `json:"allow_external_ai"`
}

func toUserOut(u *store.User) userOut {
	return userOut{ID: u.ID, Email: u.Email, DisplayName: u.DisplayName, AllowExternalAI: u.AllowExternalAI}
}

type ctxKey struct{}

// authed exige la cookie de acceso y deja al usuario en el contexto.
func (s *Server) authed(h func(http.ResponseWriter, *http.Request, *store.User)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := s.currentUser(r)
		if u == nil {
			writeErr(w, errf(http.StatusUnauthorized, msgNoAuth))
			return
		}
		h(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, u)), u)
	}
}

func (s *Server) currentUser(r *http.Request) *store.User {
	c, err := r.Cookie(accessCookie)
	if err != nil {
		return nil
	}
	claims, err := security.ParseToken(s.cfg.SecretKey, c.Value, "access", s.now())
	if err != nil {
		return nil
	}
	u, err := s.store.UserByID(r.Context(), claims.Sub)
	if err != nil {
		return nil
	}
	return u
}

func (s *Server) sameSite() http.SameSite {
	if s.cfg.CookieSameSite == "strict" {
		return http.SameSiteStrictMode
	}
	return http.SameSiteLaxMode
}

func (s *Server) cookie(name, value, path string, maxAge int, httpOnly bool) *http.Cookie {
	return &http.Cookie{Name: name, Value: value, Path: path, MaxAge: maxAge, HttpOnly: httpOnly,
		Secure: s.cfg.CookieSecure, SameSite: s.sameSite()}
}

// openSession guarda un refresh nuevo y entrega las tres cookies (acceso, refresh y CSRF).
func (s *Server) openSession(w http.ResponseWriter, r *http.Request, u *store.User) error {
	now := s.now()
	jti := security.NewID()
	if err := s.store.CreateRefresh(r.Context(), jti, u.ID, now.Add(s.cfg.RefreshTTL)); err != nil {
		return err
	}
	access, err := security.SignToken(s.cfg.SecretKey, security.Claims{Sub: u.ID, Typ: "access"}, s.cfg.AccessTTL, now)
	if err != nil {
		return err
	}
	refresh, err := security.SignToken(s.cfg.SecretKey, security.Claims{Sub: u.ID, Typ: "refresh", Jti: jti}, s.cfg.RefreshTTL, now)
	if err != nil {
		return err
	}
	http.SetCookie(w, s.cookie(accessCookie, access, "/", int(s.cfg.AccessTTL.Seconds()), true))
	http.SetCookie(w, s.cookie(refreshCookie, refresh, refreshPath, int(s.cfg.RefreshTTL.Seconds()), true))
	// legible por JS (no httpOnly) para el patrón double-submit
	http.SetCookie(w, s.cookie(csrfCookie, security.RandomToken(24), "/", int(s.cfg.RefreshTTL.Seconds()), false))
	return nil
}

func (s *Server) clearSession(w http.ResponseWriter) {
	http.SetCookie(w, s.cookie(accessCookie, "", "/", -1, true))
	http.SetCookie(w, s.cookie(refreshCookie, "", refreshPath, -1, true))
	http.SetCookie(w, s.cookie(csrfCookie, "", "/", -1, false))
}

func (s *Server) limitAuth(r *http.Request) error {
	if s.limiter.check("auth:"+s.clientIP(r), s.cfg.RateAuth) != nil {
		return errTooMany
	}
	return nil
}

var errTooMany = errors.New("demasiadas")

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	if s.limitAuth(r) != nil {
		s.tooMany(w, nil)
		return
	}
	var in struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if !validEmail(email) {
		writeErr(w, invalid("Ese correo no parece válido."))
		return
	}
	if n := runeLen(in.Password); n < 10 || n > 128 {
		writeErr(w, invalid("La contraseña debe tener entre 10 y 128 caracteres."))
		return
	}
	name, err := checkLen("nombre", strings.TrimSpace(in.DisplayName), 1, 80)
	if err != nil {
		writeErr(w, err)
		return
	}
	hash, err := security.HashPassword(in.Password)
	if err != nil {
		writeErr(w, err)
		return
	}
	u, err := s.store.CreateUser(r.Context(), email, hash, name)
	if errors.Is(err, store.ErrDuplicate) {
		writeErr(w, errf(http.StatusConflict, "Ese correo ya tiene credencial de ayudante."))
		return
	}
	if err == nil {
		err = s.openSession(w, r, u)
	}
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toUserOut(u))
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	if s.limitAuth(r) != nil {
		s.tooMany(w, nil)
		return
	}
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if !validEmail(email) || in.Password == "" || runeLen(in.Password) > 128 {
		writeErr(w, invalid("Revisa el correo y la contraseña."))
		return
	}
	u, err := s.store.UserByEmail(r.Context(), email)
	hash := s.dummyHash
	if err == nil {
		hash = u.PasswordHash
	}
	ok := security.VerifyPassword(hash, in.Password)
	if u == nil || !ok {
		writeErr(w, errf(http.StatusUnauthorized, "Correo o contraseña incorrectos."))
		return
	}
	if err := s.openSession(w, r, u); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toUserOut(u))
}

// refresh rota el token: el usado se revoca y se emite uno nuevo.
func (s *Server) refresh(w http.ResponseWriter, r *http.Request) {
	if s.limitAuth(r) != nil {
		s.tooMany(w, nil)
		return
	}
	expired := func() {
		s.clearSession(w)
		writeErr(w, errf(http.StatusUnauthorized, "La sesión expiró."))
	}
	c, err := r.Cookie(refreshCookie)
	if err != nil {
		expired()
		return
	}
	claims, err := security.ParseToken(s.cfg.SecretKey, c.Value, "refresh", s.now())
	if err != nil || claims.Jti == "" {
		expired()
		return
	}
	revoked, err := s.store.RevokeRefresh(r.Context(), claims.Jti, claims.Sub)
	if err != nil || !revoked {
		expired()
		return
	}
	u, err := s.store.UserByID(r.Context(), claims.Sub)
	if err != nil {
		expired()
		return
	}
	if err := s.openSession(w, r, u); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toUserOut(u))
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(refreshCookie); err == nil {
		if claims, err := security.ParseToken(s.cfg.SecretKey, c.Value, "refresh", s.now()); err == nil {
			_, _ = s.store.RevokeRefresh(r.Context(), claims.Jti, claims.Sub)
		}
	}
	s.clearSession(w)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) me(w http.ResponseWriter, _ *http.Request, u *store.User) {
	writeJSON(w, http.StatusOK, toUserOut(u))
}

func (s *Server) updateMe(w http.ResponseWriter, r *http.Request, u *store.User) {
	var in struct {
		DisplayName     Opt[string] `json:"display_name"`
		AllowExternalAI Opt[bool]   `json:"allow_external_ai"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	if in.DisplayName.Has() {
		name, err := checkLen("nombre", strings.TrimSpace(in.DisplayName.V), 1, 80)
		if err != nil {
			writeErr(w, err)
			return
		}
		u.DisplayName = name
	}
	if in.AllowExternalAI.Has() {
		u.AllowExternalAI = in.AllowExternalAI.V
	}
	if err := s.store.UpdateUser(r.Context(), u); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toUserOut(u))
}
