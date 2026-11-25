package api

import (
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/wizends/rp-viejito-pascuero/backend/internal/store"
)

const maxChildren = 12

var avatars = map[string]bool{
	"duende_rojo": true, "duende_verde": true, "duende_dorado": true,
	"reno_canela": true, "reno_nieve": true, "reno_brasita": true,
}

type childOut struct {
	ID       string `json:"id"`
	Nickname string `json:"nickname"`
	Age      *int   `json:"age"`
	Avatar   string `json:"avatar"`
}

func toChildOut(c *store.Child) childOut {
	return childOut{ID: c.ID, Nickname: c.Nickname, Age: c.Age, Avatar: c.Avatar}
}

// notFound traduce ErrNotFound en 404 con el mensaje del taller.
func notFound(err error) error {
	if errors.Is(err, store.ErrNotFound) {
		return errf(http.StatusNotFound, msgNotFound)
	}
	return err
}

func validAge(a *int) error {
	if a != nil && (*a < 1 || *a > 17) {
		return invalid("La edad debe estar entre 1 y 17.")
	}
	return nil
}

func (s *Server) listChildren(w http.ResponseWriter, r *http.Request, u *store.User) {
	kids, err := s.store.Children(r.Context(), u.ID)
	if err != nil {
		writeErr(w, err)
		return
	}
	out := make([]childOut, 0, len(kids))
	for _, c := range kids {
		out = append(out, toChildOut(c))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) createChild(w http.ResponseWriter, r *http.Request, u *store.User) {
	var in struct {
		Nickname string  `json:"nickname"`
		Age      *int    `json:"age"`
		Avatar   *string `json:"avatar"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	nick, err := checkLen("apodo", strings.TrimSpace(in.Nickname), 1, 40)
	if err == nil {
		err = validAge(in.Age)
	}
	avatar := "duende_rojo"
	if in.Avatar != nil {
		avatar = *in.Avatar
	}
	if err == nil && !avatars[avatar] {
		err = invalid("Ese avatar no existe.")
	}
	if err != nil {
		writeErr(w, err)
		return
	}
	n, err := s.store.CountChildren(r.Context(), u.ID)
	if err != nil {
		writeErr(w, err)
		return
	}
	if n >= maxChildren {
		writeErr(w, errf(http.StatusBadRequest, "¡Son muchos duendecitos! El máximo es 12 perfiles."))
		return
	}
	c := &store.Child{UserID: u.ID, Nickname: nick, Age: in.Age, Avatar: avatar}
	if err := s.store.CreateChild(r.Context(), c); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toChildOut(c))
}

func (s *Server) updateChild(w http.ResponseWriter, r *http.Request, u *store.User) {
	c, err := s.store.OwnChild(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	var in struct {
		Nickname Opt[string] `json:"nickname"`
		Age      Opt[int]    `json:"age"`
		Avatar   Opt[string] `json:"avatar"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	if in.Nickname.Has() {
		if c.Nickname, err = checkLen("apodo", strings.TrimSpace(in.Nickname.V), 1, 40); err != nil {
			writeErr(w, err)
			return
		}
	}
	if in.Age.Set {
		if in.Age.Null {
			c.Age = nil
		} else {
			age := in.Age.V
			if err := validAge(&age); err != nil {
				writeErr(w, err)
				return
			}
			c.Age = &age
		}
	}
	if in.Avatar.Has() {
		if !avatars[in.Avatar.V] {
			writeErr(w, invalid("Ese avatar no existe."))
			return
		}
		c.Avatar = in.Avatar.V
	}
	if err := s.store.UpdateChild(r.Context(), c); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toChildOut(c))
}

func (s *Server) deleteChild(w http.ResponseWriter, r *http.Request, u *store.User) {
	c, err := s.store.OwnChild(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	paths, err := s.store.DeleteChild(r.Context(), c.ID)
	if err != nil {
		writeErr(w, err)
		return
	}
	for _, p := range paths {
		_ = os.Remove(p)
	}
	w.WriteHeader(http.StatusNoContent)
}
