import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, ApiError, hasSessionCookie } from '@/lib/api';
import type { LetterStatusEvent } from '@/lib/types';
import { useSocket } from '@/lib/ws';
import { useScene } from '@/stores/scene';
import { useSession } from '@/stores/session';
import { toast } from '@/components/ui/Toast';
import { SleighLoader } from '@/components/ui/SleighLoader';

/** Consulta la sesión al cargar y escucha los estados de cartas por WebSocket. */
export function SessionBootstrap() {
  const setUser = useSession((s) => s.setUser);
  const user = useSession((s) => s.user);
  const qc = useQueryClient();
  const { data, error, isFetched } = useQuery({
    queryKey: ['me'],
    // sin cookie de sesión no hay a quién preguntar: se evita un 401 de más en la consola
    queryFn: () => (hasSessionCookie() ? api.me() : null),
    retry: false,
  });
  useEffect(() => {
    if (data) setUser(data);
    else if (isFetched && (data === null || error instanceof ApiError)) setUser(null);
  }, [data, error, isFetched, setUser]);

  useSocket(user ? '/ws/letters' : null, (msg) => {
    if (msg.event === 'letter.status') {
      const ev = msg.data as LetterStatusEvent;
      useScene.getState().setBackendStatus(ev.id, ev.status);
      void qc.invalidateQueries({ queryKey: ['letters'] });
      if (ev.status === 'leida') toast(ev.mensaje);
      if (ev.status === 'necesita_ayuda') toast(ev.mensaje, 'info');
    }
    if (msg.event === 'shipment.updated') void qc.invalidateQueries({ queryKey: ['shipment'] });
  });
  usePollLetterStatus();
  return null;
}

const FINAL: ReadonlySet<string> = new Set(['leida', 'necesita_ayuda']);

/**
 * Respaldo del WebSocket: mientras la escena espera la lectura de una carta,
 * consulta su estado cada 3 s. Cubre despliegues donde el WebSocket no llega
 * (p. ej. Vercel con el backend en otro dominio) o se cortó la conexión.
 */
function usePollLetterStatus() {
  const letterId = useScene((s) => s.letterId);
  const waiting = useScene((s) => s.phase !== 'idle' && !FINAL.has(s.backendStatus ?? ''));
  useEffect(() => {
    if (!letterId || !waiting) return;
    let alive = true;
    const tick = async () => {
      try {
        const l = await api.letter(letterId);
        if (alive) useScene.getState().setBackendStatus(letterId, l.status);
      } catch {
        /* sin red o sin sesión: el próximo intento (o el WebSocket) lo resuelve */
      }
    };
    const id = window.setInterval(() => void tick(), 3000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [letterId, waiting]);
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, checked } = useSession();
  const loc = useLocation();
  if (!checked) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <SleighLoader progress={50} label="Revisando tu credencial" />
      </div>
    );
  }
  if (!user) return <Navigate to="/entrar" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}
