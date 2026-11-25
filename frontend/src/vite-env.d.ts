/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAP_TILES_URL?: string;
  /** Origen de los WebSockets cuando el backend está en otro dominio (wss://…). */
  readonly VITE_WS_URL?: string;
}
/** true si el build se hizo en Vercel: activa Vercel Web Analytics (ver vite.config.ts). */
declare const __VERCEL_ANALYTICS__: boolean;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
