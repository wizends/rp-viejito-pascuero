import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePageSeo } from './seo';

afterEach(() => {
  cleanup();
  document.title = '';
  document.head
    .querySelectorAll('meta[name="robots"], meta[name="description"], link[rel="canonical"]')
    .forEach((el) => el.remove());
});

describe('metadatos por página', () => {
  it('marca las rutas privadas como noindex y actualiza canonical', () => {
    renderHook(() =>
      usePageSeo({ title: 'Seguimiento del regalo', description: 'Avanza el regalo.', noindex: true }),
    );

    expect(document.title).toBe('Seguimiento del regalo');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${window.location.origin}/`,
    );
  });

  it('deja indexables las páginas públicas', () => {
    renderHook(() => usePageSeo({ title: 'Portada', description: 'Escribe tu carta.' }));

    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain(
      'index, follow',
    );
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(
      'Portada',
    );
  });
});
