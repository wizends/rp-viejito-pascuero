import { describe, expect, it } from 'vitest';
import { PUBLIC_ROUTES, buildRobots, buildSitemap, pickSiteUrl } from './seo-lib.mjs';

describe('SEO del sitio', () => {
  it('normaliza la URL pública y prioriza VITE_SITE_URL', () => {
    expect(pickSiteUrl({ viteSiteUrl: 'https://buzon.cl/' })).toBe('https://buzon.cl');
    expect(pickSiteUrl({ viteSiteUrl: 'http://localhost:5173' })).toBe('http://localhost:5173');
    expect(pickSiteUrl({ vercelProjectUrl: 'buzon.vercel.app' })).toBe('https://buzon.vercel.app');
    expect(pickSiteUrl({ vercelUrl: 'buzon-abc.vercel.app' })).toBe('https://buzon-abc.vercel.app');
    expect(pickSiteUrl({ viteSiteUrl: 'https://miapp.cl', vercelProjectUrl: 'buzon.vercel.app' })).toBe(
      'https://miapp.cl',
    );
    expect(pickSiteUrl({})).toBe('http://localhost:5173');
  });

  it('el sitemap solo incluye rutas públicas absolutas', () => {
    const xml = buildSitemap('https://buzon.cl', PUBLIC_ROUTES, '2026-11-25');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<loc>https://buzon.cl/</loc>');
    expect(xml).toContain('<loc>https://buzon.cl/privacidad</loc>');
    expect(xml).toContain('<lastmod>2026-11-25</lastmod>');
    expect(xml).not.toContain('/seguimiento');
    expect(xml).not.toContain('/panel');
  });

  it('robots bloquea rutas privadas y declara el sitemap', () => {
    const robots = buildRobots('https://buzon.cl');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Disallow: /seguimiento/');
    expect(robots).toContain('Disallow: /panel');
    expect(robots).toContain('Sitemap: https://buzon.cl/sitemap.xml');
  });
});
