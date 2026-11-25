import { lazy, type ComponentType } from 'react';

/**
 * Tras un despliegue nuevo, los archivos de cada página cambian de nombre. Si la web
 * quedó abierta con la versión anterior, al navegar pide un archivo que ya no existe
 * y la vista quedaría en blanco hasta recargar. Aquí se recarga sola, una vez.
 */
const KEY = 'vp:recarga-version';
const WINDOW_MS = 15_000;

/** Recarga la página para traer la versión nueva; false si ya se intentó hace poco (evita bucles). */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < WINDOW_MS) return false;
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* sin sessionStorage: se intenta igual */
  }
  window.location.reload();
  return true;
}

/** Como React.lazy, pero si el archivo de la página no carga, recarga la web (una vez). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await load();
    } catch (err) {
      // mientras se recarga, la página queda en "cargando" en vez de mostrar un error
      if (reloadForNewVersion()) return new Promise<{ default: T }>(() => undefined);
      throw err;
    }
  });
}

/** Vite avisa cuando falla la precarga de un archivo: mismo remedio. */
export function watchForNewVersion() {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewVersion()) event.preventDefault();
  });
}
