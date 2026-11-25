import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Snowflake, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { countdown, currentStopIndex, newlyCompleted } from '@/lib/time';
import type { Stop, Tracking } from '@/lib/types';
import { useSocket } from '@/lib/ws';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { playBells } from '@/lib/audio';
import { useLights } from '@/stores/lights';
import { Avatar } from '@/components/ui/Avatar';
import { FlipClock } from './FlipClock';
import { Timeline } from './Timeline';

const SleighMap = lazy(() => import('./SleighMap').then((m) => ({ default: m.SleighMap })));

/** Vista del niño (solo lectura): cuenta regresiva, timeline y mapa, con push en tiempo real. */
export default function TrackingPage() {
  const { code = '' } = useParams();
  const qc = useQueryClient();
  const key = ['tracking', code];
  // Consulta cada 15 s: en Vercel no hay WebSocket y las paradas con hora avanzan al
  // consultarse. En Docker el WebSocket además avisa al instante.
  const q = useQuery({ queryKey: key, queryFn: () => api.tracking(code), retry: false, refetchInterval: 15_000 });
  const [celebrate, setCelebrate] = useState<Stop | null>(null);
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const reduced = useReducedMotion();

  useEffect(() => {
    if (q.data) setSkew(new Date(q.data.server_time).getTime() - Date.now());
  }, [q.data]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // paradas ya celebradas (por WebSocket o por consulta), para no repetir
  const seen = useRef<Set<string> | null>(null);
  const party = (s: Stop) => {
    seen.current?.add(s.id);
    setCelebrate(s);
    if (useLights.getState().audio) playBells();
    setTimeout(() => setCelebrate(null), 4200);
  };
  useEffect(() => {
    if (!q.data) return;
    const fresh = newlyCompleted(seen.current, q.data.stops);
    seen.current = new Set(q.data.stops.filter((s) => s.completed_at).map((s) => s.id));
    const last = fresh[fresh.length - 1];
    if (last) party(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  useSocket(q.data ? `/ws/tracking/${encodeURIComponent(code)}` : null, (msg) => {
    if (msg.event === 'tracking.updated') qc.setQueryData<Tracking>(key, msg.data as Tracking);
    if (msg.event === 'tracking.stop_completed') {
      const s = msg.data as Stop;
      if (!seen.current?.has(s.id)) party(s);
    }
  });

  if (q.isLoading) return <p className="p-10 text-center font-bold text-marino">Buscando el trineo…</p>;
  if (q.isError || !q.data)
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <p className="font-cuento text-4xl text-rojo">Código mágico no encontrado</p>
        <p className="mt-2 font-semibold text-tinta-suave">Pídele a tu papá, mamá o tutor que te comparta el enlace otra vez.</p>
      </div>
    );

  const t = q.data;
  const c = countdown(new Date(t.arrival_at).getTime(), now + skew);
  const current = currentStopIndex(t.stops);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <Avatar id={t.avatar} size={72} />
        <h1 className="font-cuento text-4xl text-marino sm:text-5xl">¡Hola, {t.nickname}!</h1>
        <p className="font-bold text-tinta-suave">Así va el viaje de tu regalo:</p>
      </header>

      <section aria-labelledby="cuenta" className="mt-6 rounded-galleta bg-white p-6 text-center shadow-papel">
        <h2 id="cuenta" className="mb-4 text-2xl text-marino">
          El Viejito Pascuero llega en…
        </h2>
        <FlipClock c={c} />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <section aria-labelledby="paradas">
          <h2 id="paradas" className="mb-4 text-2xl text-marino">
            Paradas
          </h2>
          {t.stops.length ? <Timeline stops={t.stops} current={current} /> : <p className="font-semibold text-tinta-suave">Los duendes aún están planeando la ruta.</p>}
        </section>
        <section aria-labelledby="mapa">
          <h2 id="mapa" className="mb-4 text-2xl text-marino">
            ¿Dónde está el trineo?
          </h2>
          <Suspense fallback={<div className="h-[420px] rounded-[1.6rem] bg-white" />}>
            <SleighMap stops={t.stops} />
          </Suspense>
        </section>
      </div>

      <AnimatePresence>
        {celebrate && (
          <motion.div
            role="status"
            initial={{ opacity: 0, scale: reduced ? 1 : 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            className="fixed inset-0 z-40 grid place-items-center bg-marino/40 p-6"
          >
            {!reduced && <Burst />}
            <div className="papel-crema relative rounded-galleta px-8 py-6 text-center text-tinta shadow-papel">
              <p className="font-cuento text-4xl text-rojo">¡Nueva parada!</p>
              <p className="mt-2 font-display text-xl font-extrabold">{celebrate.nombre}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Estallido de estrellitas y copos (CSS + Framer Motion). */
function Burst() {
  const pieces = Array.from({ length: 28 }, (_, i) => i);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
      {pieces.map((i) => {
        const a = (i / pieces.length) * Math.PI * 2;
        const r = 140 + (i % 4) * 40;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r + 60, opacity: 0, rotate: 200 }}
            transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
            className="absolute text-2xl"
            style={{ color: ['#ffe17a', '#ffffff', '#ff6b80', '#8ff0b0'][i % 4] }}
          >
            {i % 2 ? <Star size={22} fill="currentColor" /> : <Snowflake size={22} />}
          </motion.span>
        );
      })}
    </div>
  );
}
