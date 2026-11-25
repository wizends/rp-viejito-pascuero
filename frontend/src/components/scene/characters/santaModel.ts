import * as THREE from 'three';
import { bezierPoints, loft, ringXZ, sweep, type Ring } from '../organic';

/**
 * Contrato del Viejito Pascuero (skill threejs-procedural-geometry):
 *  - marco local: Y arriba, +Z al frente, origen en el piso bajo el sillón, metros;
 *  - sentado: cojín a y=0.59; altura total ~2.4 m con gorro;
 *  - referencia de forma: la lámina del personaje (model sheet) y el boceto animado:
 *    barba en V con mechones esculpidos, patillas, bigote rizado, gorro con pompón
 *    que cae atrás y al costado, guantes y botas gris carbón, hebilla con estrella,
 *    sillón club verde menta; los lentes aparecen solo para leer;
 *  - partes continuas: abrigo (loft), cabeza (loft), barba (loft con rulos),
 *    brazo en dos tramos y piernas (sweep), bigote/cejas/patillas (sweep afinado),
 *    gorro (tubo dinámico);
 *  - uniones declaradas (penetraciones intencionales): barba↔cara, patillas↔barba,
 *    mangas↔hombros, codo, muslos↔falda del abrigo, cuello↔cabeza, barba↔panza.
 * Los ribetes y el cinturón se derivan del MISMO perfil del abrigo (un solo dato).
 */

/** Cuánto sobresale la barba por delante del abrigo (cubre el ribete de piel del frente). */
export const BEARD_OVER_COAT = 0.08;

/** Largo de los tramos del brazo (hombro→codo, codo→muñeca). */
export const ARM = { upper: 0.3, fore: 0.32 } as const;

export const DIMS = {
  /** altura del borde de piel del gorro sobre el centro de la cabeza (dato compartido) */
  brimY: 0.26,
  /** grosor (radio del tubo) del borde de piel del gorro: mullido como en el boceto */
  brimR: 0.078,
  coatCenterZ: 0.03,
  headCenter: new THREE.Vector3(0, 1.64, 0.05),
  headR: 0.34,
  shoulder: { x: 0.43, y: 1.27, z: 0.02 },
  hipX: 0.2,
  beltY: 0.8,
} as const;

/** Perfil del abrigo: altura → semiejes (x, z), panza al frente y exponente de superelipse. */
const COAT: { y: number; rx: number; rz: number; bulge: number; exp: number }[] = [
  { y: 0.55, rx: 0.44, rz: 0.4, bulge: 0.0, exp: 2.2 },
  { y: 0.62, rx: 0.5, rz: 0.45, bulge: 0.02, exp: 2.3 },
  { y: 0.74, rx: 0.54, rz: 0.49, bulge: 0.06, exp: 2.2 },
  { y: 0.9, rx: 0.555, rz: 0.5, bulge: 0.09, exp: 2.1 },
  { y: 1.04, rx: 0.53, rz: 0.47, bulge: 0.07, exp: 2.1 },
  { y: 1.16, rx: 0.48, rz: 0.4, bulge: 0.03, exp: 2.3 },
  { y: 1.26, rx: 0.43, rz: 0.33, bulge: 0.0, exp: 2.8 },
  { y: 1.34, rx: 0.33, rz: 0.27, bulge: 0.0, exp: 2.6 },
  { y: 1.41, rx: 0.17, rz: 0.15, bulge: 0.0, exp: 2.0 },
];

/** Interpola el perfil del abrigo a cualquier altura (dato compartido por los ribetes). */
export function coatAt(y: number) {
  const c = COAT;
  if (y <= c[0]!.y) return c[0]!;
  for (let i = 0; i < c.length - 1; i++) {
    const a = c[i]!;
    const b = c[i + 1]!;
    if (y <= b.y) {
      const t = (y - a.y) / (b.y - a.y);
      const s = t * t * (3 - 2 * t);
      return {
        y,
        rx: a.rx + (b.rx - a.rx) * s,
        rz: a.rz + (b.rz - a.rz) * s,
        bulge: a.bulge + (b.bulge - a.bulge) * s,
        exp: a.exp + (b.exp - a.exp) * s,
      };
    }
  }
  return c[c.length - 1]!;
}

