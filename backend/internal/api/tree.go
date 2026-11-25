package api

import (
	"net/http"

	"github.com/wizends/rp-viejito-pascuero/backend/internal/store"
)

// delivered dice si el Viejito ya dejó el regalo: se completó la parada "bajo el árbol"
// (o, sin esa parada, la última). Sin paradas, cuenta la hora de llegada.
func (s *Server) delivered(sh *store.Shipment) bool {
	for i := len(sh.Stops) - 1; i >= 0; i-- {
		if sh.Stops[i].Icono == "arbol" {
			return sh.Stops[i].CompletedAt != nil
		}
	}
	if n := len(sh.Stops); n > 0 {
		return sh.Stops[n-1].CompletedAt != nil
	}
	return !s.now().Before(sh.ArrivalAt)
}

func writeImage(w http.ResponseWriter, data []byte, ctype string) {
	w.Header().Set("Content-Type", ctype)
	w.Header().Set("Cache-Control", "private, no-store")
	_, _ = w.Write(data)
}

// putTreePhoto guarda la foto del árbol: el Viejito se sacará una selfie con él al llegar.
func (s *Server) putTreePhoto(w http.ResponseWriter, r *http.Request, u *store.User) {
	if !s.limitUpload(r, u.ID) {
		s.tooMany(w, nil)
		return
	}
	sh, err := s.store.OwnShipment(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	if !s.parseUpload(w, r) {
		return
	}
	defer r.MultipartForm.RemoveAll()
	clean, ok := s.uploadedImage(w, r, "Falta la foto del árbol.")
	if !ok {
		return
	}
	if err := s.store.SetTreePhoto(r.Context(), sh.ID, "image/jpeg", clean.Data, s.now().UTC()); err != nil {
		writeErr(w, err)
		return
	}
	s.reply(w, r, sh.ID, http.StatusOK)
}

func (s *Server) getTreePhoto(w http.ResponseWriter, r *http.Request, u *store.User) {
	sh, err := s.store.OwnShipment(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	data, ctype, err := s.store.TreePhoto(r.Context(), sh.ID)
	if err != nil {
		writeErr(w, errf(http.StatusNotFound, "Aún no hay foto del árbol."))
		return
	}
	writeImage(w, data, ctype)
}

func (s *Server) deleteTreePhoto(w http.ResponseWriter, r *http.Request, u *store.User) {
	sh, err := s.store.OwnShipment(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	if err := s.store.DeleteTreePhoto(r.Context(), sh.ID); err != nil {
		writeErr(w, err)
		return
	}
	s.reply(w, r, sh.ID, http.StatusOK)
}

// publicSelfie entrega la foto del árbol al niño solo cuando el regalo ya llegó:
// antes no existe (ni siquiera se confirma que haya foto).
func (s *Server) publicSelfie(w http.ResponseWriter, r *http.Request) {
	s.advanceDueStops(r.Context())
	sh, err := s.store.ShipmentByCode(r.Context(), r.PathValue("code"))
	if err != nil || !sh.HasTree || !s.delivered(sh) {
		writeErr(w, errf(http.StatusNotFound, "Todavía no hay selfie del Viejito Pascuero."))
		return
	}
	data, ctype, err := s.store.TreePhoto(r.Context(), sh.ID)
	if err != nil {
		writeErr(w, errf(http.StatusNotFound, "Todavía no hay selfie del Viejito Pascuero."))
		return
	}
	writeImage(w, data, ctype)
}
