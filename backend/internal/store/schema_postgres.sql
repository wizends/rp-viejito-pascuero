-- Esquema del buzón (PostgreSQL, p. ej. Neon en Vercel). Todo cuelga de users para aislar datos por cuenta.
-- Las fechas se guardan como texto UTC de ancho fijo (se pueden comparar como texto).
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  allow_external_ai INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_refresh_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  age INTEGER,
  avatar TEXT NOT NULL DEFAULT 'duende_rojo',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_children_user ON children(user_id);

CREATE TABLE IF NOT EXISTS letters (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  source TEXT NOT NULL,            -- escrita | foto
  status TEXT NOT NULL DEFAULT 'recibida',
  mensaje TEXT NOT NULL DEFAULT '',
  texto_original TEXT NOT NULL DEFAULT '',
  texto_normalizado TEXT NOT NULL DEFAULT '',
  tono TEXT,
  confianza DOUBLE PRECISION,
  metodo TEXT,                     -- escrita | ia | manual
  pii_masked INTEGER NOT NULL DEFAULT 0,
  image_path TEXT,                -- clave de la foto en letter_images (NULL = sin foto)
  image_deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_letters_child ON letters(child_id);
CREATE INDEX IF NOT EXISTS ix_letters_status ON letters(status);

-- La foto de la carta (JPEG limpio) vive en la base: privada y sin disco aparte.
CREATE TABLE IF NOT EXISTS letter_images (
  letter_id TEXT PRIMARY KEY REFERENCES letters(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  data BYTEA NOT NULL
);

CREATE TABLE IF NOT EXISTS gifts (
  id TEXT PRIMARY KEY,
  letter_id TEXT NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  prioridad INTEGER,
  marcado INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_gifts_letter ON gifts(letter_id);

CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL UNIQUE REFERENCES children(id) ON DELETE CASCADE,
  share_code TEXT NOT NULL UNIQUE,
  arrival_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stops (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  nombre TEXT NOT NULL,
  icono TEXT NOT NULL DEFAULT 'estrella',
  descripcion TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  eta TEXT,
  completed_at TEXT,
  auto_advance INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_stops_shipment ON stops(shipment_id);
CREATE INDEX IF NOT EXISTS ix_stops_due ON stops(auto_advance, completed_at, eta);
