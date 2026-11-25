/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAP_TILES_URL?: string;
  /** Origen de los WebSockets cuando el backend está en otro dominio (wss://…). */
  readonly VITE_WS_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
