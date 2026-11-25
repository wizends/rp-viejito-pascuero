import * as THREE from 'three';
import { EMISSION } from './kit';

/**
 * Cinta mágica dorada (la estela luminosa del boceto animado).
 *
 * Es un listón que sigue el recorrido de un punto: guarda los últimos puntos con
 * su edad y en cada cuadro arma una tira orientada a la cámara, con tres vértices
 * de ancho (borde transparente, centro brillante, borde transparente) para que se
 * vea como una luz suave y no como una cinta plana. Se adelgaza y se apaga hacia
 * la cola. Sin allocations por cuadro: el búfer se reserva una vez.
 */
export class MagicRibbon {
  readonly geometry = new THREE.BufferGeometry();
  private readonly pts: { p: THREE.Vector3; age: number }[];
  private count = 0;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly tangent = new THREE.Vector3();
  private readonly view = new THREE.Vector3();
  private readonly side = new THREE.Vector3();

  constructor(
    readonly capacity = 64,
    /** ancho máximo (m) */
    public width = 0.09,
    /** segundos que vive cada punto */
    public life = 0.9,
    /** color HDR del centro (sobre el umbral del bloom) */
    public color = new THREE.Color('#ffd76a').multiplyScalar(EMISSION.ribbon),
  ) {
    this.pts = Array.from({ length: capacity }, () => ({ p: new THREE.Vector3(), age: Infinity }));
    this.pos = new Float32Array(capacity * 3 * 3);
    this.col = new Float32Array(capacity * 3 * 4);
    const idx: number[] = [];
    for (let i = 0; i < capacity - 1; i++) {
      const a = i * 3;
      const b = (i + 1) * 3;
      // dos franjas (borde-centro y centro-borde) por segmento
      idx.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2);
    }
    this.geometry.setIndex(idx);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setDrawRange(0, 0);
  }

  /** Cantidad de puntos vivos. */
  get size() {
    return this.count;
  }

  /** Agrega la nueva cabeza de la cinta. Si apenas se movió, solo la arrastra. */
  push(p: THREE.Vector3, minStep = 0.035) {
    const head = this.pts[0]!;
    if (this.count > 1 && head.p.distanceTo(this.pts[1]!.p) < minStep) {
      head.p.copy(p);
      head.age = 0;
      return;
    }
    const recycled = this.pts.pop()!;
    recycled.p.copy(p);
    recycled.age = 0;
    this.pts.unshift(recycled);
    this.count = Math.min(this.capacity, this.count + 1);
  }

  /** Vacía la cinta (por ejemplo, al empezar otra cinemática). */
  clear() {
    for (const q of this.pts) q.age = Infinity;
    this.count = 0;
    this.geometry.setDrawRange(0, 0);
  }

  /**
   * Envejece los puntos y reconstruye la tira mirando a `camera`.
   * `alpha` atenúa toda la cinta (para desvanecerla al final).
   */
  update(dt: number, camera: THREE.Vector3, alpha = 1) {
    for (let i = 0; i < this.count; i++) this.pts[i]!.age += dt;
    while (this.count > 0 && this.pts[this.count - 1]!.age > this.life) this.count--;
    const n = this.count;
    if (n < 2) {
      this.geometry.setDrawRange(0, 0);
      return;
    }
    const c = this.color;
    for (let i = 0; i < n; i++) {
      const cur = this.pts[i]!;
      const prev = this.pts[Math.max(0, i - 1)]!.p;
      const next = this.pts[Math.min(n - 1, i + 1)]!.p;
      this.tangent.subVectors(prev, next);
      if (this.tangent.lengthSq() < 1e-10) this.tangent.set(1, 0, 0);
      this.view.subVectors(camera, cur.p);
      this.side.crossVectors(this.tangent, this.view);
      if (this.side.lengthSq() < 1e-10) this.side.set(0, 1, 0);
      this.side.normalize();
      // vida 0..1 (1 = recién nacido); la punta nace fina para no verse cortada
      const k = Math.max(0, 1 - cur.age / this.life);
      const tipIn = Math.min(1, i / 3 + 0.25);
      const w = this.width * k * tipIn;
      const a = k * k * alpha;
      const o = i * 9;
      for (let j = 0; j < 3; j++) {
        const s = (j - 1) * w;
        this.pos[o + j * 3] = cur.p.x + this.side.x * s;
        this.pos[o + j * 3 + 1] = cur.p.y + this.side.y * s;
        this.pos[o + j * 3 + 2] = cur.p.z + this.side.z * s;
        const ca = j === 1 ? a : 0;
        const q = i * 12 + j * 4;
        this.col[q] = c.r;
        this.col[q + 1] = c.g;
        this.col[q + 2] = c.b;
        this.col[q + 3] = ca;
      }
    }
    this.geometry.setDrawRange(0, (n - 1) * 12);
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}

/** Material aditivo HDR para la cinta: brilla con el bloom y no tapa la escena. */
export function ribbonMaterial() {
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/**
 * Recorrido del remolino dorado del final (boceto: la magia envuelve la escena).
 * Nace en `from` (la carta), abre una espiral elíptica que sube alrededor del
 * taller y se pierde arriba. `k` en 0..1.
 */
export function swirlPath(k: number, from: THREE.Vector3, center: THREE.Vector3, out: THREE.Vector3) {
  const kk = Math.min(1, Math.max(0, k));
  const a = 0.35 + kk * Math.PI * 2 * 1.35;
  const r = 0.4 + Math.sin(Math.min(1, kk * 1.6) * Math.PI * 0.5) * 1.0;
  out.set(center.x + Math.cos(a) * 2.7 * r, center.y + kk * 1.7 + Math.sin(a * 2) * 0.18, center.z + Math.sin(a) * 1.35 * r);
  // los primeros instantes salen desde la carta y se funden con la espiral
  const blend = Math.min(1, kk / 0.12);
  const e = blend * blend * (3 - 2 * blend);
  return out.lerpVectors(from, out, e);
}
