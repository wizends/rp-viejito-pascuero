# Buzón del Viejito Pascuero

Web navideña chilena donde niños y niñas le escriben al **Viejito Pascuero**. Un taller 3D del Polo Norte, cálido y de cuento ilustrado, muestra al Viejito, cinco duendes y tres renos recibiendo cada carta. Las cartas se escriben en la web o se mandan como foto de una hoja de verdad: la foto llega tal cual (limpia de metadatos) y, solo si la familia lo acepta, un modelo de IA gratuito transcribe la letra y arma la lista de regalos. Los papás, mamás y tutores siguen el viaje del regalo parada por parada, en tiempo real.

![Landing en escritorio](docs/capturas/landing-escritorio.png)

| Móvil | Seguimiento del regalo |
|---|---|
| ![Landing en móvil](docs/capturas/landing-movil.png) | ![Vista de seguimiento](docs/capturas/seguimiento.png) |

## Levantar todo con un comando

```bash
cp .env.example .env      # en Windows: copy .env.example .env
docker compose up --build
```

Luego abre **http://localhost:8080**. Docker levanta dos servicios: `frontend` (nginx con la web) y `backend` (API en Go, unos 25 MB). La base SQLite y las fotos de las cartas viven en el volumen `datos`.

## Publicar en Vercel

Vercel sirve la web (React/Vite). El backend en Go necesita un disco persistente (SQLite y fotos) y WebSockets, así que va en un servicio de contenedores con volumen: Fly.io, Railway, Render (plan con disco) o un VPS, usando `backend/Dockerfile`.

1. **Importa el repo** en Vercel y, cuando detecte dos carpetas, elige solo **`frontend`** (Root Directory = `frontend`). `frontend/vercel.json` ya define la instalación y el build.
2. **Variables de entorno en Vercel** (Settings → Environment Variables):

   | Variable | Ejemplo | Para qué |
   | --- | --- | --- |
   | `BACKEND_URL` | `https://api.tudominio.cl` | Vercel reenvía `/api/*` a esta URL (proxy). El navegador ve un solo origen, así las cookies de sesión y el CSRF funcionan igual que en Docker. Sin ella la web queda en **modo vitrina**: la escena 3D y la demo de la carta funcionan, `/api` responde 503. |
   | `VITE_WS_URL` | `wss://api.tudominio.cl` | Vercel no reenvía WebSockets: el seguimiento en vivo se conecta directo al backend. Se agrega solo a la CSP. |
   | `VITE_MAP_TILES_URL` | (opcional) | Teselas del mapa del trineo. |

3. **Variables del backend** (donde lo publiques): `ENVIRONMENT=production`, `SECRET_KEY` fuerte, `COOKIE_SECURE=true`, `CORS_ORIGINS=https://tu-proyecto.vercel.app` (también lo usa el WebSocket para validar el origen), `DATA_DIR` apuntando al volumen y `TRUST_FORWARDED_FOR=true` para que el rate limit vea la IP real de cada visitante y no la de Vercel. Activa esa última solo si el backend no queda expuesto directo a internet sin pasar por Vercel.

Cómo funciona: el build (`npm run build:vercel`) compila con Vite y luego corre `frontend/scripts/vercel-output.mjs`, que arma `frontend/.vercel/output` (Build Output API): rutas de la SPA, las mismas cabeceras de seguridad que `nginx.conf`, caché larga para `/assets` y el proxy de `/api`. Como la cookie de sesión es del dominio de Vercel y no viaja al WebSocket del backend, el estado de una carta recién enviada también se consulta cada 3 s mientras el Viejito la lee (`usePollLetterStatus` en `features/auth/session.tsx`); en Docker el WebSocket sigue siendo la vía principal. El navegador recorta y achica la foto a JPEG (lado mayor 2400 px) antes de subirla, así pesa poco al pasar por el proxy.

Para revisar la salida en local: `cd frontend && npm run build:vercel`.

## Desarrollo local (sin Docker)

**Backend** (Go 1.26 o superior, sin cgo ni servicios externos):

