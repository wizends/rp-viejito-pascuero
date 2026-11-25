import * as THREE from 'three';

/**
 * Posiciones clave del taller, compartidas por la escena y la cinemática.
 * Todo en metros, con el origen en el centro del piso.
 */
export const TABLE = { x: -0.6, z: 0.2, w: 3.0, d: 1.3, top: 0.85 };
export const MAILBOX = new THREE.Vector3(0.55, TABLE.top, -0.15);
/** Boca del buzón (la puerta delantera está abierta). */
export const MAILBOX_SLOT = new THREE.Vector3(0.55, TABLE.top + 0.27, 0.22);
export const LAND = new THREE.Vector3(0.45, TABLE.top + 0.03, 0.55);

export const SANTA = { pos: new THREE.Vector3(2.45, 0, 0.05), rotY: -0.5 };
/** Punto frente al pecho del Viejito (delante de la barba) donde sostiene la carta al leer. */
export const READ_POS = new THREE.Vector3(0, 1.27, 0.68)
  .applyAxisAngle(new THREE.Vector3(0, 1, 0), SANTA.rotY)
  .add(SANTA.pos);

export const STAMPER = { pos: new THREE.Vector3(1.3, 0.42, 0.6), rotY: -0.35 };

export const SLEEPER = { pos: new THREE.Vector3(-1.75, 0.42, 0.75), rotY: 0.3 };
export const SORTER = { pos: new THREE.Vector3(-1.55, 0, -2.45), rotY: 0 };
export const LADDER = { pos: new THREE.Vector3(0.75, 0, -2.95), rotY: 0 };
export const TREE = { pos: new THREE.Vector3(-3.95, 0, 0.55) };
/** Establo en la pared del fondo, a la izquierda de la ventana. */
export const STABLE = { pos: new THREE.Vector3(-4.05, 0, -3.55), rotY: 0 };

/** Recorrido del duende del carrito: óvalo frente a la mesa. */
export function cartPath(t: number, out: THREE.Vector3): THREE.Vector3 {
  const a = t * Math.PI * 2;
  return out.set(-0.9 + Math.cos(a) * 2.2, 0, 2.05 + Math.sin(a) * 0.5);
}

export const CAMERA = {
  pos: new THREE.Vector3(0, 2.35, 7.6),
  target: new THREE.Vector3(-0.2, 1.35, 0),
  mobilePos: new THREE.Vector3(0.3, 2.6, 9.6),
};
