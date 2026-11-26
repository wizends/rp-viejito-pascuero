# Recetas paso a paso

Cada receta indica qué archivo abrir, qué ejemplo copiar y cómo verificar. Hazlas **en orden**; no te saltes los tests.

---

## 1. Feature completa con datos nuevos (tabla + API + UI)

Ejemplo real a imitar: **postal guardada en la cuenta** (`backend/internal/store/postcards.go`, `backend/internal/api/postcards.go`, `postcards_test.go`, `frontend/src/lib/api.ts` → `postcard/savePostcard`).

1. **Esquema** — agrega la tabla al final de `backend/internal/store/schema_sqlite.sql` y `schema_postgres.sql`:
   ```sql
   -- Qué guarda y por qué (una línea en español).
   CREATE TABLE IF NOT EXISTS cosa (
     letter_id TEXT PRIMARY KEY REFERENCES letters(id) ON DELETE CASCADE,
     dato TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   ```
   Diferencias: `BLOB`→`BYTEA`, `REAL`→`DOUBLE PRECISION`. Booleanos como `INTEGER` (0/1) en ambas. Fechas como `TEXT` con `fmtTime`.
   Cuelga todo de un dueño con `ON DELETE CASCADE` para que borrar el niño/carta borre lo suyo.
2. **Store** — crea `backend/internal/store/cosa.go` copiando `postcards.go`: funciones `Cosa(ctx, id)` (devuelve `ErrNotFound` con `sql.ErrNoRows`) y `SaveCosa(ctx, ...)` con `INSERT ... ON CONFLICT(col) DO UPDATE SET ...`. Usa `s.exec/s.queryRow` con `?`.
3. **API** — crea `backend/internal/api/cosa.go`:
   - Struct de entrada **tipado** (nunca guardes JSON arbitrario del cliente) + método `validate()` con límites (`runeLen`, rangos, `regexp` para ids).
   - Handlers `func (s *Server) getCosa(w, r, u *store.User)` usando `s.store.Own*` para comprobar dueño → `notFound(err)` si no.
   - Registra rutas en `server.go` → `Handler()` junto a las del mismo recurso: `mux.HandleFunc("PUT /api/letters/{id}/cosa", s.authed(s.putCosa))`.
   - Si el niño debe ver un cambio en vivo, llama `s.broadcast(ctx, sh)` (trayecto) o `s.hub.Publish("user:"+userID, "evento", datos)`.
4. **Test backend** — `backend/internal/api/cosa_test.go` copiando `postcards_test.go`: caso feliz, otro padre recibe 404, validaciones 422, borrado en cascada.
5. **Cliente** — en `frontend/src/lib/types.ts` el tipo; en `frontend/src/lib/api.ts` los métodos (`request<T>('/letters/${id}/cosa', { method: 'PUT', json: {...} })`).
6. **UI** — `useQuery({ queryKey: ['cosa', id], queryFn: () => api.cosa(id) })` y `useMutation` con `onSuccess` que actualiza la caché (`qc.setQueryData`) o invalida (`qc.invalidateQueries`). Errores → `toast(e.message, 'error')`.
7. **Verifica** — receta de `verificacion.md` (Go en SQLite y, si tocaste SQL, en Postgres) + typecheck/test/lint/build + navegador.
8. **Documenta** en `README.md` (sección del tema) si es una feature visible.

---

## 2. Subir una imagen

Copia `putTreePhoto` en `backend/internal/api/tree.go`:
```go
if !s.limitUpload(r, u.ID) { s.tooMany(w, nil); return }
if !s.parseUpload(w, r) { return }
defer r.MultipartForm.RemoveAll()
clean, ok := s.uploadedImage(w, r, "Falta la foto.")   // valida tipo, quita EXIF/GPS, achica
if !ok { return }
// guardar clean.Data como BLOB/BYTEA ("image/jpeg")
```
Frontend: achica en el navegador antes de subir (ver `toJpeg` en `features/parents/TreePhotoCard.tsx`) y envía `FormData` con `request(path, { method: 'PUT', body: fd })`. Límite en Vercel: 4.5 MB por petición (`MAX_UPLOAD_MB=4`). Recuerda la retención: agrega el borrado de lo vencido en `purgeExpiredImages` (`pipeline.go`).

---

## 3. Página nueva

1. Crea `frontend/src/features/<area>/MiPagina.tsx` con `export default function MiPagina()`.
2. Llama `usePageSeo({ title: \`Título · ${SITE_NAME}\`, description: '...', noindex: true /* si es privada */ })`.
3. Estructura con animación de entrada:
   ```tsx
   <motion.div initial="hidden" animate="shown" variants={cascade(0.08)} className="mx-auto max-w-6xl px-4 py-6">
     <motion.h1 variants={fadeUp} className="font-cuento text-4xl text-marino sm:text-5xl">…</motion.h1>
     …
   </motion.div>
   ```
   Si tiene estados carga/error/contenido, **todas las ramas devuelven `<Swap id=...>`** como raíz (así se cruzan; ver `TrackingPage.tsx`).