```bash
cd backend
go run ./cmd/buzon        # http://localhost:8000 · lee ../.env · datos en backend/data/
```

Sin Go instalado: `docker run --rm -p 8000:8000 -v "$PWD/backend:/src" -w /src -e DATA_DIR=/src/data golang:alpine go run ./cmd/buzon`.

**Frontend:**

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173 (proxy /api y /ws → :8000)
```

Si el backend corre en otro puerto, crea `frontend/.env.local` con `API_TARGET=http://localhost:8010`.

## Calidad

| Comando | Qué revisa |
|---|---|
| `cd backend && go test ./...` | auth (argon2id compatible con el backend anterior, JWT, rotación de refresh), CSRF, CORS, rate limit y `X-Forwarded-For`, permisos entre cuentas, cartas escritas y con foto, IA de visión simulada (con y sin consentimiento, dibujo sin texto, proveedor caído), EXIF/GPS, retención, trayecto y auto-avance, WebSockets |
| `cd backend && go test -race ./...` | lo mismo con el detector de carreras (requiere cgo) |
| `cd backend && go vet ./...` | análisis estático |
| `cd frontend && npm test` | 45 tests de Vitest y Testing Library: stores, luces, tiempos, formulario de carta, interruptor accesible, geometría del Viejito, cinta mágica y entrega de la carta |
| `cd frontend && npm run lint && npm run typecheck` | ESLint (con jsx-a11y) y TypeScript strict |

## Gráficos 3D: skills y validación

El pack [Three.js Awesome Graphics Agent Skills](https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills) (MIT, commit `53eb5a2`) se usó en local desde `.claude/skills/` (no se sube al repo por su peso). Lo que se aplicó a la escena:

- **Exposición y color:** un solo dueño del tone mapping, Neutral (Khronos), que conserva la paleta plana. Lo aplica el renderer cuando no hay postprocesado y el efecto final cuando sí; así la imagen no cambia al bajar la calidad.
- **Bloom:** se calcula en HDR antes del tone mapping, con umbral 1,2 y una jerarquía de emisión con nombre (`EMISSION` en `components/scene/kit.ts`). Solo brillan las ampolletas, la nariz del reno, la cinta dorada y su polvo de estrellas, y la estrella del árbol.
- **Cámara:** riel entre dos planos con una sola etapa de interpolación (resorte críticamente amortiguado y bloqueo exacto al llegar). El parallax va aparte y acotado.
- **Animación procedural:** todo se mueve con `dt` acotado (estable tras suspender la pestaña) y con azar sembrado.

Controles de validación visual por URL (`components/scene/debug.ts`):

| Parámetro | Efecto |
|---|---|
| `?seed=7` | semilla de nieve, polvo de estrellas y orejas |
| `?post=off` | línea base sin postprocesado |
| `?t=4` | congela el reloj de la escena en ese segundo |
| `?quality=0\|1\|2` | fuerza el nivel de calidad |
| `?shot=santa\|santa34\|santaside` | vista fija de inspección del Viejito |

Ejemplo: `/?seed=7&t=4` y `/?seed=7&t=4&post=off` deben verse iguales salvo el brillo del bloom.

## Arquitectura

El plan original, con modelo de datos, endpoints y eventos, está en [docs/PLAN.md](docs/PLAN.md) (escrito para el backend Python anterior; las rutas y los datos se mantienen).

```
frontend/src
  app/              router, layout (guirnalda CSS, interruptor de luces, audio)
  components/scene  escena R3F: sala, chimenea (shader), cielo de día con nubes (shader), nieve instanciada,
                    guirnaldas (1 InstancedMesh + 3 PointLights), Viejito, duendes, renos,
                    cinemática de la carta, cinta dorada mágica, cámara con riel y parallax
  components/ui     botón mágico, sobre lacrado, palanca de luces, loader del trineo, íconos propios
  features/         letters · auth · parents · tracking
  stores/           Zustand: luces (persistidas), escena (máquina de estados), sesión
backend/            Go, un solo binario estático
  cmd/buzon         main: servidor HTTP, apagado ordenado y -healthcheck para Docker
  internal/api      rutas (net/http), middleware (cabeceras, CORS, rate limit, CSRF), sesión,
                    niños, cartas y su cola de procesamiento, trayecto y auto-avance, WebSockets
  internal/store    SQLite (modernc.org/sqlite, Go puro) con el esquema embebido
  internal/security argon2id (formato PHC) y JWT HS256
  internal/imaging  tipo real por magic bytes, orientación EXIF, achicado y re-codificación sin metadatos
  internal/vision   IA de visión opcional: Gemini y API tipo OpenAI (Groq, OpenRouter)
  internal/text     datos sensibles, regalos, ortografía y tono
  internal/hub      reparto de eventos en tiempo real
```

