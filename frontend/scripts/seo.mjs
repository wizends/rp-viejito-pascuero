// Genera dist/robots.txt y dist/sitemap.xml después de `vite build`.
// En desarrollo los sirve el plugin `seo` de vite.config.ts.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRobots, buildSitemap } from './seo-lib.mjs';
import { root, siteFromMode } from './site.mjs';

const site = siteFromMode('production');
const dist = join(root, 'dist');

mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'robots.txt'), buildRobots(site), 'utf8');
writeFileSync(join(dist, 'sitemap.xml'), buildSitemap(site), 'utf8');

if (/^https?:\/\/localhost/.test(site)) {
  console.warn(
    'Aviso SEO: define VITE_SITE_URL con el dominio público para que robots.txt y sitemap.xml usen URLs reales.',
  );
}
console.log(`SEO listo: ${site}/robots.txt y ${site}/sitemap.xml`);
