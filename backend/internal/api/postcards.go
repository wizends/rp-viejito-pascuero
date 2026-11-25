package api

import (
	"encoding/json"
	"math"
	"net/http"
	"regexp"
	"time"

	"github.com/wizends/rp-viejito-pascuero/backend/internal/store"
)

const maxPostcardStickers = 40

// Nombres de estilo, fondo, borde y sticker: cortos y en minúsculas. No se fija la
// lista exacta para que la web pueda sumar fondos o stickers sin tocar el backend.
var designID = regexp.MustCompile(`^[a-z][a-z0-9_]{0,31}$`)

type placement struct {
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Scale float64 `json:"scale"`
	Rot   float64 `json:"rot"`
}

type placedSticker struct {
	ID      string  `json:"id"`
	Sticker string  `json:"sticker"`
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
	Size    float64 `json:"size"`
	Rot     float64 `json:"rot"`
}

// postcardDesign es lo único que se guarda: campos conocidos y validados, nada más.
type postcardDesign struct {
	Style     string          `json:"style"`
	Format    string          `json:"format"`
	Theme     string          `json:"theme"`
	Frame     string          `json:"frame"`
	Snow      bool            `json:"snow"`
	Title     string          `json:"title"`
	Signature string          `json:"signature"`
	Show      string          `json:"show,omitempty"`
	Letter    placement       `json:"letter"`
	Stickers  []placedSticker `json:"stickers"`
}

type postcardOut struct {
	Design    postcardDesign `json:"design"`
	UpdatedAt time.Time      `json:"updated_at"`
}

func within(v, lo, hi float64) bool { return !math.IsNaN(v) && v >= lo && v <= hi }

func (d *postcardDesign) validate() error {
	for _, id := range []string{d.Style, d.Format, d.Theme, d.Frame} {
		if !designID.MatchString(id) {
			return invalid("El diseño de la postal no es válido.")
		}
	}
	if d.Show != "" && d.Show != "foto" && d.Show != "texto" {
		return invalid("El diseño de la postal no es válido.")
	}
	if runeLen(d.Title) > 60 || runeLen(d.Signature) > 60 {
		return invalid("El título y la firma tienen máximo 60 letras.")
	}
	l := d.Letter
	if !within(l.X, 0, 1) || !within(l.Y, 0, 1) || !within(l.Scale, 0.2, 2) || !within(l.Rot, -50, 50) {
		return invalid("El diseño de la postal no es válido.")
	}
	if len(d.Stickers) > maxPostcardStickers {
		return invalid("Máximo %d stickers por postal.", maxPostcardStickers)
	}
	for _, st := range d.Stickers {
		if st.ID == "" || len(st.ID) > 40 || !designID.MatchString(st.Sticker) ||
			!within(st.X, 0, 1) || !within(st.Y, 0, 1) || !within(st.Size, 0.01, 1) || !within(st.Rot, -50, 50) {
			return invalid("El diseño de la postal no es válido.")
		}
	}
	return nil
}

func (s *Server) getPostcard(w http.ResponseWriter, r *http.Request, u *store.User) {
	l, err := s.store.OwnLetter(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	raw, updated, err := s.store.Postcard(r.Context(), l.ID)
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	var d postcardDesign
	if err := json.Unmarshal([]byte(raw), &d); err != nil {
		writeErr(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, postcardOut{Design: d, UpdatedAt: updated})
}

func (s *Server) putPostcard(w http.ResponseWriter, r *http.Request, u *store.User) {
	l, err := s.store.OwnLetter(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	var in struct {
		Design *postcardDesign `json:"design"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	if in.Design == nil {
		writeErr(w, invalid("Falta el diseño de la postal."))
		return
	}
	if in.Design.Stickers == nil {
		in.Design.Stickers = []placedSticker{}
	}
	if err := in.Design.validate(); err != nil {
		writeErr(w, err)
		return
	}
	raw, _ := json.Marshal(in.Design)
	now := s.now().UTC()
	if err := s.store.SavePostcard(r.Context(), l.ID, string(raw), now); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, postcardOut{Design: *in.Design, UpdatedAt: now})
}