4. En `app/App.tsx`: `const MiPagina = lazyPage(() => import('@/features/<area>/MiPagina'));` y `<Route path="mi-ruta" element={<MiPagina />} />` (envuelta en `<RequireAuth>` si es privada).
5. Enlázala en `app/Layout.tsx` (nav de escritorio) **y** en `app/MenuSheet.tsx` (`MenuLink` con ícono de lucide y una línea de ayuda).
6. Si es pública e indexable, revisa `frontend/scripts/site.mjs`/`seo.mjs` (sitemap).

---

## 4. Sección o tarjeta nueva en el panel de padres

- Pestañas del niño: `features/parents/PanelPage.tsx` (array `['cartas', ...]`, la pastilla activa usa `layoutId="panel-seccion"`).
- Bloques del trayecto: `features/parents/ShipmentEditor.tsx` (envuelve el bloque nuevo en `<motion.div variants={fadeUp}>` dentro de la cascada).
- Por carta: `features/parents/LettersList.tsx` (`LetterCard`).
- Usa `papel-crema rounded-galleta p-4 shadow-papel` como contenedor y `MagicButton` para acciones.

---

## 5. Cosas de la vista del niño (`/seguimiento/:code`)

- Datos públicos salen de `publicView` en `backend/internal/api/shipments.go` (`trackingOut`). **Solo** apodo, avatar, paradas y banderas no sensibles. Nada de ids del padre ni correos.
- Si agregas un campo: struct `trackingOut` + `Tracking` en `types.ts`.
- Ícono de parada nuevo: `stopIcons` en `shipments.go`, `STOP_ICONS` en `types.ts`, glifo en `components/ui/Icons.tsx` (`StopGlyph`, `STOP_ICON_LABELS`) y escena en `features/tracking/StageScene.tsx` (+ keyframes `.et-*` en `stages.css`, desactivadas con reduced-motion).

---

## 6. Postal: sticker, fondo, borde o estilo

- **Sticker**: agrega una entrada en `STICKERS` de `features/postcard/stickers.ts` (SVG en viewBox 100×100, colores sólidos, sin texto) y su id en un grupo de `STICKER_GROUPS`. Test `render.test.ts` comprueba que todos aparecen una vez y son SVG válidos.
- **Fondo**: entrada en `THEMES` (`render.ts`, con `title`, `sign`, `halo` claro/oscuro y `swatch` CSS) + rama en `drawThemeBackground` (`decor.ts`).
- **Borde**: entrada en `FRAMES` (`render.ts`) + rama en `drawFrame` (`decor.ts`; usa `along()`/`borderPoint()`).
- **Estilo gráfico**: `STYLES` y `FONTS` en `styles.ts` + ramas en `styleBackground`, `styleOverlay`, `styledSticker`, `drawStyledText`. Fuente nueva: `npm install @fontsource/<fuente>`, import solo latín en `postcard/fonts.css`, agrégala a `STYLE_FONT_FACES`.
- El backend valida ids con `^[a-z][a-z0-9_]{0,31}$`: usa ids en minúsculas con guion bajo.

---

## 7. Villancico nuevo

Solo melodías de **dominio público** (autor fallecido hace >70 años o tradicional). En `frontend/src/lib/music.ts` → `SONGS`: `melody` con `n('E5:1 D5:0.5 …')` (nota:pulsos, `r` = silencio), `chords` con **un acorde por compás**, `beatsPerBar`, `pickup` si hay anacrusa. `music.test.ts` falla si los compases no cuadran: así se detectan errores de transcripción.

---

## 8. Variable de entorno nueva

Backend: campo en `Config` y lectura en `config.go` (patrón de las demás) → `.env.example` → tabla en `README.md` (sección Vercel/Docker). Frontend: debe empezar con `VITE_`, se lee con `import.meta.env.VITE_X`, se declara en `src/vite-env.d.ts` si hace falta tipo, y si afecta la CSP o el build de Vercel revisa `scripts/vercel-output.mjs`.

---

## 9. Animar algo

- Aparece/desaparece: envuélvelo en `<AnimatePresence>` y usa `motion.*` con `{...lifecycle} variants={pop|fadeUp}` y una `key` estable.
- Mostrar/ocultar con altura: `<Collapse show={cond}>…</Collapse>`.
- Cambiar un contenido por otro en el mismo lugar: `<Swap id={estado}>…</Swap>`.
- Opción seleccionada que se desliza: `{activo && <motion.span layoutId="nombre-unico" className="absolute inset-0 rounded-full bg-oro" />}` + contenido en `<span className="relative">`.
- Listas: contenedor `variants={cascade(0.05)}`, hijos `variants={listItem}` con `layout`.
- Respeta `MotionConfig reducedMotion="user"` (ya está global); animaciones CSS nuevas necesitan su `@media (prefers-reduced-motion: reduce)`.

---

## 10. Bug "algo no se ve / no carga"

1. Reproduce en el navegador con la consola abierta (`read_console_messages`).
2. Revisa las trampas (`trampas.md`): opacidad Tailwind con colores `var()`, `transform` pisado por Framer, pestaña en segundo plano que congela animaciones, `Swap` que monta tarde y un efecto que ya corrió sin el elemento, chunk viejo tras despliegue.
3. Arregla la causa, agrega un test si es lógica pura, y verifica de nuevo.
