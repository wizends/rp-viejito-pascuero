package api

import (
	"errors"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/wizends/rp-viejito-pascuero/backend/internal/imaging"
	"github.com/wizends/rp-viejito-pascuero/backend/internal/store"
	"github.com/wizends/rp-viejito-pascuero/backend/internal/text"
)

type giftOut struct {
	ID        string `json:"id"`
	Nombre    string `json:"nombre"`
	Prioridad *int   `json:"prioridad"`
	Marcado   bool   `json:"marcado"`
}

type letterOut struct {
	ID               string    `json:"id"`
	ChildID          string    `json:"child_id"`
	Source           string    `json:"source"`
	Status           string    `json:"status"`
	Mensaje          string    `json:"mensaje"`
	TextoOriginal    string    `json:"texto_original"`
	TextoNormalizado string    `json:"texto_normalizado"`
	Tono             *string   `json:"tono"`
	Confianza        *float64  `json:"confianza"`
	Metodo           *string   `json:"metodo"`
	PIIMasked        bool      `json:"pii_masked"`
	HasImage         bool      `json:"has_image"`
	CreatedAt        time.Time `json:"created_at"`
	Gifts            []giftOut `json:"gifts"`
}

func toLetterOut(l *store.Letter) letterOut {
	gifts := make([]giftOut, 0, len(l.Gifts))
	for _, g := range l.Gifts {
		gifts = append(gifts, giftOut{ID: g.ID, Nombre: g.Nombre, Prioridad: g.Prioridad, Marcado: g.Marcado})
	}
	return letterOut{
		ID: l.ID, ChildID: l.ChildID, Source: l.Source, Status: l.Status, Mensaje: l.Mensaje,
		TextoOriginal: l.TextoOriginal, TextoNormalizado: l.TextoNormalizado, Tono: l.Tono,
		Confianza: l.Confianza, Metodo: l.Metodo, PIIMasked: l.PIIMasked, HasImage: l.ImagePath != nil,
		CreatedAt: l.CreatedAt, Gifts: gifts,
	}
}

func (s *Server) limitUpload(r *http.Request, userID string) bool {
	return s.limiter.check("up-ip:"+s.clientIP(r), s.cfg.RateUploads) == nil &&
		s.limiter.check("up-user:"+userID, s.cfg.RateUploads) == nil
}