### Cartas

1. **Escrita en la web:** deseos y mensaje. Se tapan los datos sensibles y, si no hay lista de deseos, los regalos se sacan del mensaje ("quiero una pelota y un auto"). Queda leída al instante.
2. **Foto de una hoja de verdad (JPG, PNG o WebP, máx. 10 MB):** se valida el tipo real por *magic bytes*, se endereza según su orientación EXIF, se achica a 2400 px y se vuelve a codificar desde los píxeles, lo que elimina EXIF y GPS. **No hay OCR:** la foto es la carta y llega como leída.
3. **IA de visión (opcional):** si hay `VISION_PROVIDER` con API key **y** el adulto activó la casilla en su panel, un modelo con capa gratuita (Gemini, Groq u OpenRouter) transcribe la letra, la corrige y arma la lista de regalos. Si el modelo no confía en su lectura (por ejemplo, es solo un dibujo) o el proveedor falla, la carta queda solo como imagen.
4. **Datos sensibles:** RUT, teléfonos, correos, direcciones y colegios se reemplazan por `[🔒 dato protegido]`, también en lo que lea la IA.
5. **Transcripción a mano:** el adulto puede escribir el texto y los regalos desde el panel cuando quiera.
6. **Tiempo real:** cada cambio de estado (`recibida → leyendo → leida`) se emite por WebSocket y la escena 3D reacciona. Si el backend se reinicia, retoma las cartas a medio procesar.

## Decisiones (y por qué)

Cuando el brief era ambiguo, elegimos la opción más tierna, accesible y segura para niños:

