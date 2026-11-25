import type { Transition, Variants } from 'framer-motion';

/**
 * Lenguaje de movimiento de toda la web: las mismas curvas y duraciones en cada
 * componente, para que aparecer, cambiar y desaparecer se sientan de una sola familia.
 *
 * - Entrar: sube un poco y aparece, con frenado suave (ease-out exponencial).
 * - Salir: más rápido que entrar y casi sin recorrido, para no estorbar.
 * - Listas: los elementos entran en cascada y al irse se pliegan.
 * Con "reducir movimiento" (MotionConfig reducedMotion="user") se quitan los
 * desplazamientos y escalas y queda solo el fundido.
 */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;

export const enter: Transition = { duration: 0.42, ease: EASE_OUT };
export const leave: Transition = { duration: 0.18, ease: EASE_IN };
export const springy: Transition = { type: 'spring', stiffness: 420, damping: 30, mass: 0.8 };

/** Aparece subiendo; se va bajando el telón. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  shown: { opacity: 1, y: 0, transition: enter },
  gone: { opacity: 0, y: -6, transition: leave },
};

/** Aparece creciendo desde el centro (diálogos, tarjetas pequeñas, insignias). */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  shown: { opacity: 1, scale: 1, transition: springy },
  gone: { opacity: 0, scale: 0.96, transition: leave },
};

/** Solo fundido (textos de estado, mensajes que cambian en el mismo lugar). */
export const fade: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.25, ease: EASE_OUT } },
  gone: { opacity: 0, transition: { duration: 0.15 } },
};

/** Contenedor de lista: los hijos entran en cascada. */
export const cascade = (stagger = 0.05, delay = 0): Variants => ({
  hidden: {},
  shown: { transition: { staggerChildren: stagger, delayChildren: delay } },
  gone: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
});

/** Elemento de lista: entra subiendo y al quitarse se pliega (los demás se acomodan). */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  shown: { opacity: 1, y: 0, transition: enter },
  gone: { opacity: 0, x: -24, transition: leave },
};

/** Las mismas variantes, pero la entrada espera `delay` segundos (para escalonar bloques). */
export function withDelay(v: Variants, delay: number): Variants {
  const shown = v.shown as { transition?: Transition } & Record<string, unknown>;
  return { ...v, shown: { ...shown, transition: { ...(shown.transition ?? enter), delay } } };
}

/** Props listas para un motion.* con ciclo de vida completo. */
export const lifecycle = { initial: 'hidden', animate: 'shown', exit: 'gone' } as const;

// Componentes de ciclo de vida (en su propio archivo para que Fast Refresh funcione)
export { Collapse, Reveal, Swap } from '@/components/ui/MotionBlocks';
