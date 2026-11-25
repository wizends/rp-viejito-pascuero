import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GEO, PALETTE, toon } from './kit';
import { ROOM } from './Room';
import { clampDt, rngFor } from './debug';

const skyVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
/** Cielo de invierno nublado: degradado gris azulado y nubes difusas que pasan lento. */
const skyFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  float blob(vec2 p, vec2 c, vec2 r) { vec2 d = (p - c) / r; return 1.0 - smoothstep(0.96, 1.0, dot(d, d)); }
  float cloud(vec2 p, vec2 c, float s) {
    float m = blob(p, c, vec2(0.11, 0.05) * s);
    m = max(m, blob(p, c + vec2(-0.07, 0.02) * s, vec2(0.06, 0.05) * s));
    m = max(m, blob(p, c + vec2(0.05, 0.035) * s, vec2(0.065, 0.06) * s));
    return m;
  }
  void main(){
    vec2 uv = vUv;
    // tarde nublada y nevada (boceto): gris azulado suave, sin sol
    vec3 top = vec3(0.66, 0.73, 0.75);
    vec3 bottom = vec3(0.86, 0.88, 0.86);
    vec3 col = mix(bottom, top, smoothstep(0.1, 0.95, uv.y));
    // nubes grandes y difusas que pasan lento
    float t = uTime * 0.008;
    float c = 0.0;
    c = max(c, cloud(vec2(fract(uv.x + t), uv.y), vec2(0.25, 0.76), 1.6));
    c = max(c, cloud(vec2(fract(uv.x + t * 0.7 + 0.4), uv.y), vec2(0.6, 0.66), 1.3));
    c = max(c, cloud(vec2(fract(uv.x + t * 1.3 + 0.7), uv.y), vec2(0.1, 0.56), 1.1));
    col = mix(col, vec3(0.92, 0.93, 0.91), c * 0.55);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Cielo de día, cerros nevados y nieve suave, vistos por la ventana. */
export function Outside({ reduced }: { reduced: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        uniforms: { uTime: { value: 0 } },
        depthWrite: false,
      }),
    [],
  );
  useFrame((_, dt) => {
    mat.uniforms.uTime!.value += reduced ? dt * 0.15 : dt;
  });
  const { x, y } = ROOM.window;
  const z = ROOM.backZ;
  return (
    <group>
      <mesh position={[x, y + 0.4, z - 4]} material={mat}>
        <planeGeometry args={[9, 5.5]} />
      </mesh>
      {/* lomas nevadas y pinos con nieve */}
      <mesh position={[x - 1.2, y - 1.6, z - 2.6]} material={toon('#f4f1ea')} geometry={GEO.sphere} scale={[2.2, 1.2, 0.6]} />
      <mesh position={[x + 1.6, y - 1.7, z - 2.2]} material={toon('#e4e6e1')} geometry={GEO.sphere} scale={[2.0, 1.0, 0.6]} />
      {[-1.6, -0.9, 0.9, 1.5].map((px, i) => (
        <group key={px} position={[x + px, y - 0.9 + (i % 2) * 0.1, z - 1.7]} scale={0.6 + (i % 2) * 0.15}>
          <mesh material={toon(PALETTE.pino)} geometry={GEO.cone} position={[0, 0.5, 0]} scale={[0.35, 0.8, 0.35]} />
          <mesh material={toon(PALETTE.blanco)} geometry={GEO.cone} position={[0, 0.78, 0]} scale={[0.2, 0.35, 0.2]} />
        </group>
      ))}
      <Snowfall reduced={reduced} />
    </group>
  );
}

const FLAKES = 260;

/** Nieve con InstancedMesh: un solo draw call para todos los copos. */
function Snowfall({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { x, y, w } = ROOM.window;
  const data = useMemo(() => {
    const rnd = rngFor(1);
    const arr = new Float32Array(FLAKES * 5); // x, y, z, velocidad, fase
    for (let i = 0; i < FLAKES; i++) {
      arr[i * 5] = x + (rnd() - 0.5) * (w + 3);
      arr[i * 5 + 1] = y + (rnd() - 0.5) * 4;
      arr[i * 5 + 2] = ROOM.backZ - 0.4 - rnd() * 3;
      arr[i * 5 + 3] = 0.25 + rnd() * 0.45;
      arr[i * 5 + 4] = rnd() * Math.PI * 2;
    }
    return arr;
  }, [x, y, w]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fbf8f2' }), []);

  useFrame((state, rawDt) => {
    const dt = clampDt(rawDt);
    const mesh = ref.current;
    if (!mesh) return;
    const speed = reduced ? 0.2 : 1;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < FLAKES; i++) {
      const o = i * 5;
      data[o + 1]! -= data[o + 3]! * dt * speed;
      if (data[o + 1]! < y - 2.2) data[o + 1] = y + 2.2;
      const sway = Math.sin(t * 0.8 + data[o + 4]!) * 0.15 * speed;
      const s = 0.02 + (data[o + 3]! - 0.25) * 0.04;
      m.makeScale(s, s, s);
      m.setPosition(data[o]! + sway, data[o + 1]!, data[o + 2]!);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[GEO.sphereLow, mat, FLAKES]} frustumCulled={false} />;
}