- **Backend en Go, sin OCR.** El backend Python con EasyOCR/TrOCR pesaba unos 3 GB y necesitaba PostgreSQL, Redis y un worker. El de Go es un binario de unos 25 MB con SQLite embebido: arranca en milisegundos y se publica en cualquier servicio con un volumen. Mantiene las mismas rutas, campos JSON, cookies y eventos, así que el frontend casi no cambió, y verifica las contraseñas argon2 del backend anterior.
- **Enviar una carta requiere la sesión del adulto.** El niño puede escribir, pero la carta solo se guarda en una cuenta familiar. Para curiosear sin cuenta está el botón *Ver cómo viaja una carta*, que reproduce la cinemática sin guardar nada.
- **La vista del niño es un enlace con código no adivinable** (`/seguimiento/<código>`) y de solo lectura. Muestra apodo, avatar y paradas; nunca cartas ni datos del adulto.
- **Llegada por defecto:** medianoche entre el 24 y el 25 de diciembre, hora de `America/Santiago`. Las fechas se guardan en UTC en texto de ancho fijo (ordenable).
- **El mapa no usa teselas de terceros por defecto.** Dibuja una Sudamérica estilizada de día (mar turquesa, tierra nevada), así no se filtran coordenadas a otros servicios. `VITE_MAP_TILES_URL` permite activar teselas.
- **Retención:** la foto es la carta, así que se guarda (limpia) hasta que el adulto la borre o, como máximo, `RETENTION_DAYS` (60 días).
- **IA externa desactivada por defecto.** Se activa con una casilla explícita en el panel. Sin esa aceptación la foto nunca sale del servidor, aunque `VISION_PROVIDER` tenga una API key.
- **Fuentes autoalojadas** (`@fontsource`), sin llamadas a Google Fonts.
- **El audio siempre arranca silenciado** en cada visita y se sintetiza con WebAudio, sin descargar archivos.
- **`prefers-reduced-motion`:** el vuelo del sobre dura un cuarto y sin estela, sin parallax ni parpadeo de luces, con amplitudes al 15 %. La fase "Leyendo…" conserva su duración porque es estado, no desplazamiento. La UI 2D desactiva sus transiciones.
- **Rendimiento:** DPR limitado a 2 y `PerformanceMonitor` en 3 niveles (sin SMAA → sin Bloom ni luces extra). Las geometrías y materiales son compartidos y la nieve, las ampolletas y el polvo de estrellas son instanciados; las cintas doradas reservan su búfer una sola vez. La escena se carga diferida y la carta se puede escribir antes de que termine de cargar.
- **Estilo visual: taller de cuento.** Sigue el boceto animado y las láminas de referencia del buzón (personajes, duendes y utilería): taller cálido de madera miel y chimenea de piedra, papel crema, verde pino, rojo ladrillo y tinta café. La escena 3D se muestra tal cual se renderiza (toon + bloom), sin filtro de acuarela ni sepia encima. Los colores son tokens propios en `src/styles/index.css` y `PALETTE` en `components/scene/kit.ts`. Antes fue "verano en el Polo Norte" (día saturado); se cambió a pedido explícito.
- **Animación de cuento ilustrado** (referencia: el boceto animado del buzón). Gestos lentos y suaves en vez de rebotes de goma: el Viejito lee la carta con las dos manos frente al pecho, le hace un guiño de mirada al duende, ríe con los ojos cerrados y la carta se vuelve una cinta dorada que envuelve el taller mientras la cámara se aleja. El duende del timbre atrapa la carta, baja de su taburete, rodea el sillón por detrás con la carta en alto, se la entrega al Viejito por el otro costado y vuelve a su taburete a mirarlo con el mentón en las manos (`DELIVERY` en `cinematic.ts`; la cámara queda abierta durante la vuelta y se acerca en la entrega). Los demás duendes aplauden. Todo se amortigua con `dt` (igual a 30, 60 o 120 fps) y usa resortes para la acción secundaria (gorros, panza, barba, orejas). Ver `components/scene/anim.ts` y `cinematic.ts`.
- **Personajes 100 % procedurales.** El Viejito sigue su lámina (`characters/santaModel.ts`): barba en V con mechones, patillas, bigote rizado, gorro con pompón (cadena verlet), brazos con codo, guantes y botas gris carbón, hebilla con estrella y sillón club verde menta; se pone los lentes solo para leer. Los duendes siguen la suya: azul con capucha y bufanda, chaqueta roja con gorro verde, amarillo con el carrito de juguetes y dos verdes con medias a rayas. La utilería incluye el buzón de tapa curva con la puerta abierta, la repisa de renos, la ventana cuadriculada con carámbanos y el árbol tupido con regalos. Ningún personaje con copyright y el reno de nariz roja no tiene nombre de marca.
- **Opcional no incluido:** la mini-escena 3D del trineo en la vista de seguimiento.

## Seguridad

- Contraseñas con argon2id; JWT de acceso de 15 minutos y refresh rotativo de 14 días en cookies `httpOnly` (de un solo uso, con revocación).
- CSRF *double-submit* (`vp_csrf` + `X-CSRF-Token`), CORS estricto y validación de `Origin` en WebSockets.
- Rate limiting por IP, por endpoint de auth y por cuenta en las subidas (en memoria).
- Fotos: tipo real por *magic bytes*, límite de tamaño y de píxeles (contra "bombas de descompresión") y re-codificación sin metadatos; se sirven solo al dueño con `Cache-Control: private, no-store`.
- Cabeceras de seguridad en la API y CSP estricta en nginx y Vercel.
- Con `ENVIRONMENT=production` la app no arranca si `SECRET_KEY` es débil o si `COOKIE_SECURE` está apagado.
- Cada consulta filtra por la cuenta dueña; un recurso ajeno responde 404.
- La imagen Docker es *distroless*, sin shell y con usuario sin privilegios.

## Variables de entorno

Todas están documentadas en [.env.example](.env.example).
