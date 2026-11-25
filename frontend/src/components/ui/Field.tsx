import { clsx } from 'clsx';
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
      <input
        ref={ref}
        id={fid}
        aria-invalid={!!error}
        aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
        className={clsx(
          'rounded-xl border-2 bg-white/90 px-3 py-2 text-base text-tinta shadow-hundido outline-none transition-colors',
          'placeholder:text-tinta-suave/70 focus:border-oro focus:ring-4 focus:ring-oro-suave/60',
          error ? 'border-rojo' : 'border-marino/20',
        )}
        {...rest}
      />
      {hint && !error && (
        <p id={`${fid}-hint`} className="text-xs text-tinta-suave">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fid}-err`} className="text-xs font-bold text-rojo-baya">
          {error}
        </p>
      )}
    </div>
  );
});
