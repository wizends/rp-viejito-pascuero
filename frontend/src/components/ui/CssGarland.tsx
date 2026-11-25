import { useEffect, useMemo, useRef } from 'react';
import { BULB_COLORS, bulbColorIndex, bulbIntensity, useLights } from '@/stores/lights';
import { prefersReducedMotion } from '@/lib/useReducedMotion';

/** Altura del cable en x (0..100): cada tramo es una parábola que cuelga (viewBox de 10 de alto). */
function wireY(x: number, swags: number, sag: number): number {
  const span = 100 / swags;
  const u = (x % span) / span;
  return 1 + sag * 2 * u * (1 - u);
}

interface GarlandProps {
  /** número de ampolletas */
  count?: number;
  /** tramos colgantes del cable */
  swags?: number;
  /** caída de cada tramo (0..8, unidades del viewBox) */
  sag?: number;
  /** posición del contenedor (por defecto, el borde superior de la página) */
  className?: string;
}

/**
 * Guirnalda CSS de ampolletas. Lee el mismo store y la misma función de brillo
 * que la escena 3D, así todas las guirnaldas se encienden en sincronía.
 */
export function CssGarland({
  count: COUNT = 28,
  swags = 7,
  sag = 6,
  className = 'absolute inset-x-0 top-0 z-30',
}: GarlandProps = {}) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const wire = useMemo(() => {
    const span = 100 / swags;
    return 'M0 1 ' + Array.from({ length: swags }, (_, k) => `Q ${(k + 0.5) * span} ${1 + sag} ${(k + 1) * span} 1`).join(' ');
  }, [swags, sag]);

  useEffect(() => {
    let raf = 0;
    const reduced = prefersReducedMotion();
    const loop = () => {
      const { mode, sweepStart } = useLights.getState();
      const now = performance.now();
      for (let i = 0; i < COUNT; i++) {
        const el = refs.current[i];
        if (!el) continue;
        const k = bulbIntensity(mode, sweepStart, i, COUNT, now, reduced);
        const color = BULB_COLORS[bulbColorIndex(mode, i, now)] ?? '#888888';
        el.style.setProperty('--c', color);
        el.style.setProperty('--k', k.toFixed(3));
      }
      document.documentElement.style.setProperty('--luces', mode === 'off' ? '0' : '1');
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [COUNT]);

  return (
    <div aria-hidden="true" className={`pointer-events-none h-10 overflow-hidden ${className}`}>
      <svg className="absolute inset-x-0 top-0 h-8 w-full" preserveAspectRatio="none" viewBox="0 0 100 10">
        <path
          d={wire}
          fill="none"
          stroke="#1f5135"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: 2 }}
        />
      </svg>
      {Array.from({ length: COUNT }, (_, i) => {
        const x = ((i + 0.5) / COUNT) * 100;
        const y = wireY(x, swags, sag) * 3.2; // viewBox de 10 → 32 px
        return (
          <span
            key={i}
            ref={(el) => (refs.current[i] = el)}
            className="absolute h-3.5 w-2.5 -translate-x-1/2 rounded-b-full rounded-t-[40%]"
            style={{
              left: `${x}%`,
              top: `${y}px`,
              background:
                'color-mix(in srgb, var(--c, #888) calc(35% + var(--k, 0) * 65%), #3a3a44)',
              boxShadow:
                '0 0 calc(var(--k, 0) * 14px) calc(var(--k, 0) * 3px) color-mix(in srgb, var(--c, #888) calc(var(--k, 0) * 80%), transparent)',
            }}
          >
            <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-sm bg-pino" />
          </span>
        );
      })}
    </div>
  );
}
