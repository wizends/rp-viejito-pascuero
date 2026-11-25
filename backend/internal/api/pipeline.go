package api

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/wizends/rp-viejito-pascuero/backend/internal/store"
	"github.com/wizends/rp-viejito-pascuero/backend/internal/text"
	"github.com/wizends/rp-viejito-pascuero/backend/internal/vision"
)

// La IA solo se acepta si confía al menos esto en su transcripción.
const visionMinConfidence = 0.5

var statusMsg = map[string]string{
	store.StatusRecibida: "¡Tu carta llegó al Polo Norte!",
	store.StatusLeyendo:  "El Viejito Pascuero se puso los lentes y está leyendo…",
	store.StatusLeida:    "¡Qué carta más bonita! El Viejito Pascuero ya la tiene.",
}

func (s *Server) publishStatus(userID string, l *store.Letter) {
	s.hub.Publish("user:"+userID, "letter.status", map[string]string{
		"id": l.ID, "child_id": l.ChildID, "status": l.Status, "mensaje": statusMsg[l.Status],
	})
}

// processLetter: recibida → leyendo → leida.
//   - Escrita: se enmascaran datos sensibles y se extraen regalos del texto.
//   - Foto: la imagen es la carta. Solo si el padre aceptó la IA y hay proveedor,
//     un modelo gratuito transcribe el texto y los regalos. Si no, queda la imagen.
func (s *Server) processLetter(ctx context.Context, id string) {
	l, err := s.store.LetterByID(ctx, id)
	// idempotente: un reintento no reprocesa una carta terminada
	if err != nil || (l.Status != store.StatusRecibida && l.Status != store.StatusLeyendo) {
		return
	}
	child, err := s.store.ChildByID(ctx, l.ChildID)
	if err != nil {
		return
	}
	user, err := s.store.UserByID(ctx, child.UserID)
	if err != nil {
		return
	}
	l.Status = store.StatusLeyendo
	if err := s.store.SetStatus(ctx, l.ID, l.Status); err != nil {
		slog.Error("no se pudo marcar la carta", "id", l.ID, "err", err)
		return
	}
	s.publishStatus(user.ID, l)

	replaceGifts := false
	switch {
	case l.Source == "escrita":
		replaceGifts = readWritten(l)
	case l.ImagePath != nil && s.vision != nil && user.AllowExternalAI:
		replaceGifts = s.readWithAI(ctx, l)
	}
	l.Status = store.StatusLeida
	if err := s.store.SaveLetter(ctx, l, replaceGifts); err != nil {
		slog.Error("no se pudo guardar la carta", "id", l.ID, "err", err)
		return
	}
	s.publishStatus(user.ID, l)
}

func setMeta(l *store.Letter, tono, metodo string, conf float64) {
	l.Tono, l.Metodo, l.Confianza = &tono, &metodo, &conf
}

// readWritten enmascara una carta escrita. Devuelve si cambiaron los regalos.
func readWritten(l *store.Letter) bool {
	original, masked := text.MaskPII(l.TextoOriginal)
	l.TextoOriginal = original
	l.TextoNormalizado = text.Normalize(original)
	l.PIIMasked = masked
	setMeta(l, text.DetectTone(original), "escrita", 1)
	if len(l.Gifts) > 0 {
		for i := range l.Gifts {
			name, m := text.MaskPII(l.Gifts[i].Nombre)
			l.Gifts[i].Nombre = name
			l.PIIMasked = l.PIIMasked || m
		}
		return true
	}
	// sin lista de deseos: se buscan en el mensaje ("quiero una pelota y un auto")
	for _, g := range text.ExtractGifts(original) {
		l.Gifts = append(l.Gifts, store.Gift{Nombre: g.Nombre, Prioridad: g.Prioridad})
	}
	return true
}

// readWithAI transcribe la foto con el modelo de visión. Si falla, la carta queda solo como imagen.
func (s *Server) readWithAI(ctx context.Context, l *store.Letter) bool {
	img, err := os.ReadFile(*l.ImagePath)
	if err != nil {
		return false
	}
	ctx, cancel := context.WithTimeout(ctx, s.cfg.VisionTimeout+5*time.Second)
	defer cancel()
	res, err := s.vision.Read(ctx, img)
	if err != nil {
		slog.Warn("la IA no pudo leer la carta", "id", l.ID, "proveedor", s.vision.Name(), "err", err)
		return false
	}
	if !vision.Readable(res, visionMinConfidence) {
		slog.Info("la IA no encontró texto legible", "id", l.ID, "confianza", res.Confianza)
		return false
	}
	original, m1 := text.MaskPII(res.TextoOriginal)
	normal, m2 := text.MaskPII(res.TextoNormalizado)
	l.TextoOriginal, l.TextoNormalizado = original, normal
	l.PIIMasked = l.PIIMasked || m1 || m2
	setMeta(l, res.Tono, "ia", res.Confianza)
	l.Gifts = l.Gifts[:0]
	for _, g := range res.Regalos {
		name, m := text.MaskPII(g.Nombre)
		l.PIIMasked = l.PIIMasked || m
		l.Gifts = append(l.Gifts, store.Gift{Nombre: text.Truncate(name, 120), Prioridad: g.Prioridad})
	}
	return true
}

// purgeExpiredImages borra las imágenes más antiguas que RETENTION_DAYS (0 = nunca).
func (s *Server) purgeExpiredImages(ctx context.Context) {
	if s.cfg.RetentionDays <= 0 {
		return
	}
	now := s.now()
	expired, err := s.store.ExpiredImages(ctx, now.AddDate(0, 0, -s.cfg.RetentionDays))
	if err != nil {
		slog.Error("retención", "err", err)
		return
	}
	for id, path := range expired {
		_ = os.Remove(path)
		_ = s.store.ClearImage(ctx, id, now)
	}
	if len(expired) > 0 {
		slog.Info("imágenes vencidas borradas", "cantidad", len(expired))
	}
}
