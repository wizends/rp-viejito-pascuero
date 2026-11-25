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
	// ImagePath marca que la carta tiene foto (la clave en letter_images); nil = sin foto.
	ImagePath      *string
	ImageDeletedAt *time.Time
	// Image son los bytes JPEG a guardar al crear la carta (no se cargan al leerla).
	Image            []byte
	ImageContentType string
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
	if l.Image != nil {
		l.ImagePath = &l.ID
	}
	tx, err := s.begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.exec(ctx, `INSERT INTO letters (id, child_id, source, status, mensaje, texto_original, texto_normalizado,
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
	if l.Image != nil {
		ctype := l.ImageContentType
		if ctype == "" {
			ctype = "image/jpeg"
		}
		if _, err := tx.exec(ctx, `INSERT INTO letter_images (letter_id, content_type, data) VALUES (?, ?, ?)`, l.ID, ctype, l.Image); err != nil {
			return err
		}
		l.Image = nil // ya guardada; no se arrastra en memoria
	}
	return tx.Commit()
}

// Image devuelve la foto de la carta.
func (s *Store) Image(ctx context.Context, letterID string) ([]byte, string, error) {
	var data []byte
	var ctype string
	err := s.queryRow(ctx, `SELECT data, content_type FROM letter_images WHERE letter_id = ?`, letterID).Scan(&data, &ctype)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, "", ErrNotFound
	}
	return data, ctype, err
}

func insertGifts(ctx context.Context, tx *txw, l *Letter) error {
	for i := range l.Gifts {
		g := &l.Gifts[i]
		g.ID = security.NewID()
		g.LetterID = l.ID
		g.Position = i
		if _, err := tx.exec(ctx, `INSERT INTO gifts (id, letter_id, nombre, prioridad, marcado, position) VALUES (?, ?, ?, ?, ?, ?)`,
			g.ID, g.LetterID, g.Nombre, intPtr(g.Prioridad), b2i(g.Marcado), g.Position); err != nil {
			return err
		}
	}
	return nil
}

// SaveLetter actualiza todos los campos y, si replaceGifts, reemplaza los regalos.
func (s *Store) SaveLetter(ctx context.Context, l *Letter, replaceGifts bool) error {
	l.UpdatedAt = time.Now().UTC()
	tx, err := s.begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.exec(ctx, `UPDATE letters SET status = ?, mensaje = ?, texto_original = ?, texto_normalizado = ?,
		tono = ?, confianza = ?, metodo = ?, pii_masked = ?, image_path = ?, image_deleted_at = ?, updated_at = ? WHERE id = ?`,
		l.Status, l.Mensaje, l.TextoOriginal, l.TextoNormalizado, strPtr(l.Tono), floatPtr(l.Confianza), strPtr(l.Metodo),
		b2i(l.PIIMasked), strPtr(l.ImagePath), fmtTimePtr(l.ImageDeletedAt), fmtTime(l.UpdatedAt), l.ID)
	if err != nil {
		return err
	}
	if replaceGifts {
		if _, err := tx.exec(ctx, `DELETE FROM gifts WHERE letter_id = ?`, l.ID); err != nil {
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
	_, err := s.exec(ctx, `UPDATE letters SET status = ?, updated_at = ? WHERE id = ?`, status, fmtTime(time.Now()), id)
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
	rows, err := s.query(ctx, q+`) ORDER BY position`, args...)
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
	l, err := scanLetter(s.queryRow(ctx, `SELECT `+letterCols+` FROM letters l WHERE l.id = ?`, id))
	if err != nil {
		return nil, err
	}
	return l, s.loadGifts(ctx, []*Letter{l})
}

// OwnLetter devuelve la carta solo si es de un niño del usuario.
func (s *Store) OwnLetter(ctx context.Context, userID, letterID string) (*Letter, error) {
	l, err := scanLetter(s.queryRow(ctx, `SELECT `+letterCols+` FROM letters l JOIN children c ON c.id = l.child_id
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
	rows, err := s.query(ctx, q+` ORDER BY l.created_at DESC`, args...)
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
	return s.column(ctx, `SELECT id FROM letters WHERE status IN (?, ?) ORDER BY created_at`, StatusRecibida, StatusLeyendo)
}

func (s *Store) DeleteLetter(ctx context.Context, id string) error {
	_, err := s.exec(ctx, `DELETE FROM letters WHERE id = ?`, id)
	return err
}

// PurgeImages borra las fotos de cartas creadas antes de limit. Devuelve cuántas borró.
func (s *Store) PurgeImages(ctx context.Context, limit, now time.Time) (int, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	res, err := tx.exec(ctx, `UPDATE letters SET image_path = NULL, image_deleted_at = ? WHERE image_path IS NOT NULL AND created_at < ?`, fmtTime(now), fmtTime(limit))
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	if _, err := tx.exec(ctx, `DELETE FROM letter_images WHERE letter_id IN (SELECT id FROM letters WHERE image_path IS NULL)`); err != nil {
		return 0, err
	}
	return int(n), tx.Commit()
}
