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
        <div
          className="h-full rounded-full bg-rojo transition-[width] duration-300 ease-suave"
          style={{ width: `${p}%` }}
        />
        <div
          className="absolute -top-8 text-rojo transition-[left] duration-300 ease-suave"
          style={{ left: `calc(${p}% - 18px)` }}
        >
          <SleighIcon size={34} />
        </div>
      </div>
      <p className="mt-3 text-center text-sm font-extrabold text-marino">
        {label ?? 'Encendiendo la chimenea del taller…'} {Math.round(p)}%
      </p>
    </div>
  );
}
