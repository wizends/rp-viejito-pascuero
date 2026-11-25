import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import { formatDateTime } from '@/lib/time';
import type { Stop } from '@/lib/types';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { StopGlyph } from '@/components/ui/Icons';

/** Línea de tiempo vertical: la parada actual pulsa en dorado, las completadas llevan sello. */
export function Timeline({ stops, current }: { stops: Stop[]; current: number }) {
  const reduced = useReducedMotion();
  return (
    <ol className="relative space-y-1" aria-label="Paradas del viaje del regalo">
      {stops.map((s, i) => {
        const done = !!s.completed_at;
        const isCurrent = i === current;
        return (
          <motion.li
            key={s.id}
            layout={!reduced}
            initial={reduced ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, delay: reduced ? 0 : i * 0.05 }}
            className="relative flex gap-4 pb-5"
            aria-current={isCurrent ? 'step' : undefined}
          >
            {/* conector */}
            {i < stops.length - 1 && (
              <span
                aria-hidden="true"
                className={clsx('absolute left-[23px] top-12 h-[calc(100%-2.5rem)] w-1 rounded-full', done ? 'bg-oro' : 'bg-[repeating-linear-gradient(to_bottom,var(--turquesa)_0_6px,transparent_6px_12px)] opacity-40')}
              />
            )}
            <span
              className={clsx(
                'relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full ring-4 transition-all duration-500',
                done && 'bg-muerdago text-white ring-muerdago/30',
                isCurrent && 'bg-oro text-tinta ring-oro-suave shadow-[0_8px_18px_-4px_rgb(224_165_58/0.8)] motion-safe:animate-latido',
                !done && !isCurrent && 'bg-white text-marino/50 ring-cielo',
              )}
            >
              <StopGlyph icon={s.icono} size={22} />
              {done && (
                <span aria-hidden="true" className="absolute -right-2 -top-2 grid h-6 w-6 rotate-12 place-items-center rounded-full border-2 border-dashed border-rojo bg-crema text-xs font-black text-rojo">
                  <Check size={14} strokeWidth={3.5} />
                </span>
              )}
            </span>
            <div className={clsx('pt-1', !done && !isCurrent && 'opacity-60')}>
              <p className={clsx('font-display text-lg font-extrabold', isCurrent ? 'text-rojo' : 'text-marino')}>
                {s.nombre}
                <span className="sr-only">{done ? ' (completada)' : isCurrent ? ' (en curso)' : ' (por venir)'}</span>
              </p>
              {s.descripcion && <p className="text-sm font-semibold text-tinta-suave">{s.descripcion}</p>}
              <p className="text-xs font-bold text-tinta-suave">
                {done ? `Listo: ${formatDateTime(s.completed_at)}` : s.eta ? `Estimado: ${formatDateTime(s.eta)}` : ''}
              </p>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
