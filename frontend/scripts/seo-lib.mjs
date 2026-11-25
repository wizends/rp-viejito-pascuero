// Contenido de robots.txt y sitemap.xml. Sin dependencias para poder probarlo aparte.

/**
 * Elige y normaliza la URL pública. Función pura para poder probarla sin
 * depender de las variables del proceso ni de Vite.
 */
export function pickSiteUrl({ viteSiteUrl, vercelProjectUrl, vercelUrl, fallback = 'http://localhost:5173' } = {}) {
  const chosen =
    [viteSiteUrl, vercelProjectUrl, vercelUrl]
      .map((value) => (value ?? '').trim())
      .find(Boolean) ?? fallback;
  const withProtocol = /^https?:\/\//i.test(chosen) ? chosen : `https://${chosen}`;
  return withProtocol.replace(/\/+$/, '');
}

/**
 * Solo las páginas públicas e indexables. El seguimiento, el panel, las
 * postales y las pantallas de acceso quedan fuera: son privadas o no aportan.
 */
export const PUBLIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/privacidad', changefreq: 'yearly', priority: '0.3' },
];

const escapeXml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export function buildRobots(siteUrl) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /panel',
    'Disallow: /postal/',
    'Disallow: /seguimiento/',
    'Disallow: /entrar',
    'Disallow: /registro',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

export function buildSitemap(siteUrl, routes = PUBLIC_ROUTES, lastmod = new Date().toISOString().slice(0, 10)) {
  const urls = routes
    .map((route) =>
      [
        '  <url>',
        `    <loc>${escapeXml(`${siteUrl}${route.path}`)}</loc>`,
        `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
        `    <changefreq>${escapeXml(route.changefreq)}</changefreq>`,
        `    <priority>${escapeXml(route.priority)}</priority>`,
        '  </url>',
      ].join('\n'),
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
}
