import * as THREE from 'three';

/**
 * Kit de geometría orgánica (adaptado de los principios de la skill
 * threejs-procedural-geometry a personajes blandos):
 *  - una forma continua = UNA superficie (loft / sweep), no primitivas intersectadas;
 *  - anillos cerrados sin costura duplicada → normales suaves dentro de cada parte;
 *  - extremos redondeados con anillos que se cierran en cúpula (sin tapas planas);
 *  - resolución según radio visible (16–40 segmentos).
 * Convención: Y arriba, +Z hacia adelante, metros.
 */

export type Ring = THREE.Vector3[];

/** Superelipse horizontal (en XZ) a altura y. `wave` modula el radio por ángulo (rulos). */
export function ringXZ(
  center: THREE.Vector3,
  rx: number,
  rz: number,
  segments: number,
  opts: { exp?: number; wave?: (theta: number) => number; frontBulge?: number } = {},
): Ring {
  const { exp = 2.2, wave, frontBulge = 0 } = opts;
  const out: Ring = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    // superelipse: |x|^e + |z|^e = 1
    const x = Math.sign(s) * Math.pow(Math.abs(s), 2 / exp);
    const z = Math.sign(c) * Math.pow(Math.abs(c), 2 / exp);
    const k = wave ? wave(t) : 1;
    // panza: empuja solo la mitad delantera (c > 0) con caída suave
    const bulge = frontBulge * Math.max(0, c) ** 2;
    out.push(new THREE.Vector3(center.x + x * rx * k, center.y, center.z + z * rz * k + bulge));
  }
  return out;
}

/**
 * Loft entre anillos (todos con la misma cantidad de puntos). Cierra los
 * extremos con un vértice polar (cúpula) para que no haya bordes duros.
 */
export function loft(rings: Ring[], opts: { capStart?: boolean; capEnd?: boolean; capLift?: number } = {}) {
  const { capStart = true, capEnd = true, capLift = 0 } = opts;
  const n = rings[0]!.length;
  const pos: number[] = [];
  for (const r of rings) for (const p of r) pos.push(p.x, p.y, p.z);
  const idx: number[] = [];
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * n + i;
      const b = j * n + ((i + 1) % n);
      const c = (j + 1) * n + i;
      const d = (j + 1) * n + ((i + 1) % n);
      // (b−a)×(c−a) apunta hacia afuera con anillos antihorarios vistos desde +Y
      idx.push(a, b, c, b, d, c);
    }
  }
  const pole = (ring: Ring, dir: number) => {
    const c = new THREE.Vector3();
    for (const p of ring) c.add(p);
    c.multiplyScalar(1 / ring.length);
    c.y += capLift * dir;
    pos.push(c.x, c.y, c.z);
    return pos.length / 3 - 1;
  };
  if (capStart) {
    const pi = pole(rings[0]!, -1);
    for (let i = 0; i < n; i++) idx.push(pi, (i + 1) % n, i);
  }
  if (capEnd) {
    const base = (rings.length - 1) * n;
    const pi = pole(rings[rings.length - 1]!, 1);
    for (let i = 0; i < n; i++) idx.push(pi, base + i, base + ((i + 1) % n));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Marcos por transporte paralelo a lo largo de una polilínea (sin giros bruscos). */
export function transportFrames(points: THREE.Vector3[], up = new THREE.Vector3(0, 0, 1)) {
  const T: THREE.Vector3[] = [];
  const N: THREE.Vector3[] = [];
  const B: THREE.Vector3[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)]!;
    const b = points[Math.min(points.length - 1, i + 1)]!;
    T.push(b.clone().sub(a).normalize());
  }
  let n = up.clone().sub(T[0]!.clone().multiplyScalar(up.dot(T[0]!)));
  if (n.lengthSq() < 1e-6) n = new THREE.Vector3(1, 0, 0);
  n.normalize();
  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      // rota la normal anterior con la mínima rotación entre tangentes
      const q = new THREE.Quaternion().setFromUnitVectors(T[i - 1]!, T[i]!);
      n = n.clone().applyQuaternion(q).normalize();
    }
    N.push(n.clone());
    B.push(T[i]!.clone().cross(n).normalize());
  }
  return { T, N, B };
}

