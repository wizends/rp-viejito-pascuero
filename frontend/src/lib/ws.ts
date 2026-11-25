import { useEffect, useRef } from 'react';

export interface WsMessage<T = unknown> {
  event: string;
  data: T;
}

/** Backend aparte para WebSockets (Vercel no los reenvía por su proxy). */
const REMOTE = import.meta.env.VITE_WS_URL?.trim().replace(/\/+$/, '') ?? '';

/** Intentos fallidos seguidos (sin llegar a abrir) antes de rendirse: queda la consulta periódica. */
const MAX_FAILED = 3;

/**
 * Origen del WebSocket, o null si no se debe abrir.
 *  - En Docker no hay VITE_WS_URL: todo va al mismo origen (nginx hace de proxy).
 *  - En Vercel solo se conectan al backend los sockets públicos (seguimiento del niño).
 *    Los privados necesitan la cookie de sesión, que es del dominio de la web y no viaja
 *    al backend: esos quedan cubiertos por la consulta periódica.
 */
export function wsBase(opts: { public?: boolean }, remote = REMOTE, loc: Pick<Location, 'protocol' | 'host'> = window.location): string | null {
  if (remote) return opts.public ? remote.replace(/^http/, 'ws') : null;
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}`;
}

/**
 * WebSocket con reconexión exponencial y ping cada 25 s.
 * `onMessage` se guarda en un ref para no reconectar en cada render.
 */
export function useSocket(path: string | null, onMessage: (msg: WsMessage) => void, opts: { public?: boolean } = {}): void {
  const handler = useRef(onMessage);
  handler.current = onMessage;
  const isPublic = !!opts.public;

  useEffect(() => {
    const base = wsBase({ public: isPublic });
    if (!path || !base) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let attempt = 0;
    let failed = 0;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;

    const connect = () => {
      let opened = false;
      try {
        ws = new WebSocket(`${base}${path}`);
      } catch {
        return; // URL inválida o bloqueada: se sigue con la consulta periódica
      }
      ws.onopen = () => {
        opened = true;
        attempt = 0;
        failed = 0;
        pingTimer = window.setInterval(() => ws?.readyState === 1 && ws.send('ping'), 25_000);
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(String(e.data)) as WsMessage;
          if (msg.event !== 'pong') handler.current(msg);
        } catch {
          /* mensaje inválido: se ignora */
        }
      };
      ws.onclose = (e) => {
        window.clearInterval(pingTimer);
        // 44xx = rechazo definitivo (sin sesión, código inexistente, sin tiempo real)
        if (closed || (e.code >= 4400 && e.code < 4500)) return;
        if (!opened && ++failed >= MAX_FAILED) return; // nunca conectó: no insistir
        attempt += 1;
        retryTimer = window.setTimeout(connect, Math.min(15_000, 500 * 2 ** attempt));
      };
    };
    connect();
    return () => {
      closed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(pingTimer);
      ws?.close();
    };
  }, [path, isPublic]);
}
