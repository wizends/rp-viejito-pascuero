import { create } from 'zustand';
import { readJSON, writeJSON } from '@/lib/storage';
import { playBells, playClick } from '@/lib/audio';

export type LightMode = 'off' | 'steady' | 'twinkle' | 'sequence';
export const LIGHT_MODES: { id: Exclude<LightMode, 'off'>; label: string }[] = [
  { id: 'steady', label: 'Fijas' },
  { id: 'twinkle', label: 'Parpadeo suave' },
  { id: 'sequence', label: 'Secuencia de colores' },
];

/** Colores de ampolleta: rojo, verde, dorado, azul (como valores >1 para Bloom). */
export const BULB_COLORS = ['#ff2a48', '#3dff7a', '#ffc83a', '#4aa8ff'] as const;
/** Duración del "efecto encendido" que recorre la guirnalda (ms). */
export const SWEEP_MS = 1400;

const KEY = 'vp:luces';

interface Persisted {
  mode: LightMode;
  lastOnMode: Exclude<LightMode, 'off'>;
  audio: boolean;
}

interface LightsState extends Persisted {
  /** performance.now() del último cambio encendido/apagado, para la onda bombilla por bombilla */
  sweepStart: number;
  toggle: () => void;
  setMode: (m: Exclude<LightMode, 'off'>) => void;
  setAudio: (on: boolean) => void;
}

const initial = readJSON<Persisted>(KEY, { mode: 'off', lastOnMode: 'twinkle', audio: false });
const valid = (m: unknown): m is LightMode =>
  m === 'off' || m === 'steady' || m === 'twinkle' || m === 'sequence';

export const useLights = create<LightsState>((set, get) => ({
  mode: valid(initial.mode) ? initial.mode : 'off',
  lastOnMode: valid(initial.lastOnMode) && (initial.lastOnMode as LightMode) !== 'off' ? initial.lastOnMode : 'twinkle',
  // El audio siempre arranca silenciado: es opt-in en cada visita.
  audio: false,
  sweepStart: -Infinity,
  toggle: () => {
    const { mode, lastOnMode, audio } = get();
    const next: LightMode = mode === 'off' ? lastOnMode : 'off';
    set({ mode: next, sweepStart: performance.now() });
    if (audio) {
      playClick();
      if (next !== 'off') setTimeout(playBells, 180);
    }
  },
  setMode: (m) => {
    const wasOff = get().mode === 'off';
    set({ mode: m, lastOnMode: m, ...(wasOff ? { sweepStart: performance.now() } : {}) });
    if (get().audio) playClick();
  },
  setAudio: (on) => {
    set({ audio: on });
    if (on) playBells();
  },
}));

useLights.subscribe((s) => writeJSON(KEY, { mode: s.mode, lastOnMode: s.lastOnMode, audio: false }));

/**
 * Brillo (0..1) de la bombilla `i` de `n` en el instante `now` (ms).
 * Combina la onda de encendido/apagado con el modo activo.
 * Función pura: la comparten la escena 3D y las guirnaldas CSS.
 */
export function bulbIntensity(
  mode: LightMode,
  sweepStart: number,
  i: number,
  n: number,
  now: number,
  reduced = false,
): number {
  const on = mode !== 'off';
  const progress = reduced ? 1 : Math.min(1, Math.max(0, (now - sweepStart) / SWEEP_MS));
  const front = progress * (n + 4) - 2; // el frente recorre la guirnalda
  const reached = i <= front;
  const lit = on ? reached : !reached;
  if (!lit) return 0;
  // Pequeño "flash" al encender cada bombilla
  const flash = on && !reduced ? Math.max(0, 1 - Math.abs(front - i) / 1.5) * 0.6 : 0;
  const t = now / 1000;
  let base = 1;
  if (mode === 'twinkle' && !reduced) {
    base = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 2.39 + Math.sin(t * 0.7 + i)));
  } else if (mode === 'sequence' && !reduced) {
    // ola que avanza: cada bombilla pulsa en su turno
    base = 0.35 + 0.65 * Math.max(0, Math.sin(t * 3 - i * 0.9));
  }
  if (!on) base = 1; // apagándose: se mantiene encendida hasta que llega el frente
  return Math.min(1.6, base + flash);
}

/** Índice de color de la bombilla; en modo secuencia el color va rotando. */
export function bulbColorIndex(mode: LightMode, i: number, now: number): number {
  if (mode === 'sequence') return (i + Math.floor(now / 900)) % BULB_COLORS.length;
  return i % BULB_COLORS.length;
}
