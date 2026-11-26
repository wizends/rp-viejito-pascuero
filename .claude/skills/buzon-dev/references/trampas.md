# Trampas conocidas (ya costaron tiempo: léelas antes de editar)

## Frontend

- **Opacidad de Tailwind con colores `var(--…)`**: `bg-marino/20` o `border-marino/20` pueden quedar invisibles o mal mezclados porque los tokens son variables CSS. Para fondos translúcidos importantes usa un hex arbitrario: `bg-[#d8c3a0]`, `bg-[rgb(15_27_61/0.45)]`.
- **Framer Motion pisa `transform`**: en un `motion.*` con `animate`, `whileHover`, `layout` o variantes con `x/y/scale`, las clases `scale-110`, `hover:scale-105`, `-translate-y-*` de Tailwind dejan de funcionar. Pasa la escala a Framer: `animate={{ scale: activo ? 1.1 : 1 }}`, `whileHover={{ y: -2 }}`.
- **`AnimatePresence mode="popLayout"`** exige que el hijo directo acepte `ref` (un `motion.*` o `forwardRef`). Con componentes propios usa el modo por defecto o `mode="wait"`; si no, aparece "Function components cannot be given refs".
- **`Swap` (mode wait) monta el contenido nuevo cuando termina la salida del anterior.** Un `useEffect` que dibuja en un `ref` puede correr antes de que el elemento exista y no volver a correr. Usa un *callback ref* que guarde el elemento en estado (ver `canvasEl` en `PostcardPage.tsx`).
- **Raíz estable**: si un componente tiene `return` tempranos (cargando/error) y quieres que se crucen, todas las ramas deben devolver el mismo componente raíz (`<Swap id=…>`), si no React desmonta sin animación.
- **Pestaña del navegador en segundo plano** congela `requestAnimationFrame`: las animaciones quedan a medias y la página "parece en blanco". Pon la pestaña al frente (`tabs_select`) antes de juzgar.
- **Recarga en caliente (HMR) a medias**: tras borrar/renombrar archivos, Vite puede quedar con referencias viejas (pantalla blanca, "Failed to reload"). Reinicia el servidor `buzon-frontend` (`preview_stop` + `preview_start`).
- **Chunks viejos tras un despliegue**: las páginas cargan con `lazyPage` (recarga una vez). No reemplaces por `React.lazy`.
- **WebSockets en Vercel**: el proxy de Vercel no los reenvía. Solo el seguimiento público se conecta a `VITE_WS_URL`; lo privado usa sondeo. No agregues sockets privados entre dominios.
- **Cookies y sesión**: `request()` ya renueva ante 401. `api.me()` también. No hagas `fetch('/api/...')` a mano para JSON.
- **Canvas**: fuentes web deben estar cargadas antes de dibujar (`document.fonts.load`, ver `loadFonts` en `postcard/render.ts`); imágenes del mismo origen o `blob:` para poder exportar PNG.
- **`navigator.share` con archivos** solo existe en celulares y algunos navegadores; el navegador integrado de Claude no lo tiene (cae a descargar). Pruébalo en un teléfono real.
- **Texto para niños**: corto, cálido, sin tecnicismos. Nunca pidas apellidos, direcciones ni colegio.

## Backend

- **Dos esquemas**: si cambias solo `schema_sqlite.sql`, los tests pasan en local y Vercel (Postgres) falla. Corre también la batería con Postgres (ver `verificacion.md`).
- **Sin migraciones**: `CREATE TABLE IF NOT EXISTS` no agrega columnas a tablas existentes. Para una columna nueva en tabla vieja, prefiere una **tabla nueva** 1-a-1 (como `tree_photos`, `letter_postcards`); si es imprescindible, agrega un `ALTER TABLE ... ADD COLUMN` idempotente en `store.go` para ambos motores.
- **Fechas**: guárdalas con `fmtTime` (texto UTC de ancho fijo, se comparan como texto). No uses `time.Time` directo en SQL.
- **Placeholders**: escribe `?`; `s.rb()` los convierte a `$n` en Postgres. No escribas `$1` a mano.
- **Reloj en tests**: `newEnv` usa `e.now` falso, pero `CreateLetter` guarda `created_at` con la hora real. Para probar vencimientos adelanta desde `time.Now()`.
- **Sesión en tests**: al adelantar `e.now` más de 15 min, el acceso vence: llama `c.login(email)` de nuevo.
- **Serverless**: no lances goroutines que deban sobrevivir a la petición; usa avance perezoso o `cronTick`.
- **`gofmt`**: corre `gofmt -w .` (en Docker) antes de terminar; `gofmt -l` debe salir vacío.

## Windows / herramientas

- Go **no está instalado** en el equipo: usa Docker (`golang:alpine`). Docker Desktop puede estar cerrado: ábrelo (`Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"`) y espera `docker info`.
- En **Bash** (Git Bash) los volúmenes de Docker con `$(pwd)` fallan ("working directory invalid"): corre `docker run` desde **PowerShell** con `"${PWD}:/src"`.
- Los *heredoc* de Bash con comillas invertidas, `\"` o `$` dentro de código TS/Python se rompen. Para scripts largos escribe un archivo con la herramienta Write (en el scratchpad) y ejecútalo, o usa la herramienta Edit.
- Los archivos tienen finales de línea CRLF en el working copy: los avisos "LF will be replaced by CRLF" de git son normales.
