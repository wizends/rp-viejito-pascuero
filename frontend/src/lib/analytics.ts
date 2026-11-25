/**
 * Vercel Web Analytics: cuenta visitas sin cookies ni datos personales.
 * Aun así, algunas direcciones llevan datos que identifican a una familia
 * (el código del enlace del niño, el id de una carta). Se reemplazan antes de enviar
 * para que el panel de Vercel solo vea qué tipo de página se visitó.
 */

/** Partes privadas de las rutas → marcador genérico. */
const PRIVATE_SEGMENTS: [RegExp, string][] = [
  [/^\/seguimiento\/[^/]+/, '/seguimiento/[codigo]'],
  [/^\/postal\/[^/]+/, '/postal/[carta]'],
];

/** Dirección sin datos privados: sin query, sin #, y con los códigos/ids reemplazados. */
export function redactUrl(url: string): string {
  const u = new URL(url);
  let path = u.pathname;
  for (const [re, mask] of PRIVATE_SEGMENTS) path = path.replace(re, mask);
  return `${u.origin}${path}`;
}

/** Para `beforeSend` de <Analytics />: limpia la URL de cada evento. */
export function redactEvent<T extends { url: string }>(event: T): T {
  return { ...event, url: redactUrl(event.url) };
}
