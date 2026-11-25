import * as THREE from 'three';
import type { ScenePhase } from '@/stores/scene';
import { clamp01, easeInOutSine, easeOutBack, qbezier, smooth } from './kit';
import { LAND, MAILBOX, MAILBOX_SLOT, READ_POS, SANTA, STAMPER } from './layout';
import { hop, type HopPose } from './anim';

/**
 * Coreografía de la carta, como funciones puras del tiempo de fase.
 * El sobre y el duende del timbre leen lo mismo, así siempre están sincronizados.
 */
const START = new THREE.Vector3(-0.4, 1.2, 5.6);
const FLY_CTRL = new THREE.Vector3(-0.6, 4.4, 2.6);
const POP = new THREE.Vector3(MAILBOX.x, MAILBOX.y + 0.75, MAILBOX.z);
const POP_CTRL = new THREE.Vector3(MAILBOX.x, MAILBOX.y + 1.4, 0.35);
const HAND_OFFSET = new THREE.Vector3(0, 0.62, 0.12);
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const GIVE_CTRL = new THREE.Vector3();

export interface StamperPose {
  pos: THREE.Vector3;
  armsUp: number; // 0..1
  facing: number; // rotación Y
  squash: number; // escala vertical del salto
  /** 0..1: apoya el mentón en las manos y mira al Viejito (boceto) */
  chin: number;
  /** 0..1: aplaude */
  clap: number;
  /** camina (pasos según la distancia recorrida) */
  walk: boolean;
}

const hopPose: HopPose = { y: 0, squash: 1 };
const pose: StamperPose = { pos: new THREE.Vector3(), armsUp: 0, facing: 0, squash: 1, chin: 0, clap: 0, walk: false };
/** Desde su taburete, mirando al Viejito. */
const ADMIRE_FACING = 1.25;

/** Punto en coordenadas del sillón (x = izquierda del Viejito, z = hacia el frente) → mundo. */
const chair = (x: number, z: number) =>
  new THREE.Vector3(x, 0, z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, SANTA.rotY).add(SANTA.pos);

/**
 * Vuelta por detrás del sillón: desde el pie del taburete (izquierda, vista de
 * cámara) hasta el costado izquierdo del Viejito, donde le entrega la carta.
 */
export const AROUND_CHAIR = new THREE.CatmullRomCurve3(
  [chair(-1.14, 0.72), chair(-1.22, -0.3), chair(-0.98, -0.94), chair(0, -1.02), chair(0.98, -0.94), chair(1.22, -0.3), chair(1.1, 0.78)],
  false,
  'centripetal',
);
const FLOOR_START = AROUND_CHAIR.getPointAt(0);
/** Donde el duende le entrega la carta al Viejito (al costado del sillón). */
export const GIVE_POS = AROUND_CHAIR.getPointAt(1);

/** Tiempos de la entrega (s). `caught`: atrapa, baja, rodea el sillón y entrega. `reading`: vuelve. */
export const DELIVERY = {
  hopDown: [0.5, 0.95],
  walk: [0.95, 4.15],
  /** la carta pasa de las manos del duende a las del Viejito */
  give: [4.15, 4.75],
  backWalk: [0.35, 3.15],
  hopUp: [3.15, 3.6],
} as const;

/** Avance con velocidad trapezoidal: arranca, mantiene el trote y frena (0..1 → 0..1). */
function cruise(x: number, a = 0.14): number {
  const k = clamp01(x);
  const v = 1 / (1 - a);
  if (k < a) return (0.5 * v * k * k) / a;
  if (k < 1 - a) return v * (k - a / 2);
  return 1 - (0.5 * v * (1 - k) * (1 - k)) / a;
}
const tangent = new THREE.Vector3();
/** Recorre la vuelta al sillón (de ida o de vuelta) mirando hacia donde camina. */
function walkAround(k: number, back: boolean, out: THREE.Vector3): number {
  const u = back ? 1 - cruise(k) : cruise(k);
  AROUND_CHAIR.getPointAt(u, out);
  AROUND_CHAIR.getTangentAt(u, tangent);
  if (back) tangent.negate();
  return Math.atan2(tangent.x, tangent.z);
}
/** Mirando hacia donde salta: del taburete al piso, y de vuelta. */
const HOP_DOWN_FACING = Math.atan2(FLOOR_START.x - STAMPER.pos.x, FLOOR_START.z - STAMPER.pos.z);
const HOP_UP_FACING = HOP_DOWN_FACING + Math.PI;
/** Mirando al Viejito desde el punto de entrega. */
const GIVE_FACING = Math.atan2(READ_POS.x - GIVE_POS.x, READ_POS.z - GIVE_POS.z);

/**
 * Saltitos entre dos puntos: el avance horizontal ocurre solo en el aire,
 * con anticipación y aplaste en cada aterrizaje.
 */
function hopsBetween(a: THREE.Vector3, b: THREE.Vector3, k: number, hops: number, height: number, out: THREE.Vector3) {
  const x = clamp01(k) * hops;
  const i = Math.min(hops - 1, Math.floor(x));
  const local = x - i;
  hop(local, height, hopPose);
  const air = smooth(clamp01((local - 0.18) / 0.64));
  out.copy(a).lerp(b, (i + air) / hops);
  out.y += hopPose.y;
  return hopPose.squash;
}

