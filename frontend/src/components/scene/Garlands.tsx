import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BULB_COLORS, bulbColorIndex, bulbIntensity, useLights } from '@/stores/lights';
import { EMISSION, GEO, PALETTE, toon } from './kit';
import { ROOM } from './Room';
import { TREE } from './layout';

interface Strand {
  curve: THREE.Curve<THREE.Vector3>;
  bulbs: number;
}

/** Guirnalda colgante (catenaria aproximada) entre dos puntos, con varios tramos. */
function swagCurve(a: THREE.Vector3, b: THREE.Vector3, swags: number, sag: number) {
  const pts: THREE.Vector3[] = [];
  const steps = swags * 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = (t * swags) % 1;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * u * (1 - u);
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}

/** Espiral alrededor del árbol. */
function spiralCurve() {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const h = 0.55 + t * 2.75;
    const r = (1 - t) * 1.25 + 0.12;
    const a = t * Math.PI * 2 * 3.2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, h, Math.sin(a) * r).add(TREE.pos));
  }
  return new THREE.CatmullRomCurve3(pts);
}

const MAX_LIGHTS = 3;

/**
 * Todas las ampolletas son UN InstancedMesh con material emisivo (Bloom las hace brillar).
 * Solo 3 PointLights reales iluminan la sala, con color promedio de su zona.
 */
export function Garlands({ reduced, lowPower }: { reduced: boolean; lowPower: boolean }) {
  const strands = useMemo<Strand[]>(() => {
    const y = ROOM.height - 0.55;
    const z = ROOM.backZ + 0.1;
    const w = ROOM.window;
    return [
      { curve: swagCurve(new THREE.Vector3(-5.3, y, z), new THREE.Vector3(5.3, y, z), 5, 0.45), bulbs: 34 },
      {
        curve: swagCurve(
          new THREE.Vector3(w.x - w.w / 2 - 0.1, w.y + w.h / 2 + 0.12, z + 0.08),
          new THREE.Vector3(w.x + w.w / 2 + 0.1, w.y + w.h / 2 + 0.12, z + 0.08),
          2,
          0.22,
        ),
        bulbs: 12,
      },
      {
        curve: swagCurve(new THREE.Vector3(2.0, 1.86, -2.75), new THREE.Vector3(4.0, 1.86, -2.75), 2, 0.2),
        bulbs: 10,
      },
      { curve: spiralCurve(), bulbs: 30 },
    ];
  }, []);

  const total = strands.reduce((n, s) => n + s.bulbs, 0);
  const positions = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (const s of strands) {
      for (let i = 0; i < s.bulbs; i++) out.push(s.curve.getPointAt((i + 0.5) / s.bulbs));
    }
    return out;
  }, [strands]);

  const wires = useMemo(
    () => strands.map((s) => new THREE.TubeGeometry(s.curve, 120, 0.012, 5, false)),
    [strands],
  );

  const mesh = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color(), acc: [0, 1, 2].map(() => new THREE.Color()) }), []);
  const palette = useMemo(() => BULB_COLORS.map((c) => new THREE.Color(c)), []);
  const off = useMemo(() => new THREE.Color('#3b3a44'), []);

  // matrices fijas: se escriben una sola vez
  useLayoutEffect(() => {
    positions.forEach((p, i) => {
      tmp.m.makeScale(0.045, 0.065, 0.045).setPosition(p.x, p.y - 0.05, p.z);
      mesh.current?.setMatrixAt(i, tmp.m);
      tmp.m.makeScale(0.022, 0.03, 0.022).setPosition(p.x, p.y, p.z);
      caps.current?.setMatrixAt(i, tmp.m);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    if (caps.current) caps.current.instanceMatrix.needsUpdate = true;
  }, [positions, tmp]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const { mode, sweepStart } = useLights.getState();
    const now = performance.now();
    const zoneTotals = [0, 0, 0];
    tmp.acc.forEach((c) => c.setRGB(0, 0, 0));
    for (let i = 0; i < total; i++) {
      const k = bulbIntensity(mode, sweepStart, i, total, now, reduced);
      if (k <= 0.001) {
        tmp.c.copy(off);
      } else {
        const base = palette[bulbColorIndex(mode, i, now)]!;
        tmp.c.copy(off).lerp(base, Math.min(1, k)).multiplyScalar(EMISSION.bulbBase * Math.min(1, k) + (EMISSION.bulbPeak - EMISSION.bulbBase) * Math.max(0, k - 1));
        const zone = positions[i]!.x < -1.8 ? 0 : positions[i]!.x < 1.8 ? 1 : 2;
        tmp.acc[zone]!.r += base.r * k;
        tmp.acc[zone]!.g += base.g * k;
        tmp.acc[zone]!.b += base.b * k;
        zoneTotals[zone]! += k;
      }
      m.setColorAt(i, tmp.c);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    lights.current.forEach((l, z) => {
      if (!l) return;
      const k = zoneTotals[z]!;
      if (k > 0) l.color.copy(tmp.acc[z]!).multiplyScalar(1 / k);
      l.intensity = THREE.MathUtils.lerp(l.intensity, Math.min(3.2, k * 0.22), 0.2);
    });
  });

  return (
    <group>
      {wires.map((g, i) => (
        <mesh key={i} geometry={g} material={toon('#173d28')} />
      ))}
      <instancedMesh ref={mesh} args={[GEO.sphereLow, material, total]} frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[new Float32Array(total * 3), 3]} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[GEO.cylinder, toon(PALETTE.pino), total]} frustumCulled={false} />
      {!lowPower &&
        [-3.4, 0, 3.2].slice(0, MAX_LIGHTS).map((x, i) => (
          <pointLight
            key={x}
            ref={(el) => (lights.current[i] = el)}
            position={[x, ROOM.height - 1.2, ROOM.backZ + 1.2]}
            intensity={0}
            distance={6}
            decay={1.8}
          />
        ))}
    </group>
  );
}
