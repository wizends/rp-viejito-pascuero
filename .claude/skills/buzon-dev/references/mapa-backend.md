# Mapa del backend (Go) — `backend/`

Módulo: `github.com/wizends/rp-viejito-pascuero/backend` (go 1.26). Sin framework: `net/http` con patrones `"GET /api/x/{id}"`.

## Arranque

| Archivo | Qué hace |
| --- | --- |
| `cmd/server/main.go` | Lee config, abre la base (`store.Open(cfg.DBTarget())`), crea `api.New`, `Start` (trabajos de fondo) y `ListenAndServe`. Flag `-healthcheck` para Docker. En serverless exige PostgreSQL. |
| `internal/config/config.go` | Todas las variables de entorno → `Config`. Lee también `.env` y `../.env`. Ver lista abajo. |
| `Dockerfile` | Build en `golang:alpine` → imagen distroless (~25 MB). |
| `vercel.json` | Cron diario `GET /api/cron/tick`. |

Variables (en `config.go`): `PORT`, `ENVIRONMENT`, `DATA_DIR`, `DATABASE_URL`/`POSTGRES_URL`, `REDIS_URL`/`KV_URL`, `SERVERLESS` (por defecto `VERCEL=1`), `CRON_SECRET`, `CORS_ORIGINS`, `SECRET_KEY`, `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `RATE_LIMIT_*`, `TRUST_FORWARDED_FOR`, `MAX_UPLOAD_MB`, `RETENTION_DAYS`, `VISION_PROVIDER`, `GEMINI_*`/`GROQ_*`/`OPENROUTER_*`, `VISION_TIMEOUT_SECONDS`, `TIMEZONE`, `AUTO_ADVANCE_INTERVAL_SECONDS`. Toda variable nueva se documenta también en `.env.example` y en la tabla del `README.md`.

## `internal/api/` — HTTP

| Archivo | Contenido |
| --- | --- |
| `server.go` | `Server`, `New`, **todas las rutas** en `Handler()`, `Start` (cola de cartas, auto-avance, retención; no corre en serverless), `enqueue`. |
| `middleware.go` | Cabeceras de seguridad, CORS, límite por IP, **CSRF double-submit** (`X-CSRF-Token` = cookie `vp_csrf`), `clientIP`, `tooMany`, `limiter`. |
| `httpx.go` | `writeJSON`, `writeErr`, `errf(status, fmt)`, `invalid(fmt)` (=422), `decode(r, &v)` (JSON ≤1 MB), `Opt[T]` (distingue "no vino" de `null` en PATCH), `checkLen`, `runeLen`, `jsonTime`. |
| `auth.go` | Registro/login/refresh/logout/me. `s.authed(handler)` envuelve rutas privadas y entrega `*store.User`. Cookies: `vp_access`, `vp_refresh` (path `/api/auth`), `vp_csrf`. |
| `children.go` | CRUD de niños (máx. 12). `notFound(err)` traduce `store.ErrNotFound` → 404. |
| `letters.go` | Cartas escritas y con foto. `parseUpload` + `uploadedImage` (multipart + `imaging.Clean`) — **reutilízalos para cualquier subida**. `toLetterOut`. |
| `pipeline.go` | Procesa cartas (`processLetter`): enmascara datos sensibles, extrae regalos, IA opcional con consentimiento. `purgeExpiredImages` (retención). Publica `letter.status`. |
| `shipments.go` | Trayecto del regalo: plantillas de paradas (`templates`), CRUD de paradas, `publicTracking`, `advanceDueStops` (avance perezoso), `cronTick`, `broadcast` (eventos `tracking.updated`, `tracking.stop_completed`, `shipment.updated`). |
| `tree.go` | Foto del árbol (`PUT/GET/DELETE /api/shipments/{id}/tree`) y selfie pública tras la entrega (`delivered`). |
| `postcards.go` | Diseño de la postal por carta (`GET/PUT /api/letters/{id}/postcard`) con struct tipado + `validate()`. Buen ejemplo de "guardar JSON validado". |
| `ws.go` | WebSockets `/ws/letters` (privado) y `/ws/tracking/{code}` (público). Sin Redis en serverless cierra con 4410. |
| `*_test.go` | Tests de integración con servidor real (`newEnv`, `e.parent(email)`, `c.child(nick)`, `c.get/post/patch/put/delete`, `upload(fields, bytes)`, `testJPEG`). |

Rutas actuales (ver `server.go`): `/api/health`; `/api/auth/*`; `/api/children[/{id}]`; `/api/letters[/{id}][/image|/postcard]`, `/api/letters/upload`; `/api/children/{id}/shipment`; `/api/shipments/{id}[/stops|/stops/templates|/stops/order|/tree]`; `/api/stops/{id}`; `/api/tracking/{code}[/selfie]`; `/api/cron/tick`; `/ws/letters`; `/ws/tracking/{code}`.

Patrón de un handler privado (copia este):

```go
func (s *Server) getAlgo(w http.ResponseWriter, r *http.Request, u *store.User) {
	l, err := s.store.OwnLetter(r.Context(), u.ID, r.PathValue("id")) // siempre "Own*": filtra por dueño
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	var in struct{ Campo string `json:"campo"` }
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	if runeLen(in.Campo) > 60 {
		writeErr(w, invalid("El campo tiene máximo 60 letras."))
		return
	}
	writeJSON(w, http.StatusOK, algoOut{...})
}
// y en server.go: mux.HandleFunc("GET /api/letters/{id}/algo", s.authed(s.getAlgo))
```

## `internal/store/` — datos

| Archivo | Contenido |
| --- | --- |
| `store.go` | `Open(target)` (SQLite si es ruta, Postgres si es `postgres://`), helpers `s.exec/query/queryRow/begin` y `tx.exec/query` (escribe con `?`; se reescribe a `$n` en Postgres), `fmtTime/parseTime/parseTimePtr` (fechas como **texto UTC de ancho fijo**), `b2i`, `ErrNotFound`, usuarios, refresh tokens, niños (`OwnChild`, `ChildByID`). Esquema Postgres bajo `pg_advisory_lock`. |
| `schema_sqlite.sql` / `schema_postgres.sql` | Tablas: `users`, `refresh_tokens`, `children`, `letters`, `letter_images`, `gifts`, `shipments`, `stops`, `tree_photos`, `letter_postcards`. **Siempre iguales en ambos.** |
| `letters.go` | `CreateLetter`, `SaveLetter`, `OwnLetter`, `Letters`, `Image`, `PurgeImages`. |
| `shipments.go` | `Shipment` (con `HasTree`), `ShipmentForChild` (crea si no existe), `OwnShipment`, `ShipmentByCode`, paradas (`AddStops`, `UpdateStop`, `Reorder`, `DeleteStop`, `CompleteDue`). |
| `tree.go`, `postcards.go` | Upsert con `ON CONFLICT(...) DO UPDATE` (funciona en SQLite y Postgres). |
| `store_test.go` | Arranque concurrente en Postgres (`TEST_DATABASE_URL`). |

IDs: `security.NewID()`. Códigos aleatorios: `security.RandomToken(n)`.

## Otros paquetes

| Paquete | Para qué |
| --- | --- |
| `internal/security` | argon2id (compatible con el backend Python anterior), JWT HS256 propio, `NewID`, `RandomToken`. |
| `internal/hub` | Pub/sub de eventos en memoria + Redis opcional. `s.hub.Publish(canal, evento, datos)`; canales `user:<id>` y `track:<código>`. |
| `internal/imaging` | `Sniff` y `Clean(data, maxBytes)`: valida JPEG/PNG/WebP, endereza por EXIF, achica a 2400 px y re-codifica (quita metadatos). Error `*imaging.Error` (`Unsupported` → 415). |
| `internal/text` | `MaskPII` (RUT, teléfonos, correos, direcciones, colegios), `ExtractGifts`, `DetectTone`, `Truncate`. |
| `internal/vision` | Lectura opcional con IA (Gemini/Groq/OpenRouter); `New` devuelve nil sin API key. |

## Modo serverless (Vercel)

`cfg.Serverless`: sin goroutines de fondo; las cartas se procesan al subirse (`enqueue` inline), las paradas avanzan al consultarse (`advanceDueStops` en getShipment/publicTracking) y el cron diario limpia. **Cualquier trabajo "periódico" nuevo debe poder hacerse perezosamente o en `cronTick`.**
