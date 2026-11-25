// Arma la salida para Vercel (Build Output API v3) a partir de frontend/dist.
//
//  - Sirve la SPA (rutas profundas → index.html) con las mismas cabeceras de
//    seguridad que nginx.conf.
//  - /api/* se reenvía (proxy) al backend de BACKEND_URL: el navegador ve un solo
//    origen, así las cookies de sesión y el CSRF funcionan igual que en Docker.
//  - Sin BACKEND_URL, /api responde 503 y la web queda en modo vitrina (escena 3D).
//  - Los WebSockets no pasan por el proxy de Vercel: el frontend se conecta
//    directo a VITE_WS_URL (se agrega a connect-src de la CSP).
//
// Uso (lo corre Vercel con Root Directory = frontend, ver frontend/vercel.json):
//   npm run build:vercel
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

// carpeta frontend/ (la raíz del proyecto en Vercel)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, '.vercel', 'output');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('Falta dist/: corre primero `npm run build`.');
  process.exit(1);
}

const backend = (process.env.BACKEND_URL ?? '').trim().replace(/\/+$/, '');
if (backend && !/^https:\/\//.test(backend)) {
  console.error(`BACKEND_URL debe empezar con https:// (recibido: ${backend})`);
  process.exit(1);
}
// la misma VITE_WS_URL que ve Vite (variables del entorno o archivos .env), en forma wss://
const viteEnv = loadEnv('production', root, 'VITE_');
const wsUrl = (process.env.VITE_WS_URL || viteEnv.VITE_WS_URL || '').trim().replace(/\/+$/, '').replace(/^http/, 'ws');
if (!wsUrl) console.warn('Aviso: sin VITE_WS_URL el seguimiento del niño se actualiza por consulta cada 15 s (sin tiempo real).');

const csp = [
  "default-src 'self'",
  "script-src 'self'",
  // 'unsafe-inline' en estilos lo exigen Framer Motion y Leaflet (estilos en línea)
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  `connect-src 'self'${wsUrl ? ` ${wsUrl}` : ''}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const security = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), gyroscope=(self), accelerometer=(self)',
  'Content-Security-Policy': csp,
};

const routes = [
  // archivos con hash: caché larga
  { src: '^/assets/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
  { src: '^/(.*)$', headers: security, continue: true },
  backend
    ? { src: '^/api/(.*)$', dest: `${backend}/api/$1` }
    : { src: '^/api/(.*)$', status: 503, headers: { 'Cache-Control': 'no-store' } },
  { handle: 'filesystem' },
  // SPA: cualquier otra ruta la resuelve React Router
  { src: '^/(.*)$', dest: '/index.html' },
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(dist, join(out, 'static'), { recursive: true });
writeFileSync(join(out, 'config.json'), JSON.stringify({ version: 3, routes }, null, 2));

console.log(`Salida de Vercel lista en frontend/.vercel/output (API: ${backend || 'sin backend, modo vitrina'}; WS: ${wsUrl || 'mismo origen'})`);
