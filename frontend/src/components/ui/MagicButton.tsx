import { motion, type HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';
import { useState, type ReactNode } from 'react';
import { useReducedMotion } from '@/lib/useReducedMotion';

type Variant = 'rojo' | 'pino' | 'oro' | 'crema' | 'fantasma';

const VARIANTS: Record<Variant, string> = {
  rojo: 'bg-rojo text-white shadow-[0_4px_0_var(--rojo-baya),0_10px_18px_-8px_rgb(15_27_61/0.5)] hover:shadow-[0_4px_0_var(--rojo-baya),0_10px_18px_-8px_rgb(15_27_61/0.5),0_0_22px_4px_rgb(232_185_49/0.55)]',
  pino: 'bg-pino text-crema shadow-[0_4px_0_#123222,0_10px_18px_-8px_rgb(15_27_61/0.5)] hover:shadow-[0_4px_0_#123222,0_10px_18px_-8px_rgb(15_27_61/0.5),0_0_22px_4px_rgb(232_185_49/0.5)]',
  oro: 'bg-oro text-tinta shadow-[0_4px_0_var(--canela),0_10px_18px_-8px_rgb(15_27_61/0.5)] hover:shadow-[0_4px_0_var(--canela),0_10px_18px_-8px_rgb(15_27_61/0.5),0_0_22px_4px_rgb(244_213_141/0.8)]',
  crema: 'bg-crema text-tinta shadow-[0_4px_0_var(--kraft-oscuro),0_10px_18px_-8px_rgb(15_27_61/0.5)] hover:shadow-[0_4px_0_var(--kraft-oscuro),0_10px_18px_-8px_rgb(15_27_61/0.5),0_0_20px_3px_rgb(232_185_49/0.55)]',
  fantasma: 'bg-transparent text-current ring-2 ring-current/40 hover:ring-oro',
};

interface Props extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  children: ReactNode;
}

/** Botón con rebote suave, brillo dorado y destellos al pasar el mouse. */
export function MagicButton({
  variant = 'rojo',
  size = 'md',
  icon,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  const reduced = useReducedMotion();
  const [sparks, setSparks] = useState<number>(0);
  return (
    <motion.button
      whileHover={reduced || disabled ? undefined : { scale: 1.04, y: -1 }}
      whileTap={reduced || disabled ? undefined : { scale: 0.96, y: 2 }}
      transition={{ type: 'spring', stiffness: 420, damping: 16 }}
      onHoverStart={() => !reduced && setSparks((n) => n + 1)}
      disabled={disabled}
      className={clsx(
        'relative inline-flex select-none items-center justify-center gap-2 rounded-full font-display font-extrabold transition-[box-shadow,opacity] duration-300',
        'disabled:cursor-not-allowed disabled:opacity-55',
        size === 'sm' && 'px-4 py-1.5 text-sm',
        size === 'md' && 'px-6 py-2.5 text-base',
        size === 'lg' && 'px-8 py-3.5 text-lg',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      <span>{children}</span>
      {sparks > 0 && <Sparkles key={sparks} />}
    </motion.button>
  );
}

const SPOTS = [
  { left: '8%', top: '-10%', d: 0 },
  { left: '88%', top: '10%', d: 0.08 },
  { left: '50%', top: '96%', d: 0.16 },
];

export function Sparkles() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {SPOTS.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 10 10"
          className="absolute h-3 w-3 animate-destello text-oro-suave"
          style={{ left: s.left, top: s.top, animationDelay: `${s.d}s` }}
        >
          <path d="M5 0 6 4 10 5 6 6 5 10 4 6 0 5 4 4z" fill="currentColor" />
        </svg>
      ))}
    </span>
  );
}
