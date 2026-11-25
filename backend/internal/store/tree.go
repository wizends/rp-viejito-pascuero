package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// SetTreePhoto guarda (o reemplaza) la foto del árbol del trayecto.
func (s *Store) SetTreePhoto(ctx context.Context, shipmentID, ctype string, data []byte, now time.Time) error {
	_, err := s.exec(ctx, `INSERT INTO tree_photos (shipment_id, content_type, data, created_at) VALUES (?, ?, ?, ?)
		ON CONFLICT(shipment_id) DO UPDATE SET content_type = excluded.content_type, data = excluded.data, created_at = excluded.created_at`,
		shipmentID, ctype, data, fmtTime(now))
	return err
}

// TreePhoto devuelve la foto del árbol del trayecto.
func (s *Store) TreePhoto(ctx context.Context, shipmentID string) ([]byte, string, error) {
	var data []byte
	var ctype string
	err := s.queryRow(ctx, `SELECT data, content_type FROM tree_photos WHERE shipment_id = ?`, shipmentID).Scan(&data, &ctype)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, "", ErrNotFound
	}
	return data, ctype, err
}

func (s *Store) DeleteTreePhoto(ctx context.Context, shipmentID string) error {
	_, err := s.exec(ctx, `DELETE FROM tree_photos WHERE shipment_id = ?`, shipmentID)
	return err
}

// PurgeTreePhotos borra las fotos de árbol subidas antes de limit (retención).
func (s *Store) PurgeTreePhotos(ctx context.Context, limit time.Time) (int, error) {
	res, err := s.exec(ctx, `DELETE FROM tree_photos WHERE created_at < ?`, fmtTime(limit))
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}
