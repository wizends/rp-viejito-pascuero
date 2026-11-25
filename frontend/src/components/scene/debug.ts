/**
 * Controles de validación visual (skill threejs-visual-validation).
 *
 * Por URL, sin afectar a los usuarios:
 *   ?seed=7          semilla del azar (nieve, confeti, estela, orejas)
 *   ?post=off        línea base sin postprocesado (debe leerse igual de bien)
 *   ?t=3.5           congela el reloj de la escena en ese segundo
 *   ?quality=0|1|2   fuerza un nivel de calidad (0 completo, 2 mínimo)
 *   ?shot=santa|santa34|santaside   vista fija de inspección del Viejito
 *
 * Todos los valores se leen una sola vez al cargar.
 */
function params(): URLSearchParams {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

const p = params();
const num = (k: string) => {
  const v = p.get(k);
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const SCENE_DEBUG = {
  seed: num('seed') ?? 20261224,
  noPost: p.get('post') === 'off',
  frozenTime: num('t'),
  shot: p.get('shot'),
  forcedQuality: (() => {
    const q = num('quality');
    return q === 0 || q === 1 || q === 2 ? q : null;
  })(),
};

/** PRNG mulberry32: rápido, reproducible y suficiente para efectos visuales. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generador con semilla derivada por sistema, para que cada uno sea estable por separado. */
export const rngFor = (system: number) => makeRng(SCENE_DEBUG.seed * 31 + system * 1013);

/** Paso de tiempo acotado: evita saltos tras suspender la pestaña (resortes estables). */
export const clampDt = (dt: number, max = 1 / 20) => Math.min(Math.max(dt, 0), max);
