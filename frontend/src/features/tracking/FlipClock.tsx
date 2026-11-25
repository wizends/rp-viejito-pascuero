import { AnimatePresence, motion } from 'framer-motion';
import { Gift } from 'lucide-react';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { countdownLabel, type Countdown } from '@/lib/time';

function FlipDigit({ value }: { value: string }) {
  const reduced = useReducedMotion();
  return (
    <span className="relative inline-block h-[1.25em] w-[0.8em] overflow-hidden rounded-lg bg-[linear-gradient(180deg,var(--rojo-pascuero)_49.5%,#cf1d28_50.5%)] text-white text-center shadow-[0_4px_0_var(--rojo-baya),0_12px_20px_-8px_rgb(168_18_31/0.55),inset_0_1px_0_rgb(255_255_255/0.25)] [perspective:300px]">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={reduced ? false : { rotateX: -90, opacity: 0.2 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={reduced ? undefined : { rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: '50% 50%' }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {value}
        </motion.span>
      </AnimatePresence>
      <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-rojo-baya/50" />
    </span>
  );
}

function Unit({ n, label, pad = 2 }: { n: number; label: string; pad?: number }) {
  const s = String(n).padStart(pad, '0');
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-1">
        {s.split('').map((d, i) => (
          <FlipDigit key={`${s.length}-${i}`} value={d} />
        ))}
      </div>
      <span className="text-xs font-extrabold uppercase tracking-widest text-marino">{label}</span>
    </div>
  );
}

/** Cuenta regresiva grande con dígitos que se voltean. */
export function FlipClock({ c }: { c: Countdown }) {
  return (
    <div>
      <p className="sr-only" aria-live="polite">
        {/* se anuncia solo el texto en minutos, no cada segundo */}
        {countdownLabel({ ...c, seconds: 0 })}
      </p>
      {c.done ? (
        <p className="inline-flex items-center gap-3 font-cuento text-5xl text-rojo">¡Ya llegó! <Gift size={44} aria-hidden="true" /></p>
      ) : (
        <div aria-hidden="true" className="flex flex-wrap items-end justify-center gap-3 font-display text-5xl font-extrabold text-white sm:text-6xl">
          <Unit n={c.days} label="días" pad={c.days > 99 ? 3 : 2} />
          <span className="pb-6 text-rojo">:</span>
          <Unit n={c.hours} label="horas" />
          <span className="pb-6 text-rojo">:</span>
          <Unit n={c.minutes} label="min" />
          <span className="hidden pb-6 text-rojo sm:inline">:</span>
          <div className="hidden sm:block">
            <Unit n={c.seconds} label="seg" />
          </div>
        </div>
      )}
    </div>
  );
}
