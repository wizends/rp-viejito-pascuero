import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useState } from 'react';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { Sparkles } from './MagicButton';

interface Props {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  type?: 'submit' | 'button';
  onClick?: () => void;
  className?: string;
}

/** Botón principal: un sobre lacrado con sello de cera rojo. */
export function SealButton({ label, busy, disabled, type = 'submit', onClick, className }: Props) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(0);
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      onHoverStart={() => !reduced && setHover((h) => h + 1)}
      whileHover={reduced ? undefined : { y: -3, rotate: -1.5 }}
      whileTap={reduced ? undefined : { scale: 0.95, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 14 }}
      className={clsx(
        'group relative h-[92px] w-[220px] shrink-0 rounded-md text-left disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      {/* Cuerpo del sobre */}
      <span className="papel-crema absolute inset-0 rounded-md shadow-papel ring-1 ring-marino/20" />
      {/* Solapa */}
      <svg
        viewBox="0 0 220 92"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <path d="M2 4 110 58 218 4" fill="none" stroke="var(--kraft-oscuro)" strokeWidth="2" />
        <path d="M2 90 88 46M218 90 132 46" stroke="var(--kraft)" strokeWidth="1.5" />
      </svg>
      {/* Sello postal en la esquina */}
      <span className="absolute right-2 top-2 h-7 w-6 rotate-3 rounded-[2px] border-2 border-dashed border-rojo/60 bg-hielo/70" />
      {/* Sello de cera */}
      <span
        className={clsx(
          'absolute left-1/2 top-[38px] grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full',
          'bg-[radial-gradient(circle_at_35%_30%,#e2384f,var(--rojo-pascuero)_45%,var(--rojo-baya))]',
          'shadow-[0_3px_0_#5e0611,0_10px_18px_-8px_rgb(15_27_61/0.5),inset_0_-3px_6px_rgb(0_0_0/0.25)] transition-shadow duration-300',
          'group-hover:shadow-[0_3px_0_#5e0611,0_10px_18px_-8px_rgb(15_27_61/0.5),0_0_24px_6px_rgb(232_185_49/0.6)]',
          busy && 'animate-latido',
        )}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-oro-suave" aria-hidden="true">
          <path
            d="m12 3 2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.4l-5.3 2.9 1.1-5.9L3.4 9.3l6-.8z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="absolute inset-x-0 bottom-[-32px] text-center font-display text-lg font-extrabold text-rojo-baya">
        {busy ? 'Lacrando…' : label}
      </span>
      {hover > 0 && <Sparkles key={hover} />}
    </motion.button>
  );
}
