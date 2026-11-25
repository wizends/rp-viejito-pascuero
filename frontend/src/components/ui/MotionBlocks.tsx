import { AnimatePresence, motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';
import { EASE_IN, EASE_OUT, fade, fadeUp, lifecycle, withDelay } from '@/lib/motion';

type DivProps = Omit<HTMLMotionProps<'div'>, 'children'> & { children?: ReactNode };

/** Bloque que aparece al montarse y se despide al desmontarse (dentro de AnimatePresence). */
export function Reveal({ variants = fadeUp, delay = 0, children, ...rest }: DivProps & { variants?: Variants; delay?: number }) {
  return (
    <motion.div {...lifecycle} variants={delay ? withDelay(variants, delay) : variants} {...rest}>
      {children}
    </motion.div>
  );
}

/**
 * Mostrar/ocultar con altura animada: el contenido se despliega y se pliega empujando
 * suavemente lo de abajo, en vez de saltar.
 */
export function Collapse({ show, children, className, id }: { show: boolean; children: ReactNode; className?: string; id?: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="collapse"
          id={id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1, transition: { height: { duration: 0.32, ease: EASE_OUT }, opacity: { duration: 0.25, delay: 0.06 } } }}
          exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.22, ease: EASE_IN }, opacity: { duration: 0.12 } } }}
          style={{ overflow: 'hidden' }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Cambia entre contenidos con un fundido cruzado (estados de carga, vacío, error). */
export function Swap({ id, children, className, variants = fade }: { id: string; children: ReactNode; className?: string; variants?: Variants }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={id} {...lifecycle} variants={variants} className={className}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