/** Posición del duende del timbre durante la cinemática (null = rutina normal). */
export function stamperPose(phase: ScenePhase, pt: number, out: THREE.Vector3): StamperPose | null {
  pose.pos = out;
  pose.chin = 0;
  pose.clap = 0;
  pose.walk = false;
  const D = DELIVERY;
  if (phase === 'caught') {
    if (pt < D.hopDown[0]) {
      // se estira de puntillas sobre el taburete para atrapar el sobre
      hop(pt / D.hopDown[0], 0.1, hopPose);
      out.copy(STAMPER.pos);
      out.y += hopPose.y;
      return Object.assign(pose, { armsUp: smooth(pt / 0.3), facing: STAMPER.rotY, squash: hopPose.squash });
    }
    if (pt < D.hopDown[1]) {
      // salta del taburete al piso con la carta en alto
      const squash = hopsBetween(STAMPER.pos, FLOOR_START, (pt - D.hopDown[0]) / (D.hopDown[1] - D.hopDown[0]), 1, 0.16, out);
      return Object.assign(pose, { armsUp: 1, facing: HOP_DOWN_FACING, squash });
    }
    if (pt < D.walk[1]) {
      // trota por detrás del sillón con la carta sobre la cabeza
      const facing = walkAround((pt - D.walk[0]) / (D.walk[1] - D.walk[0]), false, out);
      return Object.assign(pose, { armsUp: 1, facing, squash: 1, walk: true });
    }
    // de puntillas, le alcanza la carta al Viejito y baja los brazos
    out.copy(GIVE_POS);
    const tip = Math.sin(clamp01((pt - D.give[0]) / (D.give[1] - D.give[0])) * Math.PI) * 0.05;
    out.y += tip;
    return Object.assign(pose, { armsUp: 1 - smooth((pt - D.give[1]) / 0.3), facing: GIVE_FACING, squash: 1 });
  }
  if (phase === 'reading') {
    if (pt < D.backWalk[0]) {
      out.copy(GIVE_POS);
      return Object.assign(pose, { armsUp: 0, facing: GIVE_FACING, squash: 1 });
    }
    if (pt < D.backWalk[1]) {
      // vuelve por detrás del sillón, sin molestar la lectura
      const facing = walkAround((pt - D.backWalk[0]) / (D.backWalk[1] - D.backWalk[0]), true, out);
      return Object.assign(pose, { armsUp: 0, facing, squash: 1, walk: true });
    }
    if (pt < D.hopUp[1]) {
      // sube de un salto a su taburete
      const squash = hopsBetween(FLOOR_START, STAMPER.pos, (pt - D.hopUp[0]) / (D.hopUp[1] - D.hopUp[0]), 1, 0.2, out);
      return Object.assign(pose, { armsUp: 0, facing: HOP_UP_FACING, squash });
    }
    // en su puesto, con el mentón en las manos, embobado (boceto)
    out.copy(STAMPER.pos);
    return Object.assign(pose, { armsUp: 0, facing: ADMIRE_FACING, squash: 1, chin: smooth((pt - D.hopUp[1]) / 0.6) });
  }
  if (phase === 'celebrate' || phase === 'help') {
    // aplaude (o sigue embobado) desde su taburete
    if (pt > 4.2) return null;
    out.copy(STAMPER.pos);
    const celebrate = phase === 'celebrate';
    return Object.assign(pose, {
      armsUp: 0,
      facing: ADMIRE_FACING,
      squash: 1,
      chin: celebrate ? 1 - smooth(pt / 0.4) : 1 - smooth((pt - 3.4) / 0.6),
      clap: celebrate ? smooth((pt - 0.2) / 0.3) * (1 - smooth((pt - 2.4) / 0.5)) : 0,
    });
  }
  return null;
}

export interface LetterState {
  visible: boolean;
  pos: THREE.Vector3;
  rot: THREE.Euler;
  scale: number;
  /** aplaste vertical (1 = normal) */
  squash: number;
  /** 0 = sobre cerrado, 1 = carta abierta */
  open: number;
  /** aleteo de la solapa durante el vuelo (radianes) */
  flap: number;
  trail: boolean;
}

/** Remolino dorado del final: comienza al disolverse la carta y dura `length` s. */
export const SWIRL = { start: 2.3, length: 2.6, center: new THREE.Vector3(0.9, 0.75, 0.5) } as const;

const rot = new THREE.Euler();
/** Tamaño del sobre en manos del Viejito (legible en el plano cercano). */
const HELD_SCALE = 1.7;
/** Inclinación del sobre sostenido: casi vertical, mirando a la cámara. */
const HELD_TILT = 1.25;
const HELD_YAW = -0.25;
const state: LetterState = {
  visible: false,
  pos: new THREE.Vector3(),
  rot,
  scale: 1,
  squash: 1,
  open: 0,
  flap: 0,
  trail: false,
};

