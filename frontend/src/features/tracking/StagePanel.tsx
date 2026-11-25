import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, Locate } from 'lucide-react';
import { Suspense } from 'react';
import { SceneBoundary } from '@/components/ui/SceneBoundary';
import { lazyPage } from '@/lib/lazyPage';
import { formatDateTime } from '@/lib/time';
import type { Stop } from '@/lib/types';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { StageScene } from './StageScene';
import { Collapse, lifecycle, pop } from '@/lib/motion';

const Cordillera3D = lazyPage(() => import('./Cordillera3D'));

type StageState = 'hecha' | 'ahora' | 'pronto';

export function stageState(stops: Stop[], i: number, current: number): StageState {
  if (stops[i]?.completed_at) return 'hecha';
  return i === current ? 'ahora' : 'pronto';
}

const CHIP: Record<StageState, { text: string; cls: string }> = {
  hecha: { text: '¡Listo!', cls: 'bg-muerdago text-white' },
  ahora: { text: 'Ocurriendo ahora', cls: 'bg-oro text-tinta motion-safe:animate-latido' },
  pronto: { text: 'Próximamente', cls: 'bg-hielo text-noche' },
};

/**
 * Escena animada de la etapa seleccionada (por defecto, la que ocurre ahora),
 * con flechas y puntos para revisar cada etapa del viaje.
 */
export function StagePanel({
  stops,
  current,
  selected,
  onSelect,
}: {
  stops: Stop[];
  /** etapa en curso (-1 = todas listas) */
  current: number;
  selected: number;
  onSelect: (i: number | null) => void;
}) {
  const reduced = useReducedMotion();
  const stop = stops[selected];
  if (!stop) return null;
  const state = stageState(stops, selected, current);
  const live = current === -1 ? stops.length - 1 : current;
  const label = `Ilustración animada: ${stop.nombre}`;
  // Solo la cordillera tiene modelado 3D; las demás etapas siguen con su SVG.
  const fallback = <StageScene icon={stop.icono} label={label} />;

  return (
    <section aria-labelledby="etapa" className="papel-crema mt-6 overflow-hidden rounded-galleta text-tinta shadow-papel">
      <div className="grid md:grid-cols-[1.35fr_1fr]">
        <div className="relative aspect-[16/10] overflow-hidden bg-cielo-claro">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stop.id}
              className="absolute inset-0"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0.15 : 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {stop.icono === 'montana' ? (
                <Suspense fallback={fallback}>
                  <SceneBoundary fallback={fallback}>
                    <Cordillera3D label={label} reduced={reduced} active={state === 'ahora'} />
                  </SceneBoundary>
                </Suspense>
              ) : (
                fallback
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-col gap-3 p-5 sm:p-6">
          <p className="text-sm font-extrabold uppercase tracking-wide text-tinta-suave">
            Etapa {selected + 1} de {stops.length}
          </p>
          <div aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={`${stop.id}-${state}`} {...lifecycle} variants={pop} className={clsx('inline-block origin-left rounded-full px-3 py-0.5 text-xs font-extrabold', CHIP[state].cls)}>
                {CHIP[state].text}
              </motion.span>
            </AnimatePresence>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={stop.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
                exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
              >
                <h2 id="etapa" className="mt-2 font-cuento text-3xl leading-tight text-rojo sm:text-4xl">
                  {stop.nombre}
                </h2>
                {stop.descripcion && <p className="mt-1 font-semibold text-tinta-suave">{stop.descripcion}</p>}
              </motion.div>
            </AnimatePresence>
            <p className="mt-1 text-sm font-bold text-tinta-suave">
              {stop.completed_at ? `Listo: ${formatDateTime(stop.completed_at)}` : stop.eta ? `Estimado: ${formatDateTime(stop.eta)}` : ''}
            </p>
          </div>

          <div className="mt-auto flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => onSelect(Math.max(0, selected - 1))}
              disabled={selected === 0}
              aria-label="Etapa anterior"
              className="grid h-10 w-10 place-items-center rounded-full bg-crema text-marino shadow-papel transition-transform hover:scale-105 disabled:opacity-40"
            >
              <ChevronLeft size={20} />
            </button>
            <ol className="flex flex-1 flex-wrap items-center justify-center gap-1.5" aria-label="Etapas">
              {stops.map((s, i) => {
                const st = stageState(stops, i, current);
                return (
                  <li key={s.id}>
                    <motion.button
                      type="button"
                      onClick={() => onSelect(i)}
                      aria-label={`Ver etapa ${i + 1}: ${s.nombre}`}
                      aria-current={i === selected ? 'step' : undefined}
                      animate={{ width: i === selected ? 28 : 12 }}
                      whileHover={{ scale: 1.2 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                      className={clsx(
                        'block h-3 rounded-full transition-colors',
                        st === 'hecha' ? 'bg-muerdago' : st === 'ahora' ? 'bg-oro' : 'bg-[#d8c3a0]',
                      )}
                    />
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              onClick={() => onSelect(Math.min(stops.length - 1, selected + 1))}
              disabled={selected === stops.length - 1}
              aria-label="Etapa siguiente"
              className="grid h-10 w-10 place-items-center rounded-full bg-crema text-marino shadow-papel transition-transform hover:scale-105 disabled:opacity-40"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <Collapse show={selected !== live} className="self-center">
            <button type="button" onClick={() => onSelect(null)} className="inline-flex items-center gap-1.5 text-sm font-extrabold text-pino underline-offset-4 hover:underline">
              <Locate size={16} aria-hidden="true" /> Volver a la etapa actual
            </button>
          </Collapse>
        </div>
      </div>
    </section>
  );
}
