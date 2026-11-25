import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
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
    queryFn: api.me,
    retry: false,
  });
  useEffect(() => {
    if (data) setUser(data);
    else if (isFetched && error instanceof ApiError) setUser(null);
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
  return null;
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
