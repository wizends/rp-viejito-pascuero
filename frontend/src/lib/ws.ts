import { useEffect, useRef } from 'react';

export interface WsMessage<T = unknown> {
  event: string;
  data: T;
}

/**
 * WebSocket con reconexión exponencial y ping cada 25 s.
 * `onMessage` se guarda en un ref para no reconectar en cada render.
 */
export function useSocket(path: string | null, onMessage: (msg: WsMessage) => void): void {
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    if (!path) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let attempt = 0;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${window.location.host}${path}`);
      ws.onopen = () => {
        attempt = 0;
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
        // 44xx = rechazo definitivo (sin sesión, código inexistente)
        if (closed || (e.code >= 4400 && e.code < 4500)) return;
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
  }, [path]);
}
