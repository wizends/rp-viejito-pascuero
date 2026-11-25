// Package store guarda los datos en SQLite (un solo archivo, sin servidor aparte).
package store

import (
	"context"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // driver PostgreSQL
	_ "modernc.org/sqlite"             // driver SQLite en Go puro (sin cgo)

	"github.com/wizends/rp-viejito-pascuero/backend/internal/security"
)

var (
	//go:embed schema_sqlite.sql
	schemaSQLite string
	//go:embed schema_postgres.sql
	schemaPostgres string
)

// ErrNotFound indica que no existe o no pertenece al usuario.
var ErrNotFound = errors.New("no encontrado")

// timeLayout es UTC de ancho fijo: el orden de texto coincide con el orden temporal.
const timeLayout = "2006-01-02T15:04:05.000000000Z"

func fmtTime(t time.Time) string { return t.UTC().Format(timeLayout) }

func parseTime(s string) time.Time {
	t, err := time.Parse(timeLayout, s)
	if err != nil {
		t, _ = time.Parse(time.RFC3339Nano, s)
	}
	return t.UTC()
}

func fmtTimePtr(t *time.Time) any {
	if t == nil {
		return nil
	}
	return fmtTime(*t)
}

func parseTimePtr(s sql.NullString) *time.Time {
	if !s.Valid {
		return nil
	}
	t := parseTime(s.String)
	return &t
}

// Store accede a SQLite (local, Docker) o PostgreSQL (Neon en Vercel) con el mismo SQL.
type Store struct {
	DB       *sql.DB
	postgres bool
}

// IsPostgres indica si la base es PostgreSQL.
func IsPostgres(target string) bool {
	return strings.HasPrefix(target, "postgres://") || strings.HasPrefix(target, "postgresql://")
}

// Open abre la base y aplica el esquema. target es una URL postgres:// o la ruta de un archivo SQLite.
func Open(target string) (*Store, error) {
	if IsPostgres(target) {
		db, err := sql.Open("pgx", target)
		if err != nil {
			return nil, err
		}
		// funciones serverless: pocas conexiones por instancia (Neon usa un pooler)
		db.SetMaxOpenConns(5)
		db.SetConnMaxIdleTime(time.Minute)
		if _, err := db.Exec(schemaPostgres); err != nil {
			db.Close()
			return nil, fmt.Errorf("esquema: %w", err)
		}
		return &Store{DB: db, postgres: true}, nil
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
		return nil, err
	}
	dsn := "file:" + target + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_txlock=immediate"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(8)
	if _, err := db.Exec(schemaSQLite); err != nil {
		db.Close()
		return nil, fmt.Errorf("esquema: %w", err)
	}
	return &Store{DB: db}, nil
}

func (s *Store) Close() error { return s.DB.Close() }

// rb adapta los marcadores ? al formato de PostgreSQL ($1, $2…).
func (s *Store) rb(q string) string {
	if !s.postgres {
		return q
	}
	var b strings.Builder
	n := 0
	for _, r := range q {
		if r == '?' {
			n++
			b.WriteString("$" + strconv.Itoa(n))
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

func (s *Store) exec(ctx context.Context, q string, args ...any) (sql.Result, error) {
	return s.DB.ExecContext(ctx, s.rb(q), args...)
}

func (s *Store) query(ctx context.Context, q string, args ...any) (*sql.Rows, error) {
	return s.DB.QueryContext(ctx, s.rb(q), args...)
}

func (s *Store) queryRow(ctx context.Context, q string, args ...any) *sql.Row {
	return s.DB.QueryRowContext(ctx, s.rb(q), args...)
}

// txw es una transacción que también adapta los marcadores.
type txw struct {
	*sql.Tx
	s *Store
}

func (s *Store) begin(ctx context.Context) (*txw, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	return &txw{Tx: tx, s: s}, nil
}

func (t *txw) exec(ctx context.Context, q string, args ...any) (sql.Result, error) {
	return t.ExecContext(ctx, t.s.rb(q), args...)
}

func (t *txw) query(ctx context.Context, q string, args ...any) (*sql.Rows, error) {
	return t.QueryContext(ctx, t.s.rb(q), args...)
}

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}

// ---------- usuarios ----------

type User struct {
	ID              string
	Email           string
	PasswordHash    string
	DisplayName     string
	AllowExternalAI bool
	CreatedAt       time.Time
}

const userCols = `id, email, password_hash, display_name, allow_external_ai, created_at`

func scanUser(row interface{ Scan(...any) error }) (*User, error) {
	var u User
	var created string
	if err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.DisplayName, &u.AllowExternalAI, &created); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	u.CreatedAt = parseTime(created)
	return &u, nil
}

func (s *Store) CreateUser(ctx context.Context, email, hash, name string) (*User, error) {
	u := &User{ID: security.NewID(), Email: email, PasswordHash: hash, DisplayName: name, CreatedAt: time.Now().UTC()}
	_, err := s.exec(ctx, `INSERT INTO users (`+userCols+`) VALUES (?, ?, ?, ?, 0, ?)`,
		u.ID, u.Email, u.PasswordHash, u.DisplayName, fmtTime(u.CreatedAt))
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "unique") {
		return nil, ErrDuplicate
	}
	return u, err
}

