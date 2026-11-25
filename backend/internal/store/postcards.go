package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// Postcard devuelve el diseño guardado de la postal de la carta (JSON) y cuándo cambió.
func (s *Store) Postcard(ctx context.Context, letterID string) (string, time.Time, error) {
	var design, updated string
	err := s.queryRow(ctx, `SELECT design, updated_at FROM letter_postcards WHERE letter_id = ?`, letterID).Scan(&design, &updated)
	if errors.Is(err, sql.ErrNoRows) {
		return "", time.Time{}, ErrNotFound
	}
	return design, parseTime(updated), err
}

// SavePostcard guarda (o reemplaza) el diseño de la postal.
func (s *Store) SavePostcard(ctx context.Context, letterID, design string, now time.Time) error {
	_, err := s.exec(ctx, `INSERT INTO letter_postcards (letter_id, design, updated_at) VALUES (?, ?, ?)
		ON CONFLICT(letter_id) DO UPDATE SET design = excluded.design, updated_at = excluded.updated_at`,
		letterID, design, fmtTime(now))
	return err
}
