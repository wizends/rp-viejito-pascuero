import * as THREE from 'three';

/**
 * Kit de animación de la escena. Todo es independiente de los FPS (usa `dt`)
 * y no crea objetos por cuadro.
 */

/** Amortiguación exponencial: igual a 30, 60 o 120 fps. `lambda` ≈ rapidez (1/s). */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  THREE.MathUtils.damp(current, target, lambda, dt);

/** Amortigua un ángulo por el camino más corto (evita giros de 350°). */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let d = (target - current) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-lambda * dt));
}

/**
 * Resorte amortiguado 1D (masa unitaria). Da inercia y rebote natural a gorros,
 * panzas, orejas y colitas: la "acción secundaria" de la animación clásica.
 */
export class Spring {
  value: number;
  velocity = 0;

  constructor(
    initial = 0,
    public stiffness = 120,
    public damping = 10,
  ) {
    this.value = initial;
  }

  /** Avanza hacia `target`. Integra en sub-pasos para estabilidad con dt grandes. */
  update(target: number, dt: number): number {
    // sub-pasos de ≤1/120 s (hasta 1 s): estable aun con muy pocos FPS
    const span = Math.min(dt, 1);
    const steps = Math.min(120, Math.max(1, Math.ceil(span / (1 / 120))));
    const h = span / steps;
    for (let i = 0; i < steps; i++) {
      const force = (target - this.value) * this.stiffness - this.velocity * this.damping;
      this.velocity += force * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  /** Golpe de energía: útil para "jo jo jo", aterrizajes y sustos. */
  kick(impulse: number) {
    this.velocity += impulse;
  }
}

export interface HopPose {
  /** altura sobre el suelo */
  y: number;
  /** escala vertical (1 = normal; <1 aplastado; >1 estirado) */
  squash: number;
}

/**
 * Un saltito con principios de animación: anticipación (se agacha), despegue
 * estirado, vuelo parabólico y aplaste al aterrizar. `t` en 0..1.
 * Registro de cuento ilustrado: deformaciones sutiles, nada de goma.
 */
export function hop(t: number, height: number, out: HopPose): HopPose {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  if (x < 0.18) {
    // anticipación
    const k = Math.sin((x / 0.18) * Math.PI * 0.5);
    out.y = 0;
    out.squash = 1 - 0.07 * k;
  } else if (x < 0.82) {
    const k = (x - 0.18) / 0.64;
    out.y = height * 4 * k * (1 - k);
    // estirado al subir y al caer, redondito en la cima
    out.squash = 1 + 0.04 * Math.abs(1 - 2 * k);
  } else {
    // aterrizaje: aplaste que se recupera
    const k = (x - 0.82) / 0.18;
    out.y = 0;
    out.squash = 1 - 0.08 * Math.sin(k * Math.PI);
  }
  return out;
}

export interface StepPose {
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  bob: number;
  sway: number;
}

/**
 * Ciclo de paso chibi: piernas y brazos opuestos, rebote dos veces por ciclo
 * y balanceo lateral. `phase` en radianes; `amount` 0..1 mezcla con el reposo.
 */
export function stepCycle(phase: number, amount: number, out: StepPose): StepPose {
  const s = Math.sin(phase);
  out.legL = s * 0.7 * amount;
  out.legR = -s * 0.7 * amount;
  out.armL = -s * 0.6 * amount;
  out.armR = s * 0.6 * amount;
  out.bob = Math.abs(Math.cos(phase)) * 0.045 * amount;
  out.sway = Math.sin(phase) * 0.06 * amount;
  return out;
}

/**
 * Posición del sobre en el mundo, compartida para que los personajes lo miren.
 * La escribe FlyingLetter cada cuadro; `visible` indica si hay algo que mirar.
 */
export const letterTracker = { pos: new THREE.Vector3(), visible: false };

const tmpV = new THREE.Vector3();
const tmpM = new THREE.Matrix4();

/**
 * Ángulos (yaw, pitch) locales para que una cabeza mire a `target`.
 * `parent` es el objeto padre de la cabeza (su rotación ya aplicada).
 */
export function lookAngles(
  head: THREE.Object3D,
  target: THREE.Vector3,
  out: { yaw: number; pitch: number },
  maxYaw = 1.0,
  maxPitch = 0.5,
) {
  const parent = head.parent;
  if (!parent) return out;
  tmpM.copy(parent.matrixWorld).invert();
  tmpV.copy(target).applyMatrix4(tmpM).sub(head.position);
  out.yaw = THREE.MathUtils.clamp(Math.atan2(tmpV.x, tmpV.z), -maxYaw, maxYaw);
  const horiz = Math.hypot(tmpV.x, tmpV.z);
  out.pitch = THREE.MathUtils.clamp(-Math.atan2(tmpV.y, horiz), -maxPitch, maxPitch);
  return out;
}
