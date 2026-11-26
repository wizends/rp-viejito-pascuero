# Verificación antes de decir "listo"

Reporta siempre qué corriste, el resultado, y qué **no** pudiste probar (por ejemplo, "compartir en celular real").

## 1. Backend (PowerShell, desde `backend/`)

```powershell
docker run --rm -v "${PWD}:/src" -v gomodcache:/go/pkg/mod -w /src golang:alpine sh -c "gofmt -w . && go vet ./... && go test ./... 2>&1 | grep -v ' INFO '"
```

Si tocaste SQL o el store, corre también contra PostgreSQL (como Neon en Vercel):

```powershell
docker network create pgtest; docker run -d --rm --name pgtest --network pgtest -e POSTGRES_PASSWORD=prueba postgres:16-alpine; Start-Sleep 6
docker run --rm --network pgtest -v "${PWD}:/src" -v gomodcache:/go/pkg/mod -w /src -e TEST_DATABASE_URL="postgres://postgres:prueba@pgtest:5432/postgres?sslmode=disable" golang:alpine sh -c "go test -p 1 ./internal/... 2>&1 | grep -v ' INFO '"
docker stop pgtest; docker network rm pgtest
```

Para ver solo el test que falla: `go test ./internal/api/ -run NombreDelTest`.

## 2. Frontend (desde `frontend/`)

```powershell
npm run typecheck; npm test; npm run lint; npm run build
```

- El lint tiene **6 advertencias preexistentes** (Fast Refresh en archivos que exportan constantes y una directiva sin uso). No agregues nuevas: si exportas constantes junto a componentes, sepáralas en un `.ts`.
- Lógica pura nueva (cálculos, validaciones, transformaciones) → test en `*.test.ts` junto al archivo (vitest + jsdom; jsdom **no** tiene canvas real ni `scrollTo`).

## 3. En el navegador (UI)

1. `preview_start` `buzon-backend` (Docker, puerto 8010) y `buzon-frontend` (5183). Si el backend no toma rutas nuevas: `docker restart buzon-backend-go` (corre `go run`, recompila al arrancar).
2. Necesitas sesión: registra una cuenta de prueba local desde la consola de la página:
   ```js
   await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'prueba'+Date.now()+'@ejemplo.cl',password:'clave-larga-123',display_name:'Mamá'})})
   ```
   Para llamadas que escriben, manda `X-CSRF-Token` con el valor de la cookie `vp_csrf`.
3. Revisa: la vista en escritorio y en celular (`resize_window` preset `mobile`, y vuelve a `desktop` al terminar), consola sin errores (`read_console_messages` con `onlyErrors`), y que la pestaña esté al frente.
4. No ensucies el entorno del usuario: no reemplaces su portapapeles, no descargues archivos sin permiso, borra datos de prueba de localStorage que hayas creado, y haz las pruebas visuales en una pestaña aparte si el usuario está usando la suya.
5. Para revisar muchas variantes de dibujo (postal, selfie), renderiza una hoja de muestras en una pestaña aparte importando los módulos con `await import('/src/features/postcard/render.ts')` desde la consola.

## 4. Despliegue (Vercel, dos proyectos)

- Web: raíz `frontend`, `npm run build:vercel`. Variables `BACKEND_URL`, `VITE_WS_URL`, `VITE_SITE_URL`.
- API: raíz `backend`, Go. Variables mínimas `DATABASE_URL` (Neon), `SECRET_KEY`, `CRON_SECRET`; `REDIS_URL` opcional.
- La tabla nueva se crea sola al arrancar el backend. No hay paso de migración.
- Tras un push, menciona al usuario qué probar en producción.
