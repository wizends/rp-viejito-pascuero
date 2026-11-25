import type { LucideProps } from 'lucide-react';
import {
  Building2,
  Gift,
  Hammer,
  Mail,
  Mountain,
  Search,
  Star,
  TreePine,
} from 'lucide-react';
import type { StopIcon } from '@/lib/types';

/**
 * Iconografía propia: lucide como base, con trazo más grueso y redondeado,
 * más dos íconos dibujados a mano (trineo y reno) en el mismo estilo.
 */
const base: LucideProps = { strokeWidth: 2.25, absoluteStrokeWidth: false };

export function SleighIcon({ size = 24, className, ...rest }: LucideProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...(rest as React.SVGProps<SVGSVGElement>)}
    >
      <path d="M3 9h9.5a3.5 3.5 0 0 1 3.5 3.5V14H5a2 2 0 0 1-2-2z" />
      <path d="M3 18h15a3 3 0 0 0 3-3" />
      <path d="M7 14v4M14 14v4" />
      <path d="M16 12.5 20 8" />
      <circle cx="7.5" cy="6" r="1.5" />
    </svg>
  );
}

export function ReindeerIcon({ size = 24, className, ...rest }: LucideProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...(rest as React.SVGProps<SVGSVGElement>)}
    >
      <path d="M8 3v3l-2 1M8 6l2-1M16 3v3l2 1M16 6l-2-1" />
      <path d="M8.5 9.5C8.5 8 10 7 12 7s3.5 1 3.5 2.5V14a3.5 3.5 0 0 1-7 0z" />
      <path d="M6 10.5 8.5 11M18 10.5l-2.5.5" />
      <circle cx="12" cy="16.5" r="1.6" fill="currentColor" />
      <path d="M10.5 11.5h.01M13.5 11.5h.01" />
    </svg>
  );
}

const MAP: Record<StopIcon, (p: LucideProps) => JSX.Element> = {
  carta: (p) => <Mail {...base} {...p} />,
  taller: (p) => <Hammer {...base} {...p} />,
  lupa: (p) => <Search {...base} {...p} />,
  regalo: (p) => <Gift {...base} {...p} />,
  trineo: (p) => <SleighIcon {...p} />,
  reno: (p) => <ReindeerIcon {...p} />,
  montana: (p) => <Mountain {...base} {...p} />,
  ciudad: (p) => <Building2 {...base} {...p} />,
  arbol: (p) => <TreePine {...base} {...p} />,
  estrella: (p) => <Star {...base} {...p} />,
};

export const STOP_ICON_LABELS: Record<StopIcon, string> = {
  carta: 'Carta',
  taller: 'Taller',
  lupa: 'Lupa',
  regalo: 'Regalo',
  trineo: 'Trineo',
  reno: 'Reno',
  montana: 'Montaña',
  ciudad: 'Ciudad',
  arbol: 'Árbol',
  estrella: 'Estrella',
};

export function StopGlyph({ icon, ...p }: { icon: StopIcon } & LucideProps) {
  const C = MAP[icon] ?? MAP.estrella;
  return <C aria-hidden="true" {...p} />;
}
