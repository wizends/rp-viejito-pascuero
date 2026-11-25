import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Snowflake, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { lazyPage } from '@/lib/lazyPage';
import { countdown, currentStopIndex, newlyCompleted } from '@/lib/time';
import type { Stop, Tracking } from '@/lib/types';
import { useSocket } from '@/lib/ws';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { playBells } from '@/lib/audio';
import { useLights } from '@/stores/lights';
import { Avatar } from '@/components/ui/Avatar';
import { FlipClock } from './FlipClock';
import { Timeline } from './Timeline';
import { StagePanel } from './StagePanel';
import { Collapse, Swap, cascade, fadeUp, pop } from '@/lib/motion';
import { SantaSelfie } from '@/features/selfie/SantaSelfie';

const SleighMap = lazyPage(() => import('./SleighMap').then((m) => ({ default: m.SleighMap })));

/** Vista del niño (solo lectura): cuenta regresiva, timeline y mapa, con push en tiempo real. */
export default function TrackingPage() {
  const { code = '' } = useParams();
  const qc = useQueryClient();
  const key = ['tracking', code];
  // Consulta cada 15 s: en Vercel no hay WebSocket y las paradas con hora avanzan al
  // consultarse. En Docker el WebSocket además avisa al instante.
  const q = useQuery({ queryKey: key, queryFn: () => api.tracking(code), retry: false, refetchInterval: 15_000 });
  // la selfie del Viejito existe recién cuando deja el regalo
  const selfie = useQuery({
    queryKey: ['selfie', code],
    queryFn: () => api.selfie(code),
    enabled: !!q.data?.selfie,
    staleTime: Infinity,
    retry: 1,
  });
  const [celebrate, setCelebrate] = useState<Stop | null>(null);
  // etapa que se está mirando; null = sigue a la etapa en curso
  const [picked, setPicked] = useState<number | null>(null);
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
    setPicked(null); // al completarse una parada, se muestra la nueva etapa
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
  }, { public: true });

  // la raíz es siempre <Swap>: así "buscando…" se despide y el viaje entra (o el error)
  if (q.isLoading || q.isError || !q.data)
    return (
      <Swap id={q.isLoading ? 'cargando' : 'error'} variants={fadeUp}>
        {q.isLoading ? (
          <p className="p-10 text-center font-bold text-marino">Buscando el trineo…</p>
        ) : (
          <div className="mx-auto max-w-lg p-10 text-center">
            <p className="font-cuento text-4xl text-rojo">Código mágico no encontrado</p>
            <p className="mt-2 font-semibold text-tinta-suave">Pídele a tu papá, mamá o tutor que te comparta el enlace otra vez.</p>
          </div>
        )}
      </Swap>
    );

  const t = q.data;
  const c = countdown(new Date(t.arrival_at).getTime(), now + skew);
  const current = currentStopIndex(t.stops);
  const live = current === -1 ? t.stops.length - 1 : current;
  const selected = picked ?? live;

  return (
    <Swap id="viaje" variants={fadeUp}>
    <motion.div initial="hidden" animate="shown" variants={cascade(0.09)} className="mx-auto max-w-6xl px-4 py-6">
      <motion.header variants={cascade(0.08)} className="flex flex-col items-center gap-2 text-center">
        <motion.div variants={pop}>
          <Avatar id={t.avatar} size={72} />
        </motion.div>
        <motion.h1 variants={fadeUp} className="font-cuento text-4xl text-marino sm:text-5xl">
          ¡Hola, {t.nickname}!
        </motion.h1>
        <motion.p variants={fadeUp} className="font-bold text-tinta-suave">
          Así va el viaje de tu regalo:
        </motion.p>
      </motion.header>

      <motion.section variants={fadeUp} aria-labelledby="cuenta" className="mt-6 rounded-galleta bg-white p-6 text-center shadow-papel">
        <h2 id="cuenta" className="mb-4 text-2xl text-marino">
          El Viejito Pascuero llega en…
        </h2>
        <FlipClock c={c} />
      </motion.section>

      {/* la selfie aparece en vivo cuando el Viejito deja el regalo */}
      <Collapse show={t.selfie}>
        <section aria-labelledby="selfie" className="mt-6 rounded-galleta bg-noche-700 px-4 py-8 text-center shadow-papel sm:px-8">
          <h2 id="selfie" className="font-cuento text-4xl text-oro-suave sm:text-5xl">
            ¡El Viejito Pascuero estuvo aquí!
          </h2>
          <p className="mx-auto mt-2 max-w-lg font-bold text-hielo">Antes de seguir su viaje se sacó una selfie con tu árbol. ¡Mira debajo, tu regalo te espera!</p>
          <SantaSelfie className="mt-6" photo={selfie.data} when={deliveredAt(t.stops)} caption={`Para ${t.nickname}, con cariño`} />
        </section>
      </Collapse>

      <Collapse show={t.stops.length > 0}>
        <StagePanel stops={t.stops} current={current} selected={selected} onSelect={setPicked} />
      </Collapse>

      <motion.div variants={fadeUp} className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <section aria-labelledby="paradas">
          <h2 id="paradas" className="mb-4 text-2xl text-marino">
            Paradas
          </h2>
          <Swap id={t.stops.length ? 'paradas' : 'sin-paradas'} variants={fadeUp}>
          {t.stops.length ? <Timeline
              stops={t.stops}
              current={current}
              selected={selected}
              onSelect={(i) => {
                setPicked(i);
                // en móvil la escena queda arriba: se lleva a la vista para ver la animación
                document.getElementById('etapa')?.closest('section')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
              }}
            /> : <p className="font-semibold text-tinta-suave">Los duendes aún están planeando la ruta.</p>}
          </Swap>
        </section>
        <section aria-labelledby="mapa">
          <h2 id="mapa" className="mb-4 text-2xl text-marino">
            ¿Dónde está el trineo?
          </h2>
          <Suspense fallback={<div className="h-[420px] animate-pulse rounded-[1.6rem] bg-white" />}>
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              <SleighMap stops={t.stops} />
            </motion.div>
          </Suspense>
        </section>
      </motion.div>

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
    </motion.div>
    </Swap>
  );
}

/** Hora en que el Viejito dejó el regalo (parada "bajo el árbol" o la última). */
function deliveredAt(stops: Stop[]): string | null {
  const tree = [...stops].reverse().find((s) => s.icono === 'arbol') ?? stops[stops.length - 1];
  return tree?.completed_at ?? null;
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
