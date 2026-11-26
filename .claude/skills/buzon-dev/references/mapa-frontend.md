# Mapa del frontend — `frontend/src/`

Alias de import: `@/` = `frontend/src/`. Estado del servidor con **TanStack Query**; estado de UI global con **Zustand** (`stores/`).

## App y navegación

| Archivo | Qué hace |
| --- | --- |
| `main.tsx` | Monta `<App/>` en `StrictMode`; `watchForNewVersion()`. |
| `app/App.tsx` | `QueryClient`, `MotionConfig reducedMotion="user"`, **todas las rutas**. Páginas pesadas con `lazyPage(() => import(...))` (no uses `React.lazy` directo). Rutas privadas envueltas en `<RequireAuth>`. |
| `app/Layout.tsx` | Encabezado (escritorio: nav + palanca de luces + música + campanitas; <1024 px: música + botón Menú), transición entre páginas (`AnimatePresence` + `FrozenOutlet` + `RouteErrorBoundary`), pie y `Toaster`. |
| `app/MenuSheet.tsx` | Menú del celular/tablet (`<dialog>` animado): navegación + ambiente (luces, música, campanitas). Si agregas una página navegable, agrégala aquí **y** en el nav de `Layout.tsx`. |
| `features/auth/session.tsx` | `SessionBootstrap` (carga `/auth/me`, WebSocket de cartas, sondeo de estado) y `RequireAuth`. |

Rutas: `/` (LandingPage), `/entrar`, `/registro` (LoginPage), `/panel` (privada), `/postal/:letterId` (privada), `/seguimiento/:code` (pública, para el niño), `/privacidad`, `*` (404).

## Librerías propias (`lib/`)

| Archivo | Qué hace |
| --- | --- |
| `api.ts` | **Único cliente HTTP.** `request<T>(path, {method, json})` agrega CSRF, renueva sesión ante 401 y lanza `ApiError(status, detail)`. `image(path)` para descargar imágenes. Objeto `api` con un método por endpoint. |
| `types.ts` | Tipos que reflejan el JSON del backend (`User`, `Child`, `Letter`, `Stop`, `Shipment`, `Tracking`…). |
| `motion.ts` | Lenguaje de animación: `EASE_OUT/IN`, `fadeUp`, `pop`, `fade`, `listItem`, `cascade(stagger)`, `lifecycle`, `withDelay`; re-exporta `Collapse`, `Swap`, `Reveal` (de `components/ui/MotionBlocks.tsx`). |
| `lazyPage.ts` | `lazyPage` (recarga una vez si falta un chunk tras un despliegue) y `watchForNewVersion`. |
| `seo.ts` | `usePageSeo({title, description, noindex?, type?})` — **cada página nueva lo llama**. Las privadas con `noindex: true`. |
| `time.ts` | Cuenta regresiva, paradas actuales, ruta de vuelo del mapa, formato de fechas en zona de Chile. |
| `ws.ts` | `useSocket(path, onMessage, {public?})`. En Vercel solo conecta sockets públicos. |
| `music.ts` | Villancicos de dominio público y su motor WebAudio (`SONGS`, `MusicPlayer`). |
| `audio.ts` | Sonidos cortos (clic, campanitas). |
| `storage.ts` | `readJSON/writeJSON` a localStorage sin romper si falla. |
| `useReducedMotion.ts` | Preferencia de movimiento reducido. |

## Stores (`stores/`)

`session.ts` (usuario y `checked`), `lights.ts` (modo de luces y audio), `music.ts` (reproductor), `scene.ts` (máquina de estados de la cinemática 3D de la carta: idle → flying → caught → reading → celebrate/help).

## Funcionalidades (`features/`)

| Carpeta | Contenido |
| --- | --- |
| `letters/` | Escribir/subir carta en la portada: `LetterComposer` (pestañas), `WriteLetterForm`, `UploadLetterForm` (recorte con react-easy-crop), `ChildPicker`, `schemas.ts` (zod + `validateFile` + `looksSensitive`). |
| `parents/` | Panel: `PanelPage` (pestañas Cartas/Trayecto), `ChildrenManager`, `SettingsCard` (consentimiento IA), `LettersList` (carta, transcripción, regalos, botón "Crear postal"), `ShipmentEditor` (paradas con dnd-kit, llegada, enlace del niño), `TreePhotoCard`. |
| `tracking/` | Vista del niño: `TrackingPage`, `FlipClock`, `StagePanel` + `StageScene` (escena SVG animada por ícono de parada, CSS en `stages.css`), `Timeline`, `SleighMap` (Leaflet sin teselas: mapa ilustrado). |
| `selfie/` | Selfie del Viejito con el árbol: `compose.ts` (canvas: ubica, tiñe, sombra, grano, sello), `santa.ts` (SVG del Viejito), `SantaSelfie.tsx`. |
| `postcard/` | Editor de postal: `PostcardPage` (UI, arrastrar, guardar en la cuenta, compartir/descargar), `render.ts` (dibujo en canvas, `THEMES`, `FRAMES`, `FORMATS`, `defaultPostcard`, `hitTest`, `wrapText`), `decor.ts` (fondos y bordes extra), `stickers.ts` (SVG 100×100 + `STICKER_GROUPS`), `styles.ts` (estilos gráficos: fuentes y efectos por estilo), `fonts.css`. |

## Componentes compartidos (`components/ui/`)

`MagicButton` (variantes rojo/pino/oro/crema/fantasma), `SealButton` (botón lacre de enviar carta), `Field` (input accesible con error/hint), `Toast` (`toast(texto, 'ok'|'error'|'info')`), `Avatar`, `Icons` (`StopGlyph`, `SleighIcon`), `SleighLoader`, `PlugSwitch` (palanca de luces), `MusicControl` (`MusicControl`, `MusicQuickButton`, `MusicPanel`), `CssGarland`, `MotionBlocks`, `RouteErrorBoundary`, `SceneBoundary`.

`components/scene/` = escena 3D de la portada (React Three Fiber): `Scene.tsx` raíz, `Room`, `Fireplace`, `Props`, `Garlands`, `Outside`, `FlyingLetter`, personajes en `characters/`. Para trabajo 3D hay skills `threejs-*` en `.claude/skills/`.

## Estilo visual

- Tokens en `tailwind.config.ts` (colores como `var(--…)` definidos en `styles/index.css`): `rojo`, `rojo-baya`, `pino`, `muerdago`, `oro`, `oro-suave`, `crema`, `noche`, `noche-700`, `hielo`, `canela`, `tinta`, `tinta-suave`, `kraft`, `cielo`, `cielo-claro`, `turquesa`, `frambuesa`, `marino`.
- Fuentes: `font-cuento` (títulos de cuento), `font-display` (Baloo 2), `font-body` (Nunito), `font-mano` (Caveat).
- Superficies: `papel-crema`, `papel-kraft`, `rounded-galleta`, `shadow-papel`, `shadow-brillo`. Easing: `ease-rebote`, `ease-suave`.
- Toques ≥ 44 px, foco visible con `ring-oro`, textos accesibles (`aria-label` en botones de ícono).

## Build y despliegue

`package.json`: `dev`, `build` (tsc + vite + `scripts/seo.mjs` que genera `robots.txt`/`sitemap.xml`), `build:vercel` (+ `scripts/vercel-output.mjs`: proxy `/api` a `BACKEND_URL`, CSP, 404 para assets viejos, `index.html` sin caché), `test` (vitest), `lint`, `typecheck`. Docker usa `nginx.conf`.