function reset(out: THREE.Vector3): LetterState {
  state.visible = true;
  state.pos = out;
  state.scale = 1;
  state.squash = 1;
  state.open = 0;
  state.flap = 0;
  state.trail = false;
  rot.set(0, 0, 0);
  return state;
}

/**
 * Coreografía del sobre. Sin allocations: devuelve siempre el mismo objeto.
 * Principios: anticipación al aparecer, arco con aleteo, aplaste al aterrizar.
 */
export function letterState(phase: ScenePhase, pt: number, t: number, out: THREE.Vector3): LetterState {
  const s = reset(out);
  if (phase === 'flying') {
    if (pt < 1.5) {
      // aparece con un "pop" (sobrepaso) y vuela en arco dando una voltereta
      const pop = easeOutBack(clamp01(pt / 0.35));
      const k = easeInOutSine(clamp01((pt - 0.1) / 1.4));
      qbezier(START, FLY_CTRL, MAILBOX_SLOT, k, out);
      const wobble = 1 - k;
      rot.set(-0.3 + Math.sin(t * 9) * 0.3 * wobble, k * Math.PI * 2, Math.sin(t * 7) * 0.45 * wobble);
      s.scale = THREE.MathUtils.lerp(1.6, 1, k) * pop;
      s.flap = Math.sin(t * 22) * 0.5 * wobble; // aleteo como alas de papel
      s.trail = true;
      return s;
    }
    if (pt < 1.8) {
      // se estira y entra por la ranura
      const k = (pt - 1.5) / 0.3;
      out.copy(MAILBOX_SLOT).add(tmp.set(0, 0, -0.15 * smooth(k)));
      s.scale = 1 - k * 0.6;
      s.squash = 1 - 0.4 * Math.sin(k * Math.PI);
      return s;
    }
    if (pt < 2.0) {
      s.visible = false;
      return s;
    }
    // sale disparado por arriba y cae en arco a la mesa
    const k = clamp01((pt - 2.0) / 0.5);
    qbezier(POP, POP_CTRL, LAND, easeInOutSine(k), out);
    rot.set((-Math.PI / 2) * k, 0, (1 - k) * 3);
    s.trail = k < 1;
    // aterrizaje: aplaste breve después de tocar la mesa (2.5–2.6 s)
    const land = clamp01((pt - 2.5) / 0.1);
    s.squash = 1 - 0.35 * Math.sin(land * Math.PI);
    s.scale = 1 + 0.12 * Math.sin(land * Math.PI);
    return s;
  }
  if (phase === 'caught') {
    // de la mesa a las manos del duende, vuelta al sillón y a las manos del Viejito
    const sp = stamperPose(phase, pt, tmp2)!;
    const hands = tmp.copy(sp.pos).add(HAND_OFFSET);
    const [g0, g1] = DELIVERY.give;
    if (pt < 0.3) out.copy(LAND).lerp(hands, smooth(pt / 0.3));
    else if (pt < g0) out.copy(hands);
    else {
      // un arquito hacia arriba, de las manos del duende al pecho del Viejito
      const k = easeInOutSine(clamp01((pt - g0) / (g1 - g0)));
      GIVE_CTRL.copy(hands).lerp(READ_POS, 0.5).y += 0.35;
      qbezier(hands, GIVE_CTRL, READ_POS, k, out);
    }
    // pasa de horizontal (en las manos del duende) a vertical frente a la cámara
    const k = smooth((pt - g0) / (g1 - g0));
    rot.set(THREE.MathUtils.lerp(-Math.PI / 2, HELD_TILT, k), THREE.MathUtils.lerp(-0.5, HELD_YAW, k), Math.sin(pt * 10) * 0.08 * (1 - k));
    // al llegar a las manos del Viejito crece para leerse en el plano cercano
    s.scale = 1 + easeOutBack(clamp01((pt - g0) / (g1 - g0))) * (HELD_SCALE - 1);
    return s;
  }
  if (phase === 'reading' || phase === 'help') {
    out.copy(READ_POS);
    out.y += Math.sin(t * 2) * 0.01;
    rot.set(HELD_TILT, HELD_YAW, Math.sin(t * 1.3) * 0.03);
    s.open = easeOutBack(clamp01(pt / 0.6));
    s.scale = HELD_SCALE;
    return s;
  }
  if (phase === 'celebrate') {
    // el Viejito ríe con la carta en las manos; a los 2,2 s la carta se vuelve
    // la cinta dorada que envuelve el taller (ver SWIRL)
    out.copy(READ_POS);
    const laughing = 1 - smooth((pt - 2.0) / 0.3);
    out.y += smooth(pt / 0.5) * 0.1 + Math.sin(pt * 10) * 0.015 * laughing;
    rot.set(HELD_TILT, HELD_YAW, Math.sin(pt * 6) * 0.06 * laughing);
    const fade = 1 - smooth((pt - SWIRL.start + 0.1) / 0.45);
    s.open = 1;
    s.scale = HELD_SCALE * (0.15 + 0.85 * fade);
    s.visible = fade > 0.01;
    return s;
  }
  s.visible = false;
  return s;
}