/**
 * Tubo barrido con radio variable y extremos en cúpula. `radius(t)` con t∈[0,1].
 * `flatten` aplana la sección (1 = circular).
 */
export function sweep(
  points: THREE.Vector3[],
  radius: (t: number) => number,
  opts: { radial?: number; domeRings?: number; flatten?: number; up?: THREE.Vector3; capStart?: boolean; capEnd?: boolean } = {},
) {
  const { radial = 20, domeRings = 4, flatten = 1, up, capStart = true, capEnd = true } = opts;
  const { T, N, B } = transportFrames(points, up);
  const rings: Ring[] = [];
  const ringAt = (i: number, r: number, shift: number) => {
    const ring: Ring = [];
    const c = points[i]!.clone().addScaledVector(T[i]!, shift);
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      ring.push(
        c.clone()
          .addScaledVector(N[i]!, Math.cos(a) * r * flatten)
          .addScaledVector(B[i]!, Math.sin(a) * r),
      );
    }
    return ring;
  };
  const last = points.length - 1;
  const r0 = radius(0);
  const r1 = radius(1);
  // cúpula inicial: anillos que se cierran hacia atrás
  if (capStart)
    for (let d = domeRings; d >= 1; d--) {
      const a = (d / (domeRings + 1)) * (Math.PI / 2);
      rings.push(ringAt(0, r0 * Math.cos(a), -r0 * Math.sin(a)));
    }
  for (let i = 0; i <= last; i++) rings.push(ringAt(i, radius(i / last), 0));
  if (capEnd)
    for (let d = 1; d <= domeRings; d++) {
      const a = (d / (domeRings + 1)) * (Math.PI / 2);
      rings.push(ringAt(last, r1 * Math.cos(a), r1 * Math.sin(a)));
    }
  return loft(rings, { capStart, capEnd });
}

/** Puntos de una Bézier cúbica (para columnas de brazos, bigote, cejas). */
export function bezierPoints(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, steps: number) {
  const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
  return curve.getPoints(steps);
}

/**
 * Deformador por campos: guarda la forma de reposo y desplaza los vértices por
 * su normal según varios campos de peso que se SUMAN (p. ej. pecho y panza).
 * Así el abrigo respira y la panza tiembla sin partir la malla en piezas.
 */
export class FieldDeformer {
  private base: Float32Array;
  private normals: Float32Array;
  readonly weights: Float32Array[];

  constructor(
    private geometry: THREE.BufferGeometry,
    fields: ((p: THREE.Vector3) => number)[],
  ) {
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    this.base = Float32Array.from(pos.array as Float32Array);
    this.normals = Float32Array.from((geometry.getAttribute('normal') as THREE.BufferAttribute).array as Float32Array);
    const v = new THREE.Vector3();
    this.weights = fields.map((field) => {
      const w = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) w[i] = field(v.fromArray(this.base, i * 3));
      return w;
    });
    pos.setUsage(THREE.DynamicDrawUsage);
  }

  /** `amounts[k]` metros por la normal para el campo k; `lifts[k]` metros hacia arriba. */
  apply(amounts: number[], lifts: number[] = []) {
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const n = arr.length / 3;
    for (let i = 0; i < n; i++) {
      let push = 0;
      let lift = 0;
      for (let k = 0; k < this.weights.length; k++) {
        const w = this.weights[k]![i]!;
        if (w === 0) continue;
        push += (amounts[k] ?? 0) * w;
        lift += (lifts[k] ?? 0) * w;
      }
      const o = i * 3;
      arr[o] = this.base[o]! + this.normals[o]! * push;
      arr[o + 1] = this.base[o + 1]! + this.normals[o + 1]! * push + lift;
      arr[o + 2] = this.base[o + 2]! + this.normals[o + 2]! * push;
    }
    pos.needsUpdate = true;
  }
}
/**
 * Cadena verlet (gorro, pompón). La raíz sigue a su padre; los demás nodos
 * caen con gravedad, conservan largo de segmento y vuelven a su forma de
 * reposo con una rigidez de flexión. dt acotado por quien llama.
 */
