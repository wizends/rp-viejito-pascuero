package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/wizends/rp-viejito-pascuero/backend/internal/security"
)

// Estados de una carta: recibida → leyendo → leida (o necesita_ayuda, solo datos antiguos).
const (
	StatusRecibida      = "recibida"
	StatusLeyendo       = "leyendo"
	StatusLeida         = "leida"
	StatusNecesitaAyuda = "necesita_ayuda"
)

type Gift struct {
	ID        string
	LetterID  string
	Nombre    string
	Prioridad *int
	Marcado   bool
	Position  int
}

type Letter struct {
	ID               string
	ChildID          string
	Source           string
	Status           string
	Mensaje          string
	TextoOriginal    string
	TextoNormalizado string
	Tono             *string
	Confianza        *float64
	Metodo           *string
	PIIMasked        bool
	ImagePath        *string
	ImageDeletedAt   *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
	Gifts            []Gift
}

const letterCols = `l.id, l.child_id, l.source, l.status, l.mensaje, l.texto_original, l.texto_normalizado,
	l.tono, l.confianza, l.metodo, l.pii_masked, l.image_path, l.image_deleted_at, l.created_at, l.updated_at`

func scanLetter(row interface{ Scan(...any) error }) (*Letter, error) {
	var l Letter
	var tono, metodo, img, imgDel sql.NullString
	var conf sql.NullFloat64
	var created, updated string
	err := row.Scan(&l.ID, &l.ChildID, &l.Source, &l.Status, &l.Mensaje, &l.TextoOriginal, &l.TextoNormalizado,
		&tono, &conf, &metodo, &l.PIIMasked, &img, &imgDel, &created, &updated)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if tono.Valid {
		l.Tono = &tono.String
	}
	if metodo.Valid {
		l.Metodo = &metodo.String
	}
	if conf.Valid {
		l.Confianza = &conf.Float64
	}
	if img.Valid {
		l.ImagePath = &img.String
	}
	l.ImageDeletedAt = parseTimePtr(imgDel)
	l.CreatedAt = parseTime(created)
	l.UpdatedAt = parseTime(updated)
	return &l, nil
}

func strPtr(p *string) any {
	if p == nil {
		return nil
	}
	return *p
}

func floatPtr(p *float64) any {
	if p == nil {
		return nil
	}
	return *p
}

