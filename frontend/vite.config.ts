import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { buildRobots, buildSitemap } from './scripts/seo-lib.mjs';
import { resolveSiteUrl } from './scripts/site.mjs';

export default defineConfig(({ mode }) => {
  // API_TARGET permite apuntar el proxy de desarrollo a otro puerto (ver .env.local)
  const env = loadEnv(mode, process.cwd(), '');
  const api = env.API_TARGET || 'http://localhost:8000';
  const siteUrl = resolveSiteUrl(env);

  // En build, scripts/seo.mjs escribe los archivos en dist/; en dev los sirve este middleware.
  const seo: Plugin = {
    name: 'seo',
    transformIndexHtml(html) {
      return html.replaceAll('%SITE_URL%', siteUrl);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (path === '/robots.txt') {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(buildRobots(siteUrl));
          return;
        }
        if (path === '/sitemap.xml') {
          res.setHeader('Content-Type', 'application/xml; charset=utf-8');
          res.end(buildSitemap(siteUrl));
          return;
        }
        next();
      });
    },
  };

  return {
    plugins: [react(), seo],
    // Vercel Web Analytics solo existe en despliegues de Vercel (VERCEL=1 al compilar ahí);
    // en Docker o en local no se carga, así no se pide un script que no existe.
    define: { __VERCEL_ANALYTICS__: JSON.stringify(env.VERCEL === '1' || env.VITE_VERCEL_ANALYTICS === '1') },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: api, changeOrigin: false },
        '/ws': { target: api.replace(/^http/, 'ws'), ws: true },
      },
    },
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 1400,
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three'],
            r3f: ['@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
            map: ['leaflet', 'react-leaflet'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  };
});
