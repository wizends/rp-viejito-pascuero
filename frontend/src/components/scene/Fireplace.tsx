import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GEO, PALETTE, toon } from './kit';
import { ROOM } from './Room';
import { clampDt } from './debug';

const fireVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
/** Fuego estilizado: llamas con ruido que suben y se afinan hacia arriba. */
const fireFrag = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
  }
  void main(){
    vec2 uv = vUv;
    float n = noise(vec2(uv.x * 4.0 + uSeed, uv.y * 3.0 - uTime * 2.2)) * 0.6
            + noise(vec2(uv.x * 9.0 - uSeed, uv.y * 6.0 - uTime * 3.6)) * 0.4;
    float width = mix(0.48, 0.04, pow(uv.y, 0.8));
    float d = abs(uv.x - 0.5);
    float flame = smoothstep(width, width * 0.35, d + (n - 0.5) * 0.25 * uv.y);
    flame *= smoothstep(1.0, 0.55, uv.y + n * 0.25);
    vec3 col = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.85, 0.35), flame * (1.0 - uv.y));
    gl_FragColor = vec4(col * 2.2, flame);
  }
`;

/** Piedras de río redondeadas con mortero (chimenea del boceto), dibujadas en canvas. */
function useStoneTexture(rx: number, ry: number): THREE.Texture {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#7d6c5a';
    g.fillRect(0, 0, 256, 256);
    const tones = ['#bdae96', '#a99a84', '#c9bca4', '#b3a28a', '#9d8e7a'];
    let i = 0;
    for (let y = 0; y < 256 + 32; y += 32) {
      for (let x = (y / 32) % 2 ? -24 : 0; x < 256 + 48; x += 48) {
        i++;
        const w = 20 + ((i * 7) % 6);
        const h = 13 + ((i * 5) % 3);
        g.fillStyle = tones[i % tones.length]!;
        g.beginPath();
        g.ellipse(x + 24, y + 16, w, h, ((i % 5) - 2) * 0.05, 0, Math.PI * 2);
        g.fill();
        // luz arriba y sombra abajo: volumen pintado
        g.fillStyle = 'rgba(255,245,225,0.22)';
        g.beginPath();
        g.ellipse(x + 22, y + 12, w * 0.7, h * 0.45, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [rx, ry]);
}

export function Fireplace({ reduced }: { reduced: boolean }) {
  const { x, z } = ROOM.fireplace;
  const light = useRef<THREE.PointLight>(null);
  const mats = useMemo(
    () =>
      [0, 1.7, 3.1].map(
        (seed) =>
          new THREE.ShaderMaterial({
            vertexShader: fireVert,
            fragmentShader: fireFrag,
            uniforms: { uTime: { value: 0 }, uSeed: { value: seed } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }),
      ),
    [],
  );
  useFrame((state, rawDt) => {
    const dt = clampDt(rawDt);
    for (const m of mats) m.uniforms.uTime!.value += dt * (reduced ? 0.3 : 1);
    if (light.current) {
      const t = state.clock.elapsedTime;
      const flicker = reduced ? 0 : Math.sin(t * 13) * 0.15 + Math.sin(t * 7.3) * 0.2 + Math.sin(t * 23.1) * 0.08;
      light.current.intensity = 9 + flicker * 4;
    }
  });

  const bodyTex = useStoneTexture(2.2, 2);
  const chimneyTex = useStoneTexture(1.4, 4);
  const brick = useMemo(() => new THREE.MeshToonMaterial({ map: bodyTex, color: '#ffffff' }), [bodyTex]);
  const chimneyStone = useMemo(() => new THREE.MeshToonMaterial({ map: chimneyTex, color: '#ffffff' }), [chimneyTex]);
  const stone = toon('#d8ccb6');
  return (
    <group position={[x, 0, z]}>
      {/* cuerpo de piedra */}
      <RoundedBox args={[1.9, 1.7, 0.6]} radius={0.06} position={[0, 0.85, 0]} material={brick} />
      {/* repisa */}
      <RoundedBox args={[2.2, 0.14, 0.78]} radius={0.04} position={[0, 1.76, 0.06]} material={toon(PALETTE.maderaOscura)} />
      {/* chimenea hacia el techo */}
      <mesh position={[0, 3.45, -0.05]} material={chimneyStone} geometry={GEO.box} scale={[1.2, 3.4, 0.45]} />
      {/* boca del fuego */}
      <mesh position={[0, 0.62, 0.301]} material={toon('#3a241a')}>
        <circleGeometry args={[0.55, 32, 0, Math.PI]} />
      </mesh>
      <mesh position={[0, 0.34, 0.301]} material={toon('#3a241a')} geometry={GEO.plane} scale={[1.1, 0.56, 1]} />
      {/* arco de piedra */}
      <mesh position={[0, 0.62, 0.31]} material={stone}>
        <ringGeometry args={[0.55, 0.68, 32, 1, 0, Math.PI]} />
      </mesh>
      {/* leños */}
      {[-0.18, 0.18].map((lx, i) => (
        <mesh key={lx} position={[lx, 0.16, 0.25]} rotation={[0, 0, Math.PI / 2 + (i ? 0.3 : -0.3)]} material={toon(PALETTE.maderaOscura)} geometry={GEO.cylinder} scale={[0.07, 0.6, 0.07]} />
      ))}
      {/* llamas */}
      {mats.map((m, i) => (
        <mesh key={i} position={[(i - 1) * 0.18, 0.5 + (i === 1 ? 0.05 : 0), 0.28 + i * 0.002]} material={m} scale={[0.55 - Math.abs(i - 1) * 0.12, 0.75 - Math.abs(i - 1) * 0.15, 1]}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
      <pointLight ref={light} position={[0, 0.6, 0.9]} color="#ff8a3a" intensity={9} distance={7} decay={1.6} />
      {/* calcetines colgando */}
      {[-0.6, 0, 0.6].map((sx, i) => (
        <group key={sx} position={[sx, 1.5, 0.42]}>
          <mesh material={toon(i === 1 ? PALETTE.pino : PALETTE.rojo)} geometry={GEO.capsule} scale={[0.22, 0.32, 0.12]} />
          <mesh position={[0.06, -0.24, 0.0]} material={toon(i === 1 ? PALETTE.pino : PALETTE.rojo)} geometry={GEO.sphereLow} scale={[0.15, 0.1, 0.1]} />
          <mesh position={[0, 0.19, 0]} material={toon(PALETTE.blanco)} geometry={GEO.box} scale={[0.25, 0.08, 0.14]} />
        </group>
      ))}
      {/* pan de pascua y cola de mono en la repisa */}
      <group position={[-0.65, 1.86, 0.1]}>
        <mesh material={toon('#a8622e')} geometry={GEO.sphere} scale={[0.2, 0.12, 0.2]} />
        {[0, 1, 2, 3, 4].map((k) => (
          <mesh key={k} position={[Math.cos(k * 1.3) * 0.1, 0.1, Math.sin(k * 1.3) * 0.1]} material={toon(k % 2 ? PALETTE.rojo : PALETTE.muerdago)} geometry={GEO.sphereLow} scale={0.022} />
        ))}
      </group>
      <group position={[0.7, 1.83, 0.1]}>
        <mesh position={[0, 0.12, 0]} material={toon('#e9d9c0')} geometry={GEO.cylinder} scale={[0.07, 0.26, 0.07]} />
        <mesh position={[0, 0.17, 0]} material={toon('#7a4a24')} geometry={GEO.cylinder} scale={[0.072, 0.12, 0.072]} />
        <mesh position={[0, 0.27, 0]} material={toon(PALETTE.oro)} geometry={GEO.cylinder} scale={[0.03, 0.06, 0.03]} />
        <mesh position={[0.18, 0.05, 0]} material={toon('#efe4d0')} geometry={GEO.cylinder} scale={[0.05, 0.1, 0.05]} />
      </group>
    </group>
  );
}
