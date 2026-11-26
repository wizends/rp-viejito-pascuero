---
name: buzon-dev
description: Guía para editar el repo "Buzón del Viejito Pascuero" (backend Go + frontend React/Vite). Úsala SIEMPRE antes de agregar features, corregir bugs o tocar cualquier archivo de este repo: trae el mapa de dónde está cada cosa, recetas paso a paso (endpoint nuevo, tabla nueva, página nueva, sección del panel, sticker/fondo/borde/estilo de la postal, villancico, variable de entorno, animaciones, SEO), las trampas ya conocidas y cómo verificar. Pensada para que un modelo con poco contexto resuelva tareas complejas sin adivinar.
---

# Buzón del Viejito Pascuero — cómo trabajar en este repo

App para niños chilenos: escriben (o fotografían) su carta al Viejito Pascuero, los padres la gestionan en un panel, arman el "trayecto del regalo" con paradas y el niño lo sigue por un enlace público. Extras: selfie del Viejito con la foto del árbol, postal navideña para redes, música, escena 3D.

- `backend/` — Go 1.26 (net/http, sin framework). SQLite en local/Docker, PostgreSQL (Neon) en Vercel. Redis opcional.
- `frontend/` — React 18 + Vite + TypeScript + Tailwind + TanStack Query + Zustand + Framer Motion + React Three Fiber.
- Todo el texto de la UI, comentarios y mensajes de commit van **en español de Chile**, tono cálido y para niños.

## Reglas de oro (no las rompas)

1. **Lee antes de escribir.** Abre el archivo que vas a cambiar y uno "hermano" que ya haga algo parecido; copia su patrón. Los mapas te dicen cuál.
2. **El contrato API no cambia sin tocar los dos lados.** Errores siempre `{"detail": "texto en español"}`. Si agregas un campo JSON en Go, agrégalo en `frontend/src/lib/types.ts` y en `frontend/src/lib/api.ts`.
3. **Esquema en DOS archivos.** Toda tabla/columna nueva va en `backend/internal/store/schema_sqlite.sql` **y** `schema_postgres.sql` (BLOB↔BYTEA, REAL↔DOUBLE PRECISION). Usa `CREATE TABLE IF NOT EXISTS`; no hay migraciones, el esquema se aplica al arrancar.
4. **Privacidad de niños.** Nunca expongas datos del padre en rutas públicas (`/api/tracking/...`). Imágenes subidas pasan por `imaging.Clean` (quita EXIF/GPS). Texto libre de cartas pasa por `text.MaskPII`. Todo recurso privado se busca con `Own*` del store (filtra por usuario).
5. **Toda ruta que escribe exige CSRF** (lo hace el middleware); el frontend lo manda solo vía `request()` de `lib/api.ts`. No uses `fetch` directo para la API salvo imágenes (`image()` ya existe).
6. **Tests antes de decir "listo".** Backend: `go test ./...` (en Docker). Frontend: `npm run typecheck && npm test && npm run lint && npm run build`. Si tocas UI, míralo en el navegador (ver `references/verificacion.md`).
7. **No hagas commit ni push** salvo que el usuario lo pida explícitamente en ese mensaje. Nunca subas `.env`, `backend/data/`, `frontend/.vercel/`.
8. **Animaciones**: usa los bloques de `@/lib/motion` (`Collapse`, `Swap`, `Reveal`, variantes `fadeUp`/`pop`/`listItem`). No mezcles clases `hover:scale-*`/`scale-*` de Tailwind en un elemento `motion.*` (Framer pisa el `transform`).

## Flujo de trabajo

1. Ubica la zona en el mapa:
   - Backend → `references/mapa-backend.md`
   - Frontend → `references/mapa-frontend.md`
2. Busca la receta que se parezca a tu tarea en `references/recetas.md` y síguela en orden (cada paso dice archivo y qué copiar).
3. Antes de editar, revisa `references/trampas.md` (errores que ya costaron horas: Tailwind con opacidad, Framer, Windows/Docker, Vercel).
4. Verifica con `references/verificacion.md` y reporta qué probaste y qué no.

## Comandos rápidos

```powershell
# Frontend (desde frontend/)
npm run typecheck; npm test; npm run lint; npm run build

# Backend (desde backend/, en PowerShell; Go corre en Docker porque no está instalado en Windows)
docker run --rm -v "${PWD}:/src" -v gomodcache:/go/pkg/mod -w /src golang:alpine sh -c "gofmt -l . ; go vet ./... && go test ./..."
```

Servidores de desarrollo (desde la pestaña del navegador de Claude): `preview_start` con nombre `buzon-backend` (Docker, puerto 8010) y `buzon-frontend` (Vite, puerto 5183, hace proxy de `/api` al 8010).

## Cuándo pedir ayuda al usuario

Pregunta solo si la decisión es de producto (texto público nuevo, borrar datos, cambiar precios/infra, exponer algo en la vista pública del niño). Lo técnico decídelo tú siguiendo los patrones existentes.