const SEG = 40;

function coatRing(y: number, grow = 0): Ring {
  const p = coatAt(y);
  return ringXZ(new THREE.Vector3(0, y, DIMS.coatCenterZ), p.rx + grow, p.rz + grow, SEG, {
    exp: p.exp,
    frontBulge: p.bulge,
  });
}

/** Superficie frontal del abrigo a la altura y (para apoyar el placket encima). */
export function coatFrontZ(y: number) {
  const p = coatAt(y);
  return DIMS.coatCenterZ + p.rz + p.bulge;
}

export function buildSanta() {
  // ---------- abrigo: un solo loft ----------
  const coatRings: Ring[] = [];
  for (let y = 0.55; y <= 1.411; y += 0.035) coatRings.push(coatRing(Math.min(y, 1.41)));
  const coat = loft(coatRings, { capLift: 0.03 });

  // ---------- ribetes derivados del perfil (proud ≥ 1 cm) ----------
  const hemPts = coatRing(0.585, 0.025).map((p) => p.clone());
  const hem = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hemPts, true, 'centripetal'), 120, 0.055, 14, true);

  // cinturón: banda que abraza el abrigo (tres anillos con relieve, sin tapas: bordes contra la tela)
  const belt = loft([coatRing(DIMS.beltY - 0.065, 0.006), coatRing(DIMS.beltY - 0.06, 0.022), coatRing(DIMS.beltY + 0.06, 0.022), coatRing(DIMS.beltY + 0.065, 0.006)], {
    capStart: false,
    capEnd: false,
  });

  // placket de piel: sigue la curva de la panza por delante
  const placketPts: THREE.Vector3[] = [];
  for (let y = 0.6; y <= 1.3; y += 0.05) placketPts.push(new THREE.Vector3(0, y, coatFrontZ(y) + 0.012));
  const placket = sweep(placketPts, (t) => 0.06 - t * 0.012, { radial: 16, flatten: 0.45, up: new THREE.Vector3(0, 0, 1) });

  // ---------- cabeza: loft levemente ovoide, mejillas llenas abajo ----------
  const hc = DIMS.headCenter;
  const headRings: Ring[] = [];
  const HR = DIMS.headR;
  const steps = 18;
  for (let i = 1; i < steps; i++) {
    const a = (i / steps) * Math.PI; // 0 arriba → π abajo
    const y = hc.y + Math.cos(a) * HR * 1.02;
    const s = Math.sin(a);
    const lower = Math.max(0, -Math.cos(a)); // mejillas: más ancho bajo el ecuador
    headRings.push(ringXZ(new THREE.Vector3(0, y, hc.z), HR * s * (1 + lower * 0.07), HR * 0.96 * s, 36));
  }
  // anillos de abajo hacia arriba
  const head = loft(headRings.reverse());

  // ---------- barba en V (lámina del personaje): ancha en las mejillas, termina en
  // punta a media altura del pecho, con mechones esculpidos ----------
  // Descansa sobre el pecho: el centro de cada anillo avanza lo necesario para que
  // el frente quede siempre por delante del abrigo (dato compartido coatFrontZ).
  const BEARD = [
    { y: 1.62, rx: 0.335, rz: 0.29, z: 0.06, curl: 0.0 },
    { y: 1.54, rx: 0.385, rz: 0.32, z: 0.08, curl: 0.035 },
    { y: 1.45, rx: 0.375, rz: 0.32, z: 0.1, curl: 0.06 },
    { y: 1.36, rx: 0.32, rz: 0.29, z: 0.12, curl: 0.08 },
    { y: 1.27, rx: 0.25, rz: 0.24, z: 0.15, curl: 0.09 },
    { y: 1.19, rx: 0.175, rz: 0.18, z: 0.18, curl: 0.09 },
    { y: 1.12, rx: 0.1, rz: 0.11, z: 0.2, curl: 0.06 },
    { y: 1.07, rx: 0.035, rz: 0.045, z: 0.21, curl: 0.02 },
  ].map((b) => ({ ...b, z: Math.max(b.z, coatFrontZ(b.y) + BEARD_OVER_COAT - b.rz) }));
  const beardRings = [...BEARD].reverse().map((b, i, arr) =>
    ringXZ(new THREE.Vector3(0, b.y, b.z), b.rx, b.rz, 56, {
      // rulos: ondas que se desfasan anillo a anillo para que no formen columnas
      // lóbulos: |sen| da rulos redondeados que caen en mechones, desfasados por anillo
      wave: (t) => 1 + b.curl * (Math.abs(Math.sin(t * 4.5 + i * 0.45)) - 0.5) * 1.6 + b.curl * 0.3 * Math.sin(t * 15 - i * 1.3),
      exp: 2,
      frontBulge: 0.02 * (i / arr.length),
    }),
  );
  const beard = loft(beardRings, { capLift: 0.04 });

  // ---------- patillas: bajan desde el gorro por las mejillas y se funden en la barba ----------
  const sideburns = [-1, 1].map((sx) =>
    sweep(
      bezierPoints(
        new THREE.Vector3(sx * 0.27, 1.865, 0.0),
        new THREE.Vector3(sx * 0.34, 1.76, 0.03),
        new THREE.Vector3(sx * 0.37, 1.62, 0.08),
        new THREE.Vector3(sx * 0.38, 1.5, 0.13),
        14,
      ),
      (t) => 0.06 + t * 0.035 + 0.008 * Math.sin(t * 19),
      { radial: 16, flatten: 0.7, domeRings: 3 },
    ),
  );

  // ---------- bigote mullido: dos barridos gruesos que se abren y suben en la punta ----------
  const mustache = [-1, 1].map((sx) =>
    sweep(
      bezierPoints(
        new THREE.Vector3(sx * 0.01, 1.548, 0.395),
        new THREE.Vector3(sx * 0.13, 1.515, 0.395),
        new THREE.Vector3(sx * 0.25, 1.52, 0.34),
        new THREE.Vector3(sx * 0.31, 1.585, 0.25),
        18,
      ),
      (t) => 0.072 * (1 - t) ** 0.7 + 0.016,
      { radial: 18, flatten: 0.72, domeRings: 3 },
    ),
  );

  // ---------- cejas pobladas ----------
  const brows = [-1, 1].map((sx) =>
    sweep(
      bezierPoints(
        new THREE.Vector3(sx * 0.045, 1.762, 0.318),
        new THREE.Vector3(sx * 0.09, 1.787, 0.314),
        new THREE.Vector3(sx * 0.15, 1.782, 0.292),
        new THREE.Vector3(sx * 0.19, 1.758, 0.252),
        10,
      ),
      (t) => 0.035 * Math.sin(Math.PI * (0.25 + t * 0.6)) + 0.01,
      { radial: 12, flatten: 0.7, domeRings: 2 },
    ),
  );

  // ---------- borde de piel del gorro ----------
  const brimPts = ringXZ(new THREE.Vector3(0, 0, 0), 0.335, 0.315, 40).map((p) => p.clone());
  // piel mullida: el radio ondula apenas a lo largo del anillo (mechones)
  const brim = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(brimPts, true, 'centripetal'), 96, DIMS.brimR, 16, true);

  // ---------- brazo en dos tramos (boceto: codos doblados, carta frente al pecho) ----------
  // hombro → codo (en el espacio del hombro) y codo → muñeca (en el espacio del codo)
  const upperArm = sweep(
    bezierPoints(new THREE.Vector3(0, 0.07, 0), new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, -0.18, 0), new THREE.Vector3(0, -ARM.upper, 0), 10),
    (t) => 0.15 - t * 0.025,
    { radial: 22, domeRings: 3 },
  );
  const forearm = sweep(
    bezierPoints(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0, -0.2, 0.005), new THREE.Vector3(0, -ARM.fore, 0.01), 10),
    (t) => 0.125 - t * 0.012 + Math.max(0, t - 0.75) * 0.1,
    { radial: 22, domeRings: 3, capEnd: false },
  );
  const cuffPts = ringXZ(new THREE.Vector3(0, 0, 0), 0.125, 0.125, 24).map((p) => p.clone());
  const cuff = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cuffPts, true), 48, 0.048, 12, true);

  // guante: palma redondeada + pulgar, ambos barridos (sin esferas pegadas)
  const mitten = sweep(
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.06, 0.01), new THREE.Vector3(0, -0.12, 0.02)],
    (t) => 0.085 + Math.sin(t * Math.PI) * 0.02,
    { radial: 18, domeRings: 4, flatten: 0.75 },
  );
  const thumb = (sx: number) =>
    sweep(
      bezierPoints(new THREE.Vector3(0, -0.03, 0.03), new THREE.Vector3(-sx * 0.02, -0.04, 0.09), new THREE.Vector3(-sx * 0.05, -0.07, 0.1), new THREE.Vector3(-sx * 0.06, -0.1, 0.09), 6),
      (t) => 0.035 - t * 0.008,
      { radial: 12, domeRings: 3 },
    );

  // ---------- piernas (espacio del cuerpo): cadera → rodilla → tobillo ----------
  const leg = (sx: number) => {
    const x = sx * DIMS.hipX;
    return sweep(
      bezierPoints(new THREE.Vector3(x, 0.66, 0.02), new THREE.Vector3(x, 0.66, 0.42), new THREE.Vector3(x * 1.05, 0.56, 0.64), new THREE.Vector3(x * 1.05, 0.22, 0.64), 22),
      (t) => 0.175 - t * 0.05,
      { radial: 24, domeRings: 2, capStart: false, capEnd: false },
    );
  };
  // bota: barrido desde el tobillo hacia la punta, con suela más ancha
  const boot = (sx: number) => {
    const x = sx * DIMS.hipX * 1.05;
    return sweep(
      bezierPoints(new THREE.Vector3(x, 0.26, 0.63), new THREE.Vector3(x, 0.08, 0.63), new THREE.Vector3(x, 0.06, 0.74), new THREE.Vector3(x, 0.08, 0.86), 16),
      (t) => 0.13 - t * 0.035 + Math.sin(t * Math.PI) * 0.015,
      { radial: 22, domeRings: 4, flatten: 0.8 },
    );
  };
  const bootCuffPts = ringXZ(new THREE.Vector3(0, 0, 0), 0.145, 0.145, 24).map((p) => p.clone());
  const bootCuff = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bootCuffPts, true), 48, 0.045, 10, true);

  return {
    coat,
    hem,
    belt,
    placket,
    head,
    beard,
    sideburns,
    mustache,
    brows,
    brim,
    upperArm,
    forearm,
    cuff,
    mitten,
    thumbL: thumb(-1),
    thumbR: thumb(1),
    legL: leg(-1),
    legR: leg(1),
    bootL: boot(-1),
    bootR: boot(1),
    bootCuff,
  };
}

export type SantaGeometry = ReturnType<typeof buildSanta>;

/**
 * Forma de reposo del gorro (espacio de la cabeza), como en el boceto: sube,
 * se dobla sobre el costado izquierdo del Viejito y el pompón cuelga junto a la oreja.
 */
export const HAT_REST = [
  new THREE.Vector3(0, 0.24, -0.02),
  new THREE.Vector3(0, 0.39, -0.05),
  new THREE.Vector3(0.05, 0.5, -0.1),
  new THREE.Vector3(0.16, 0.54, -0.15),
  new THREE.Vector3(0.28, 0.48, -0.2),
  new THREE.Vector3(0.37, 0.35, -0.23),
  new THREE.Vector3(0.42, 0.2, -0.25),
  new THREE.Vector3(0.44, 0.06, -0.25),
];
export const hatRadius = (t: number) => 0.33 * (1 - t) ** 1.2 + 0.04;
