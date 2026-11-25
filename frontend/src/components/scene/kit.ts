import * as THREE from 'three';

/**
 * Kit compartido de la escena: geometrías y materiales se crean una sola vez
 * y todos los personajes los reutilizan escalándolos (menos memoria y draw setup).
 */

// ---------- Geometrías compartidas ----------
export const GEO = {
  sphere: new THREE.SphereGeometry(1, 28, 20),
  sphereLow: new THREE.SphereGeometry(1, 14, 10),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 6, 14),
  cone: new THREE.ConeGeometry(1, 1, 24, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 20),
  torus: new THREE.TorusGeometry(1, 0.22, 10, 28),
  thinTorus: new THREE.TorusGeometry(1, 0.08, 8, 24),
  /** media dona: rotada en Z por π queda como sonrisa */
  smile: new THREE.TorusGeometry(1, 0.2, 8, 18, Math.PI),
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
};

// ---------- Material toon de rampa suave ----------
// Un corte duro de 2 tonos parte las superficies curvas en manchas y las hace ver
// facetadas. Esta rampa mantiene el look de ilustración (sombra plana y luz plana)
// pero con un terminador blando, para que las formas orgánicas lean su volumen.
const gradient = (() => {
  const N = 16;
  const data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1); // = dot(N,L) * 0.5 + 0.5
    const s = Math.min(1, Math.max(0, (x - 0.32) / (0.72 - 0.32)));
    const v = Math.round(255 * (0.6 + 0.4 * s * s * (3 - 2 * s)));
    data.set([v, v, v, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
})();

const toonCache = new Map<string, THREE.MeshToonMaterial>();
export function toon(color: string): THREE.MeshToonMaterial {
  let m = toonCache.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
    toonCache.set(color, m);
  }
  return m;
}

/**
 * Jerarquía de emisión (HDR, antes del tone mapping). El bloom tiene umbral 1.2:
 * la escena iluminada queda bajo ese valor y solo brillan estas fuentes, de mayor
 * a menor protagonismo. Ajustar aquí, no con multiplicadores sueltos.
 */
export const EMISSION = {
  /** ampolletas de las guirnaldas encendidas (pico al pasar la onda de encendido) */
  bulbPeak: 3.6,
  bulbBase: 2.4,
  /** nariz del reno: el acento más cálido */
  nose: 3.0,
  /** polvo de estrellas de la magia */
  sparkle: 2.4,
  /** estrella del árbol */
  star: 2.0,
  /** cinta dorada mágica (centro del listón) */
  ribbon: 2.6,
} as const;

const glowCache = new Map<string, THREE.MeshBasicMaterial>();
/** Material emisivo para Bloom: color > 1 con toneMapped desactivado. */
export function glow(color: string, intensity = 3): THREE.MeshBasicMaterial {
  const key = `${color}:${intensity}`;
  let m = glowCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      toneMapped: false,
    });
    glowCache.set(key, m);
  }
  return m;
}

/**
 * Paleta del libro ilustrado (extraída del boceto animado del buzón con k-means):
 * maderas miel y café, papel crema, verde pino profundo, rojo ladrillo y una
 * ventana gris azulada. Cálida y algo desaturada, como acuarela sobre papel.
 */
export const PALETTE = {
  rojo: '#b8352b',
  rojoBaya: '#8e2a20',
  pino: '#2f6b3d',
  muerdago: '#5f8c4a',
  oro: '#d9a441',
  oroSuave: '#efd59c',
  crema: '#f5ead6',
  noche: '#4a2e1e',
  hielo: '#c9d3d0',
  canela: '#b8692f',
  piel: '#f4c9a6',
  pielSombra: '#e2a283',
  mejilla: '#e3867a',
  blanco: '#fbf6ec',
  madera: '#bc7f4e',
  maderaOscura: '#784a2c',
  maderaClara: '#d9a46c',
  negro: '#34231a',
  renoCafe: '#9f633f',
  renoClaro: '#e8d2b4',
};

// ---------- Utilidades de animación ----------
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const t = clamp01(x);
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeInOutSine = (x: number) => -(Math.cos(Math.PI * clamp01(x)) - 1) / 2;

/** Parpadeo orgánico: devuelve escala Y del ojo (1 abierto, ~0.1 cerrado). */
export function blink(t: number, seed: number): number {
  const period = 3.2 + (seed % 1) * 2.6;
  const phase = (t + seed * 7.3) % period;
  if (phase < 0.14) return 0.12 + Math.abs(phase / 0.07 - 1) * 0.88;
  // doble parpadeo ocasional
  if (seed % 2 > 1 && phase > 0.3 && phase < 0.42) return 0.12 + Math.abs((phase - 0.3) / 0.06 - 1) * 0.88;
  return 1;
}

/** Bézier cuadrática en 3D. */
export function qbezier(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    u * u * a.z + 2 * u * t * c.z + t * t * b.z,
  );
}

/** Geometría de estrella de 5 puntas (confeti, punta del árbol). */
export function starGeometry(outer = 1, inner = 0.45, depth = 0.25): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
  g.center();
  return g;
}

export const STAR_GEO = starGeometry();