// CreateLetter guarda la carta y sus regalos en una transacción.
func (s *Store) CreateLetter(ctx context.Context, l *Letter) error {
	now := time.Now().UTC()
	l.ID = security.NewID()
	l.CreatedAt, l.UpdatedAt = now, now
	if l.Status == "" {
		l.Status = StatusRecibida
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `INSERT INTO letters (id, child_id, source, status, mensaje, texto_original, texto_normalizado,
		tono, confianza, metodo, pii_masked, image_path, image_deleted_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		l.ID, l.ChildID, l.Source, l.Status, l.Mensaje, l.TextoOriginal, l.TextoNormalizado,
		strPtr(l.Tono), floatPtr(l.Confianza), strPtr(l.Metodo), b2i(l.PIIMasked), strPtr(l.ImagePath),
		fmtTimePtr(l.ImageDeletedAt), fmtTime(now), fmtTime(now))
	if err != nil {
		return err
	}
	if err := insertGifts(ctx, tx, l); err != nil {
		return err
	}
	return tx.Commit()
}

func insertGifts(ctx context.Context, tx *sql.Tx, l *Letter) error {
	for i := range l.Gifts {
		g := &l.Gifts[i]
		g.ID = security.NewID()
		g.LetterID = l.ID
		g.Position = i
		if _, err := tx.ExecContext(ctx, `INSERT INTO gifts (id, letter_id, nombre, prioridad, marcado, position) VALUES (?, ?, ?, ?, ?, ?)`,
			g.ID, g.LetterID, g.Nombre, intPtr(g.Prioridad), b2i(g.Marcado), g.Position); err != nil {
			return err
		}
	}
	return nil
}

// SaveLetter actualiza todos los campos y, si replaceGifts, reemplaza los regalos.
func (s *Store) SaveLetter(ctx context.Context, l *Letter, replaceGifts bool) error {
	l.UpdatedAt = time.Now().UTC()
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `UPDATE letters SET status = ?, mensaje = ?, texto_original = ?, texto_normalizado = ?,
		tono = ?, confianza = ?, metodo = ?, pii_masked = ?, image_path = ?, image_deleted_at = ?, updated_at = ? WHERE id = ?`,
		l.Status, l.Mensaje, l.TextoOriginal, l.TextoNormalizado, strPtr(l.Tono), floatPtr(l.Confianza), strPtr(l.Metodo),
		b2i(l.PIIMasked), strPtr(l.ImagePath), fmtTimePtr(l.ImageDeletedAt), fmtTime(l.UpdatedAt), l.ID)
	if err != nil {
		return err
	}
	if replaceGifts {
		if _, err := tx.ExecContext(ctx, `DELETE FROM gifts WHERE letter_id = ?`, l.ID); err != nil {
			return err
		}
		if err := insertGifts(ctx, tx, l); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// SetStatus cambia solo el estado.
func (s *Store) SetStatus(ctx context.Context, id, status string) error {
	_, err := s.DB.ExecContext(ctx, `UPDATE letters SET status = ?, updated_at = ? WHERE id = ?`, status, fmtTime(time.Now()), id)
	return err
}

func (s *Store) loadGifts(ctx context.Context, letters []*Letter) error {
	if len(letters) == 0 {
		return nil
	}
	byID := map[string]*Letter{}
	args := make([]any, 0, len(letters))
	q := `SELECT id, letter_id, nombre, prioridad, marcado, position FROM gifts WHERE letter_id IN (`
	for i, l := range letters {
		byID[l.ID] = l
		l.Gifts = []Gift{}
		if i > 0 {
			q += ","
		}
		q += "?"
		args = append(args, l.ID)
	}
	rows, err := s.DB.QueryContext(ctx, q+`) ORDER BY position`, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var g Gift
		var p sql.NullInt64
		if err := rows.Scan(&g.ID, &g.LetterID, &g.Nombre, &p, &g.Marcado, &g.Position); err != nil {
			return err
		}
		if p.Valid {
			v := int(p.Int64)
			g.Prioridad = &v
		}
		byID[g.LetterID].Gifts = append(byID[g.LetterID].Gifts, g)
	}
	return rows.Err()
}

// LetterByID devuelve la carta (sin verificar dueño) con sus regalos.
func (s *Store) LetterByID(ctx context.Context, id string) (*Letter, error) {
	l, err := scanLetter(s.DB.QueryRowContext(ctx, `SELECT `+letterCols+` FROM letters l WHERE l.id = ?`, id))
	if err != nil {
		return nil, err
	}
	return l, s.loadGifts(ctx, []*Letter{l})
}

// OwnLetter devuelve la carta solo si es de un niño del usuario.
func (s *Store) OwnLetter(ctx context.Context, userID, letterID string) (*Letter, error) {
	l, err := scanLetter(s.DB.QueryRowContext(ctx, `SELECT `+letterCols+` FROM letters l JOIN children c ON c.id = l.child_id
		WHERE l.id = ? AND c.user_id = ?`, letterID, userID))
	if err != nil {
		return nil, err
	}
	return l, s.loadGifts(ctx, []*Letter{l})
}

// Letters lista las cartas del usuario (opcionalmente de un niño), las más nuevas primero.
func (s *Store) Letters(ctx context.Context, userID, childID string) ([]*Letter, error) {
	q := `SELECT ` + letterCols + ` FROM letters l JOIN children c ON c.id = l.child_id WHERE c.user_id = ?`
	args := []any{userID}
	if childID != "" {
		q += ` AND l.child_id = ?`
		args = append(args, childID)
	}
	rows, err := s.DB.QueryContext(ctx, q+` ORDER BY l.created_at DESC`, args...)
	if err != nil {
		return nil, err
	}
	out := []*Letter{}
	for rows.Next() {
		l, err := scanLetter(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		out = append(out, l)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, s.loadGifts(ctx, out)
}

// PendingLetters devuelve las cartas que quedaron a medio procesar (p. ej. tras un reinicio).
func (s *Store) PendingLetters(ctx context.Context) ([]string, error) {
	return s.imagePaths(ctx, `SELECT id FROM letters WHERE status IN (?, ?) ORDER BY created_at`, StatusRecibida, StatusLeyendo)
}

func (s *Store) DeleteLetter(ctx context.Context, id string) error {
	_, err := s.DB.ExecContext(ctx, `DELETE FROM letters WHERE id = ?`, id)
	return err
}

// ExpiredImages devuelve (id, ruta) de imágenes de cartas creadas antes de limit.
func (s *Store) ExpiredImages(ctx context.Context, limit time.Time) (map[string]string, error) {
	rows, err := s.DB.QueryContext(ctx, `SELECT id, image_path FROM letters WHERE image_path IS NOT NULL AND created_at < ?`, fmtTime(limit))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var id, p string
		if err := rows.Scan(&id, &p); err != nil {
			return nil, err
		}
		out[id] = p
	}
	return out, rows.Err()
}

// ClearImage marca la imagen como borrada.
func (s *Store) ClearImage(ctx context.Context, id string, at time.Time) error {
	_, err := s.DB.ExecContext(ctx, `UPDATE letters SET image_path = NULL, image_deleted_at = ? WHERE id = ?`, fmtTime(at), id)
	return err
}