// ErrDuplicate indica un email ya registrado.
var ErrDuplicate = errors.New("duplicado")

func (s *Store) UserByID(ctx context.Context, id string) (*User, error) {
	return scanUser(s.queryRow(ctx, `SELECT `+userCols+` FROM users WHERE id = ?`, id))
}

func (s *Store) UserByEmail(ctx context.Context, email string) (*User, error) {
	return scanUser(s.queryRow(ctx, `SELECT `+userCols+` FROM users WHERE email = ?`, email))
}

func (s *Store) UpdateUser(ctx context.Context, u *User) error {
	_, err := s.exec(ctx, `UPDATE users SET display_name = ?, allow_external_ai = ? WHERE id = ?`,
		u.DisplayName, b2i(u.AllowExternalAI), u.ID)
	return err
}

// ---------- refresh tokens ----------

func (s *Store) CreateRefresh(ctx context.Context, jti, userID string, expires time.Time) error {
	_, err := s.exec(ctx, `INSERT INTO refresh_tokens (id, user_id, expires_at, revoked) VALUES (?, ?, ?, 0)`,
		jti, userID, fmtTime(expires))
	return err
}

// RevokeRefresh revoca el token si estaba vigente; devuelve si lo hizo (rotación de un solo uso).
func (s *Store) RevokeRefresh(ctx context.Context, jti, userID string) (bool, error) {
	res, err := s.exec(ctx, `UPDATE refresh_tokens SET revoked = 1 WHERE id = ? AND user_id = ? AND revoked = 0`, jti, userID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n == 1, nil
}

// ---------- niños ----------

type Child struct {
	ID        string
	UserID    string
	Nickname  string
	Age       *int
	Avatar    string
	CreatedAt time.Time
}

const childCols = `id, user_id, nickname, age, avatar, created_at`

func scanChild(row interface{ Scan(...any) error }) (*Child, error) {
	var c Child
	var age sql.NullInt64
	var created string
	if err := row.Scan(&c.ID, &c.UserID, &c.Nickname, &age, &c.Avatar, &created); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if age.Valid {
		a := int(age.Int64)
		c.Age = &a
	}
	c.CreatedAt = parseTime(created)
	return &c, nil
}

func intPtr(p *int) any {
	if p == nil {
		return nil
	}
	return *p
}

func (s *Store) Children(ctx context.Context, userID string) ([]*Child, error) {
	rows, err := s.query(ctx, `SELECT `+childCols+` FROM children WHERE user_id = ? ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*Child{}
	for rows.Next() {
		c, err := scanChild(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) CountChildren(ctx context.Context, userID string) (int, error) {
	var n int
	err := s.queryRow(ctx, `SELECT COUNT(*) FROM children WHERE user_id = ?`, userID).Scan(&n)
	return n, err
}

func (s *Store) CreateChild(ctx context.Context, c *Child) error {
	c.ID = security.NewID()
	c.CreatedAt = time.Now().UTC()
	_, err := s.exec(ctx, `INSERT INTO children (`+childCols+`) VALUES (?, ?, ?, ?, ?, ?)`,
		c.ID, c.UserID, c.Nickname, intPtr(c.Age), c.Avatar, fmtTime(c.CreatedAt))
	return err
}

// OwnChild devuelve el niño solo si pertenece al usuario.
func (s *Store) OwnChild(ctx context.Context, userID, childID string) (*Child, error) {
	return scanChild(s.queryRow(ctx, `SELECT `+childCols+` FROM children WHERE id = ? AND user_id = ?`, childID, userID))
}

func (s *Store) ChildByID(ctx context.Context, id string) (*Child, error) {
	return scanChild(s.queryRow(ctx, `SELECT `+childCols+` FROM children WHERE id = ?`, id))
}

func (s *Store) UpdateChild(ctx context.Context, c *Child) error {
	_, err := s.exec(ctx, `UPDATE children SET nickname = ?, age = ?, avatar = ? WHERE id = ?`,
		c.Nickname, intPtr(c.Age), c.Avatar, c.ID)
	return err
}

// DeleteChild borra el niño y, en cascada, sus cartas, fotos, regalos y trayecto.
func (s *Store) DeleteChild(ctx context.Context, childID string) error {
	_, err := s.exec(ctx, `DELETE FROM children WHERE id = ?`, childID)
	return err
}

func (s *Store) column(ctx context.Context, q string, args ...any) ([]string, error) {
	rows, err := s.query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
