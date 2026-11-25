import { useEffect } from 'react';

/** Nombre y descripción base del sitio (también están en index.html). */
export const SITE_NAME = 'Buzón del Viejito Pascuero';
export const SITE_DESCRIPTION =
  'Escríbele tu carta al Viejito Pascuero, mira cómo la leen sus duendes y renos en el Polo Norte y sigue el viaje de tu regalo hasta tu árbol.';

export interface PageSeo {
  title: string;
  description: string;
  /** Rutas privadas o sin valor de búsqueda: no se indexan. */
  noindex?: boolean;
  /** Imagen social; por defecto la del sitio. */
  image?: string;
  type?: 'website' | 'article';
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function absoluteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `${window.location.origin}${value.startsWith('/') ? value : `/${value}`}`;
}

/**
 * Metadatos de la página actual: título, descripción, canonical, Open Graph,
 * Twitter y robots. Se llama al inicio de cada página; las rutas privadas
 * pasan `noindex` (además están bloqueadas en robots.txt).
 */
export function usePageSeo({
  title,
  description,
  noindex = false,
  image = '/og-image.png',
  type = 'website',
}: PageSeo): void {
  useEffect(() => {
    // Sin query ni hash: cada ruta tiene una única URL canónica.
    const canonical = `${window.location.origin}${window.location.pathname || '/'}`;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    setLink('canonical', canonical);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', absoluteUrl(image));
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', absoluteUrl(image));
  }, [title, description, noindex, image, type]);
}
