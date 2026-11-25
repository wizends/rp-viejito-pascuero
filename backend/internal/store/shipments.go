package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/wizends/rp-viejito-pascuero/backend/internal/security"
)

type Stop struct {
	ID          string
	ShipmentID  string
	Position    int
	Nombre      string
	Icono       string
	Descripcion string
	Lat         *float64
	Lng         *float64
	ETA         *time.Time
	CompletedAt *time.Time
	AutoAdvance bool
}

type Shipment struct {
	ID        string
	ChildID   string
	ShareCode string
	ArrivalAt time.Time
	CreatedAt time.Time
	Stops     []Stop
}

func scanShipment(row interface{ Scan(...any) error }) (*Shipment, error) {
	var sh Shipment
	var arrival, created string
	if err := row.Scan(&sh.ID, &sh.ChildID, &sh.ShareCode, &arrival, &created); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	sh.ArrivalAt = parseTime(arrival)
	sh.CreatedAt = parseTime(created)
	return &sh, nil
}

const shipCols = `s.id, s.child_id, s.share_code, s.arrival_at, s.created_at`

func (s *Store) withStops(ctx context.Context, sh *Shipment, err error) (*Shipment, error) {
	if err != nil {
		return nil, err
	}
	rows, err := s.DB.QueryContext(ctx, `SELECT id, shipment_id, position, nombre, icono, descripcion, lat, lng, eta, completed_at, auto_advance
		FROM stops WHERE shipment_id = ? ORDER BY position`, sh.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	sh.Stops = []Stop{}
	for rows.Next() {
		var st Stop
		var lat, lng sql.NullFloat64
		var eta, done sql.NullString
		if err := rows.Scan(&st.ID, &st.ShipmentID, &st.Position, &st.Nombre, &st.Icono, &st.Descripcion, &lat, &lng, &eta, &done, &st.AutoAdvance); err != nil {
			return nil, err
		}
		if lat.Valid {
			st.Lat = &lat.Float64
		}
		if lng.Valid {
			st.Lng = &lng.Float64
		}
		st.ETA = parseTimePtr(eta)
		st.CompletedAt = parseTimePtr(done)
		sh.Stops = append(sh.Stops, st)
	}
	return sh, rows.Err()
}

// ShipmentForChild devuelve el trayecto del niño, creándolo con la llegada por defecto si no existe.
func (s *Store) ShipmentForChild(ctx context.Context, childID string, arrival time.Time) (*Shipment, error) {
	sh, err := scanShipment(s.DB.QueryRowContext(ctx, `SELECT `+shipCols+` FROM shipments s WHERE s.child_id = ?`, childID))
	if errors.Is(err, ErrNotFound) {
		now := time.Now().UTC()
		_, err = s.DB.ExecContext(ctx, `INSERT INTO shipments (id, child_id, share_code, arrival_at, created_at) VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(child_id) DO NOTHING`,
			security.NewID(), childID, security.RandomToken(12), fmtTime(arrival), fmtTime(now))
		if err != nil {
			return nil, err
		}
		sh, err = scanShipment(s.DB.QueryRowContext(ctx, `SELECT `+shipCols+` FROM shipments s WHERE s.child_id = ?`, childID))
	}
	return s.withStops(ctx, sh, err)
}

// OwnShipment devuelve el trayecto solo si es de un niño del usuario.
func (s *Store) OwnShipment(ctx context.Context, userID, id string) (*Shipment, error) {
	sh, err := scanShipment(s.DB.QueryRowContext(ctx, `SELECT `+shipCols+` FROM shipments s JOIN children c ON c.id = s.child_id
		WHERE s.id = ? AND c.user_id = ?`, id, userID))
	return s.withStops(ctx, sh, err)
}

func (s *Store) ShipmentByID(ctx context.Context, id string) (*Shipment, error) {
	sh, err := scanShipment(s.DB.QueryRowContext(ctx, `SELECT `+shipCols+` FROM shipments s WHERE s.id = ?`, id))
	return s.withStops(ctx, sh, err)
}

func (s *Store) ShipmentByCode(ctx context.Context, code string) (*Shipment, error) {
	sh, err := scanShipment(s.DB.QueryRowContext(ctx, `SELECT `+shipCols+` FROM shipments s WHERE s.share_code = ?`, code))
	return s.withStops(ctx, sh, err)
}

// ShipmentExists responde si hay un trayecto con ese código (para el WebSocket público).
func (s *Store) ShipmentExists(ctx context.Context, code string) bool {
	var one int
	return s.DB.QueryRowContext(ctx, `SELECT 1 FROM shipments WHERE share_code = ?`, code).Scan(&one) == nil
}

func (s *Store) SetArrival(ctx context.Context, id string, at time.Time) error {
	_, err := s.DB.ExecContext(ctx, `UPDATE shipments SET arrival_at = ? WHERE id = ?`, fmtTime(at), id)
	return err
}

// OwnStop devuelve la parada solo si es del usuario.
func (s *Store) OwnStop(ctx context.Context, userID, stopID string) (shipmentID string, err error) {
	err = s.DB.QueryRowContext(ctx, `SELECT st.shipment_id FROM stops st JOIN shipments s ON s.id = st.shipment_id
		JOIN children c ON c.id = s.child_id WHERE st.id = ? AND c.user_id = ?`, stopID, userID).Scan(&shipmentID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	return shipmentID, err
}

// AddStops agrega paradas al final del trayecto.
func (s *Store) AddStops(ctx context.Context, shipmentID string, start int, stops []Stop) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for i, st := range stops {
		if _, err := tx.ExecContext(ctx, `INSERT INTO stops (id, shipment_id, position, nombre, icono, descripcion, lat, lng, eta, completed_at, auto_advance)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
			security.NewID(), shipmentID, start+i, st.Nombre, st.Icono, st.Descripcion, floatPtr(st.Lat), floatPtr(st.Lng),
			fmtTimePtr(st.ETA), b2i(st.AutoAdvance)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) UpdateStop(ctx context.Context, st *Stop) error {
	_, err := s.DB.ExecContext(ctx, `UPDATE stops SET nombre = ?, icono = ?, descripcion = ?, lat = ?, lng = ?, eta = ?, completed_at = ?, auto_advance = ? WHERE id = ?`,
		st.Nombre, st.Icono, st.Descripcion, floatPtr(st.Lat), floatPtr(st.Lng), fmtTimePtr(st.ETA), fmtTimePtr(st.CompletedAt), b2i(st.AutoAdvance), st.ID)
	return err
}

// Reorder asigna posiciones según el orden de ids.
func (s *Store) Reorder(ctx context.Context, ids []string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for i, id := range ids {
		if _, err := tx.ExecContext(ctx, `UPDATE stops SET position = ? WHERE id = ?`, i, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// DeleteStop borra la parada y compacta las posiciones.
func (s *Store) DeleteStop(ctx context.Context, shipmentID, stopID string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `DELETE FROM stops WHERE id = ?`, stopID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE stops SET position = (SELECT COUNT(*) FROM stops s2
		WHERE s2.shipment_id = stops.shipment_id AND s2.position < stops.position) WHERE shipment_id = ?`, shipmentID); err != nil {
		return err
	}
	return tx.Commit()
}

// CompleteDue marca como completadas las paradas con auto-avance cuya hora pasó.
// Devuelve, por trayecto, las paradas recién completadas.
func (s *Store) CompleteDue(ctx context.Context, now time.Time) (map[string][]string, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(ctx, `SELECT id, shipment_id FROM stops WHERE auto_advance = 1 AND completed_at IS NULL AND eta IS NOT NULL AND eta <= ?`, fmtTime(now))
	if err != nil {
		return nil, err
	}
	due := map[string][]string{}
	var ids []string
	for rows.Next() {
		var id, sh string
		if err := rows.Scan(&id, &sh); err != nil {
			rows.Close()
			return nil, err
		}
		due[sh] = append(due[sh], id)
		ids = append(ids, id)
	}
	rows.Close()
	for _, id := range ids {
		if _, err := tx.ExecContext(ctx, `UPDATE stops SET completed_at = ? WHERE id = ?`, fmtTime(now), id); err != nil {
			return nil, err
		}
	}
	return due, tx.Commit()
}
