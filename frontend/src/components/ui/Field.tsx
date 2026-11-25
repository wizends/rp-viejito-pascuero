import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

/** Campo de texto accesible: label asociado, error anunciado y foco dorado. */
export const Field = forwardRef<HTMLInputElement, Props>(function Field(
  { label, error, hint, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={fid} className="text-sm font-extrabold text-tinta">
        {label}
      </label>
      <motion.input
        ref={ref}
        animate={error ? 'temblor' : 'quieto'}
        variants={{ quieto: { x: 0 }, temblor: { x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.4 } } }}
        id={fid}
        aria-invalid={!!error}
        aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
        className={clsx(
          'rounded-xl border-2 bg-white/90 px-3 py-2 text-base text-tinta shadow-hundido outline-none transition-colors',
          'placeholder:text-tinta-suave/70 focus:border-oro focus:ring-4 focus:ring-oro-suave/60',
          error ? 'border-rojo' : 'border-marino/20',
        )}
        {...(rest as object)}
      />
      <AnimatePresence mode="wait" initial={false}>
        {error ? (
          <motion.p
            key="error"
            id={`${fid}-err`}
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.14 } }}
            className="overflow-hidden text-xs font-bold text-rojo-baya"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            id={`${fid}-hint`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.14 } }}
            className="overflow-hidden text-xs text-tinta-suave"
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
});
