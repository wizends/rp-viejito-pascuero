// Resolución de la URL pública del sitio, compartida por Vite y por el build de SEO.
//
// Orden:
//   1. VITE_SITE_URL (explícita; Docker, build local o Vercel)
//   2. VERCEL_PROJECT_PRODUCTION_URL (dominio estable que define Vercel)
//   3. VERCEL_URL (dominio del despliegue puntual)
//   4. http://localhost:5173 (solo desarrollo)
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { pickSiteUrl } from './seo-lib.mjs';

/** Raíz de `frontend/`. */
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Resuelve la URL pública con las variables de entorno del proceso. */
export function resolveSiteUrl(env = {}) {
  return pickSiteUrl({
    viteSiteUrl: env.VITE_SITE_URL || process.env.VITE_SITE_URL,
    vercelProjectUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    vercelUrl: process.env.VERCEL_URL,
  });
}

/** Igual que `resolveSiteUrl`, leyendo también los archivos `.env*` de Vite. */
export function siteFromMode(mode = 'production') {
  return resolveSiteUrl(loadEnv(mode, root, ''));
}