func (s *Server) listLetters(w http.ResponseWriter, r *http.Request, u *store.User) {
	list, err := s.store.Letters(r.Context(), u.ID, r.URL.Query().Get("child_id"))
	if err != nil {
		writeErr(w, err)
		return
	}
	out := make([]letterOut, 0, len(list))
	for _, l := range list {
		out = append(out, toLetterOut(l))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) getLetter(w http.ResponseWriter, r *http.Request, u *store.User) {
	l, err := s.store.OwnLetter(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	writeJSON(w, http.StatusOK, toLetterOut(l))
}

func (s *Server) letterImage(w http.ResponseWriter, r *http.Request, u *store.User) {
	l, err := s.store.OwnLetter(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	gone := errf(http.StatusNotFound, "La imagen ya fue borrada por privacidad.")
	if l.ImagePath == nil {
		writeErr(w, gone)
		return
	}
	f, err := os.Open(*l.ImagePath)
	if err != nil {
		writeErr(w, gone)
		return
	}
	defer f.Close()
	ctype := "image/jpeg"
	if strings.HasSuffix(*l.ImagePath, ".png") {
		ctype = "image/png"
	}
	w.Header().Set("Content-Type", ctype)
	w.Header().Set("Cache-Control", "private, no-store")
	_, _ = io.Copy(w, f)
}

// writeLetter recibe una carta escrita en la web (deseos + mensaje).
func (s *Server) writeLetter(w http.ResponseWriter, r *http.Request, u *store.User) {
	if !s.limitUpload(r, u.ID) {
		s.tooMany(w, nil)
		return
	}
	var in struct {
		ChildID string   `json:"child_id"`
		Deseos  []string `json:"deseos"`
		Mensaje string   `json:"mensaje"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	if len(in.Deseos) > 20 {
		writeErr(w, invalid("Máximo 20 deseos por carta."))
		return
	}
	if runeLen(in.Mensaje) > 4000 {
		writeErr(w, invalid("El mensaje es demasiado largo."))
		return
	}
	child, err := s.store.OwnChild(r.Context(), u.ID, in.ChildID)
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	var deseos []string
	for _, d := range in.Deseos {
		if d = strings.TrimSpace(d); d != "" {
			deseos = append(deseos, text.Truncate(d, 120))
		}
	}
	mensaje := strings.TrimSpace(in.Mensaje)
	if len(deseos) == 0 && mensaje == "" {
		writeErr(w, invalid("La carta está vacía. ¡Cuéntale algo al Viejito!"))
		return
	}
	var lines []string
	if mensaje != "" {
		lines = append(lines, mensaje)
	}
	if len(deseos) > 0 {
		list := make([]string, len(deseos))
		for i, d := range deseos {
			list[i] = "- " + d
		}
		lines = append(lines, "Mis deseos:\n"+strings.Join(list, "\n"))
	}
	masked, _ := text.MaskPII(in.Mensaje)
	l := &store.Letter{ChildID: child.ID, Source: "escrita", Mensaje: masked, TextoOriginal: strings.Join(lines, "\n\n")}
	for i, d := range deseos {
		g := store.Gift{Nombre: d}
		if i < 10 {
			p := i + 1
			g.Prioridad = &p
		}
		l.Gifts = append(l.Gifts, g)
	}
	if err := s.store.CreateLetter(r.Context(), l); err != nil {
		writeErr(w, err)
		return
	}
	out := toLetterOut(l)
	s.enqueue(l.ID)
	writeJSON(w, http.StatusAccepted, out)
}

// uploadLetter recibe la foto de una carta en papel. Se guarda limpia; no se lee el texto
// salvo que el padre acepte la IA de visión.
func (s *Server) uploadLetter(w http.ResponseWriter, r *http.Request, u *store.User) {
	if !s.limitUpload(r, u.ID) {
		s.tooMany(w, nil)
		return
	}
	maxBytes := s.cfg.MaxUploadMB << 20
	r.Body = http.MaxBytesReader(w, r.Body, int64(maxBytes)+1<<20)
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeErr(w, errf(http.StatusBadRequest, "El archivo supera los %d MB.", s.cfg.MaxUploadMB))
			return
		}
		writeErr(w, invalid("Revisa los datos del formulario."))
		return
	}
	defer r.MultipartForm.RemoveAll()
	mensaje := r.FormValue("mensaje")
	if runeLen(mensaje) > 2000 {
		writeErr(w, invalid("El mensaje es demasiado largo."))
		return
	}
	child, err := s.store.OwnChild(r.Context(), u.ID, r.FormValue("child_id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeErr(w, invalid("Falta la foto de la carta."))
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, int64(maxBytes)+1))
	if err != nil {
		writeErr(w, err)
		return
	}
	stored, err := imaging.Clean(data, maxBytes, s.cfg.UploadDir())
	if err != nil {
		var ie *imaging.Error
		if errors.As(err, &ie) {
			status := http.StatusBadRequest
			if ie.Unsupported {
				status = http.StatusUnsupportedMediaType
			}
			writeErr(w, errf(status, "%s", ie.Msg))
			return
		}
		writeErr(w, err)
		return
	}
	masked, _ := text.MaskPII(mensaje)
	l := &store.Letter{ChildID: child.ID, Source: "foto", Mensaje: masked, ImagePath: &stored.Path}
	if err := s.store.CreateLetter(r.Context(), l); err != nil {
		_ = os.Remove(stored.Path)
		writeErr(w, err)
		return
	}
	out := toLetterOut(l)
	s.enqueue(l.ID)
	writeJSON(w, http.StatusAccepted, out)
}

// updateLetter permite al padre transcribir o corregir la carta y sus regalos.
func (s *Server) updateLetter(w http.ResponseWriter, r *http.Request, u *store.User) {
	l, err := s.store.OwnLetter(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	var in struct {
		TextoOriginal    Opt[string] `json:"texto_original"`
		TextoNormalizado Opt[string] `json:"texto_normalizado"`
		Gifts            Opt[[]struct {
			Nombre    string `json:"nombre"`
			Prioridad *int   `json:"prioridad"`
			Marcado   bool   `json:"marcado"`
		}] `json:"gifts"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	edited := false
	if in.TextoOriginal.Has() {
		if runeLen(in.TextoOriginal.V) > 8000 {
			writeErr(w, invalid("El texto es demasiado largo."))
			return
		}
		l.TextoOriginal, edited = in.TextoOriginal.V, true
	}
	if in.TextoNormalizado.Has() {
		if runeLen(in.TextoNormalizado.V) > 8000 {
			writeErr(w, invalid("El texto es demasiado largo."))
			return
		}
		l.TextoNormalizado, edited = in.TextoNormalizado.V, true
	}
	replace := in.Gifts.Has()
	if replace {
		if len(in.Gifts.V) > 30 {
			writeErr(w, invalid("Máximo 30 regalos."))
			return
		}
		l.Gifts = l.Gifts[:0]
		for _, g := range in.Gifts.V {
			name, err := checkLen("regalo", g.Nombre, 1, 120)
			if err != nil {
				writeErr(w, err)
				return
			}
			if g.Prioridad != nil && (*g.Prioridad < 1 || *g.Prioridad > 10) {
				writeErr(w, invalid("La prioridad va de 1 a 10."))
				return
			}
			l.Gifts = append(l.Gifts, store.Gift{Nombre: name, Prioridad: g.Prioridad, Marcado: g.Marcado})
		}
	}
	if edited && l.Source == "foto" {
		m, one := "manual", 1.0
		l.Metodo, l.Confianza = &m, &one
	}
	if edited && l.Status == store.StatusNecesitaAyuda {
		l.Status = store.StatusLeida
	}
	if err := s.store.SaveLetter(r.Context(), l, replace); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toLetterOut(l))
}

func (s *Server) deleteLetter(w http.ResponseWriter, r *http.Request, u *store.User) {
	l, err := s.store.OwnLetter(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	if err := s.store.DeleteLetter(r.Context(), l.ID); err != nil {
		writeErr(w, err)
		return
	}
	if l.ImagePath != nil {
		_ = os.Remove(*l.ImagePath)
	}
	w.WriteHeader(http.StatusNoContent)
}
