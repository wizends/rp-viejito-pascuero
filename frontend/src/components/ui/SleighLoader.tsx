import { motion } from 'framer-motion';
import { SleighIcon } from './Icons';

/** Loader temático: un trineo cruza la barra de progreso dejando estrellitas. */
export function SleighLoader({ progress, label }: { progress: number; label?: string }) {
  const p = Math.max(0, Math.min(100, progress));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p)}
      aria-label={label ?? 'Cargando el taller del Polo Norte'}
      className="w-full max-w-sm"
    >
      <div className="relative h-4 rounded-full bg-white shadow-[inset_0_2px_4px_rgb(74_46_30/0.15)]">
        <motion.div
          className="h-full rounded-full bg-rojo"
          initial={{ width: 0 }}
          animate={{ width: `${p}%` }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
        />
        <motion.div
          className="absolute -top-8 text-rojo"
          initial={{ left: '-18px' }}
          animate={{ left: `calc(${p}% - 18px)`, y: [0, -3, 0] }}
          transition={{ left: { type: 'spring', stiffness: 90, damping: 20 }, y: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } }}
        >
          <SleighIcon size={34} />
        </motion.div>
      </div>
      <p className="mt-3 text-center text-sm font-extrabold text-marino">
        {label ?? 'Encendiendo la chimenea del taller…'} {Math.round(p)}%
      </p>
    </div>
  );
}
