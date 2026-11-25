# Plan — Buzón del Viejito Pascuero

## Arquitectura

```
┌──────────── frontend (Vite + React 18 + TS) ────────────┐
│ Landing ─ Escena 3D (R3F, lazy) ─ Editor/Subida carta    │
│ Panel de padres ─ Paradas (dnd-kit) ─ Transcripciones    │
│ Seguimiento (timeline + mapa Leaflet + flip-clock)       │
│ Zustand (luces, sesión, escena) · TanStack Query · RHF+Zod│
└───────────────┬──────────────────────────┬───────────────┘
           REST /api/*                 WS /ws/*
┌───────────────┴──────────────────────────┴───────────────┐
│ backend FastAPI (Python 3.12)                             │
│  api/ auth · children · letters · shipments · tracking    │
│  core/ config · security (argon2, JWT, CSRF) · ratelimit  │
│  services/ ocr (OpenCV + EasyOCR/Paddle/Tesseract)        │
│            vision_providers (TrOCR local | Gemini | Groq  │
│            | OpenRouter) · letter_pipeline · pii · tracking│
│  ws/ hub de eventos (memoria o Redis pub/sub)             │
└──────┬─────────────────────┬──────────────────────┬──────┘
   PostgreSQL            Redis (RQ + pub/sub)     worker (RQ)
```

- **Cola**: `TASK_BACKEND=rq` (Docker) encola en Redis y el worker publica eventos por Redis pub/sub; `TASK_BACKEND=inline` usa `BackgroundTasks` (desarrollo sin Redis).
- **Auto-avance de paradas**: tarea periódica en el `lifespan` de la API que marca como completadas las paradas con `auto_advance` cuya hora ya pasó y emite el evento.

## Modelo de datos

| Entidad | Campos clave |
|---|---|
| **User** | id, email (único), password_hash (argon2), display_name, allow_external_ai (consentimiento), created_at |
| **RefreshToken** | id (jti), user_id, expires_at, revoked |
| **Child** | id, user_id → User, nickname, age?, avatar (`duende_*`/`reno_*`) |
| **Letter** | id, child_id → Child, source (`escrita`/`foto`), status (`recibida`/`leyendo`/`leida`/`necesita_ayuda`), texto_original, texto_normalizado, tono, confianza, metodo (`ocr`/`ia`/`manual`), image_path?, image_deleted_at?, created_at |
| **Gift** | id, letter_id → Letter, nombre, prioridad?, marcado (el padre lo eligió) |
| **Shipment** | id, child_id → Child (1 por temporada), share_code (único, no adivinable), arrival_at (por defecto 25-12 00:00 America/Santiago) |
| **Stop** | id, shipment_id, position, nombre, icono, descripcion, lat?, lng?, eta, completed_at?, auto_advance |

Todas las consultas filtran por `user_id` a través de la relación (Child → User). Nunca se expone un id de otro usuario: se responde 404.

## Endpoints REST (`/api`)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | crea cuenta y abre sesión (cookies) |
| POST | `/auth/login` · `/auth/refresh` · `/auth/logout` | sesión con access + refresh en cookies httpOnly |
| GET/PATCH | `/auth/me` | perfil y consentimiento de IA externa |
| GET/POST | `/children` · PATCH/DELETE `/children/{id}` | perfiles de niños |
| POST | `/letters` (JSON, carta escrita) | crea y procesa |
| POST | `/letters/upload` (multipart) | foto o escaneo |
| GET | `/letters` · `/letters/{id}` | cartas del padre |
| PATCH | `/letters/{id}` | transcripción manual, marca regalos |
| DELETE | `/letters/{id}` | borra carta e imagen |
| GET | `/children/{id}/shipment` | crea si no existe |
| PATCH | `/shipments/{id}` | hora de llegada |
| POST | `/shipments/{id}/stops` · PATCH/DELETE `/stops/{id}` | paradas |
| PUT | `/shipments/{id}/stops/order` | reordenar |
| POST | `/shipments/{id}/stops/templates` | carga plantillas sugeridas |
| GET | `/tracking/{share_code}` | vista del niño (solo lectura) |
| GET | `/health` | estado |

## Eventos WebSocket

- `WS /ws/letters` (requiere cookie de sesión): `letter.status` `{id, status, mensaje}` → `recibida` → `leyendo` → `leida` | `necesita_ayuda`.
- `WS /ws/tracking/{share_code}`: `tracking.updated` `{shipment}` cada vez que cambia una parada o la hora de llegada; `tracking.stop_completed` `{stop}` dispara la celebración.