export class VerletChain {
  readonly points: THREE.Vector3[];
  private prev: THREE.Vector3[];
  private rest: THREE.Vector3[]; // forma de reposo en el espacio del ancla
  private lengths: number[];

  constructor(
    restLocal: THREE.Vector3[],
    public stiffness = 18,
    public damping = 0.9,
    public gravity = -4.5,
  ) {
    this.rest = restLocal.map((p) => p.clone());
    this.points = restLocal.map((p) => p.clone());
    this.prev = restLocal.map((p) => p.clone());
    this.lengths = restLocal.slice(1).map((p, i) => p.distanceTo(restLocal[i]!));
  }

  private tmp = new THREE.Vector3();
  private target = new THREE.Vector3();

  /** Reubica toda la cadena en reposo según la matriz del ancla (al montar). */
  reset(anchor: THREE.Matrix4) {
    this.rest.forEach((r, i) => {
      this.points[i]!.copy(r).applyMatrix4(anchor);
      this.prev[i]!.copy(this.points[i]!);
    });
  }

  step(anchor: THREE.Matrix4, dt: number) {
    const pts = this.points;
    // la raíz queda fija al ancla
    pts[0]!.copy(this.rest[0]!).applyMatrix4(anchor);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i]!;
      const v = this.tmp.copy(p).sub(this.prev[i]!).multiplyScalar(this.damping);
      this.prev[i]!.copy(p);
      p.add(v);
      p.y += this.gravity * dt * dt;
      // vuelve a la forma de reposo (rigidez de flexión), más fuerte cerca de la raíz
      this.target.copy(this.rest[i]!).applyMatrix4(anchor);
      const k = Math.min(1, this.stiffness * dt * (1 - (i / pts.length) * 0.55));
      p.lerp(this.target, k);
    }
    // restricciones de largo (2 iteraciones bastan para 6 nodos)
    for (let it = 0; it < 2; it++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        const d = this.tmp.copy(b).sub(a);
        const len = d.length() || 1e-6;
        const diff = (len - this.lengths[i - 1]!) / len;
        b.addScaledVector(d, -diff);
      }
    }
  }
}

/**
 * Reescribe los vértices de un tubo barrido existente siguiendo una nueva
 * columna (misma cantidad de puntos). Para el gorro con física.
 */
export class DynamicTube {
  readonly geometry: THREE.BufferGeometry;
  private radial: number;
  private count: number;
  private radii: number[];
  private domeRings: number;

  constructor(points: THREE.Vector3[], radius: (t: number) => number, radial = 22, domeRings = 3) {
    this.radial = radial;
    this.count = points.length;
    this.domeRings = domeRings;
    this.radii = points.map((_, i) => radius(i / (points.length - 1)));
    this.geometry = sweep(points, radius, { radial, domeRings, capStart: false, capEnd: true });
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  }

  update(points: THREE.Vector3[]) {
    const { T, N, B } = transportFrames(points);
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    let o = 0;
    const write = (c: THREE.Vector3, n: THREE.Vector3, b: THREE.Vector3, r: number) => {
      for (let k = 0; k < this.radial; k++) {
        const a = (k / this.radial) * Math.PI * 2;
        const ca = Math.cos(a) * r;
        const sa = Math.sin(a) * r;
        arr[o++] = c.x + n.x * ca + b.x * sa;
        arr[o++] = c.y + n.y * ca + b.y * sa;
        arr[o++] = c.z + n.z * ca + b.z * sa;
      }
    };
    const c = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) write(points[i]!, N[i]!, B[i]!, this.radii[i]!);
    const last = this.count - 1;
    const r1 = this.radii[last]!;
    for (let d = 1; d <= this.domeRings; d++) {
      const a = (d / (this.domeRings + 1)) * (Math.PI / 2);
      c.copy(points[last]!).addScaledVector(T[last]!, r1 * Math.sin(a));
      write(c, N[last]!, B[last]!, r1 * Math.cos(a));
    }
    // polo final
    c.copy(points[last]!).addScaledVector(T[last]!, r1);
    arr[o++] = c.x;
    arr[o++] = c.y;
    arr[o++] = c.z;
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}
