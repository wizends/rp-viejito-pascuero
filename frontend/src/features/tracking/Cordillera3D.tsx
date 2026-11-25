import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { SceneBoundary } from '@/components/ui/SceneBoundary';
import { GEO, glow, toon } from '@/components/scene/kit';
import { SCENE_DEBUG, clampDt, rngFor } from '@/components/scene/debug';
import { StageScene } from './StageScene';
import {
  CORDILLERA,
  LAYERS,
  RUNNER_POINTS,
  ridgeProfile,
  ridgeShape,
  sleighBodyShape,
  sleighPose,
  snowShapes,
} from './cordilleraModel';

/**
 * Mini-escena 3D de la etapa "Sobrevolando la Cordillera de los Andes".
 * Sin postprocesado: el contraste del recorte y las luces bastan (línea base = final).
 * Validación por URL (comparte `debug.ts` con el taller): `?t=4` congela el vuelo,
 * `?seed=7` cambia la cordillera, `?shot=cordillera-cerca|cordillera-lejos` cambia el plano.
 */
interface Props {
  label: string;
  reduced: boolean;
  /** solo la etapa en curso hace volar al trineo; las demás lo muestran en posesión fija */
  active: boolean;
}

function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const skyVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/** Tarde nevada: degradado cálido y dos nubes difusas que se desplazan muy despacio. */
const skyFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  float blob(vec2 p, vec2 c, vec2 r) { vec2 d = (p - c) / r; return 1.0 - smoothstep(0.55, 1.0, dot(d, d)); }
  void main() {
    vec3 top = vec3(0.88, 0.71, 0.53);
    vec3 bottom = vec3(0.98, 0.91, 0.80);
    vec3 col = mix(bottom, top, smoothstep(0.02, 0.98, vUv.y));
    float drift = mod(uTime * 0.01, 1.0);
    float n = blob(vec2(fract(vUv.x + drift), vUv.y), vec2(0.24, 0.74), vec2(0.11, 0.05));
    n = max(n, blob(vec2(fract(vUv.x + drift * 0.7 + 0.48), vUv.y), vec2(0.64, 0.66), vec2(0.09, 0.045)));
    col = mix(col, vec3(0.99, 0.96, 0.91), n * 0.5);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Sky({ reduced }: { reduced: boolean }) {
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
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, rawDt) => {
    if (!reduced) mat.uniforms.uTime!.value += clampDt(rawDt);
  });
  return (
    <mesh position={[0, 0, -22]} material={mat}>
      <planeGeometry args={[70, 42]} />
    </mesh>
  );
}

/** Tres recortes extrusionados: el mismo perfil genera la roca y su corona de nieve. */
function Ridges() {
  const built = useMemo(
    () =>
      LAYERS.map((layer, i) => {
        const ridge = ridgeProfile(i);
        return {
          layer,
          rock: new THREE.ExtrudeGeometry(ridgeShape(ridge), { depth: layer.depth, bevelEnabled: false }),
          snow: new THREE.ExtrudeGeometry(snowShapes(ridge), { depth: 0.03, bevelEnabled: false }),
        };
      }),
    [],
  );
  useEffect(
    () => () => {
      built.forEach((b) => {
        b.rock.dispose();
        b.snow.dispose();
      });
    },
    [built],
  );
  return (
    <group>
      {built.map(({ layer, rock, snow }, i) => (
        <group key={i} position={[0, 0, layer.z]}>
          <mesh geometry={rock} material={toon(layer.rock)} />
          <mesh geometry={snow} material={toon(layer.snow)} position={[0, 0, layer.depth + 0.012]} />
        </group>
      ))}
    </group>
  );
}

/** Trineo, renos y Viejito como piezas con nombre; las curvas se comparten por capa. */
function SleighModel() {
  const parts = useMemo(() => {
    const body = new THREE.ExtrudeGeometry(sleighBodyShape(), {
      depth: 0.9,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      bevelSegments: 2,
      curveSegments: 16,
    });
    body.translate(0, 0, -0.45);
    const runners = [-0.52, 0.52].map(
      (z) =>
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(RUNNER_POINTS.map(([x, y]) => new THREE.Vector3(x, y, z))),
          36,
          0.055,
          8,
          false,
        ),
    );
    const harness = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.3, 0.48, 0),
        new THREE.Vector3(1.7, 0.34, 0),
        new THREE.Vector3(2.1, 0.42, 0),
      ]),
      16,
      0.025,
      6,
      false,
    );
    const antlers = [-1, 1].map(
      (side) =>
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(2.88, 1.02, side * 0.1),
            new THREE.Vector3(2.82, 1.3, side * 0.16),
            new THREE.Vector3(2.62, 1.48, side * 0.26),
          ]),
          10,
          0.028,
          6,
          false,
        ),
    );
    return { body, runners, harness, antlers };
  }, []);
  useEffect(
    () => () => {
      parts.body.dispose();
      parts.runners.forEach((g) => g.dispose());
      parts.harness.dispose();
      parts.antlers.forEach((g) => g.dispose());
    },
    [parts],
  );

  return (
    <group>
      {/* casco y patines */}
      <mesh geometry={parts.body} material={toon('#b8352b')} />
      {parts.runners.map((g, i) => (
        <mesh key={i} geometry={g} material={toon('#d9a441')} />
      ))}
      {[-0.52, 0.52].flatMap((z) =>
        [-0.85, 0.05, 0.75].map((x) => (
          <mesh key={`${z}:${x}`} geometry={GEO.cylinder} material={toon('#d9a441')} position={[x, 0.22, z]} scale={[0.035, 0.44, 0.035]} />
        )),
      )}

      {/* saco de regalos */}
      <mesh geometry={GEO.sphere} material={toon('#a06f45')} position={[-0.85, 0.95, 0]} scale={[0.42, 0.46, 0.4]} />
      <mesh geometry={GEO.cylinder} material={toon('#8e5c38')} position={[-0.72, 1.35, 0]} rotation={[0, 0, -0.3]} scale={[0.12, 0.2, 0.12]} />
      <mesh geometry={GEO.thinTorus} material={toon('#efd59c')} position={[-0.7, 1.4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.14, 0.14, 0.14]} />

      {/* Viejito */}
      <mesh geometry={GEO.sphere} material={toon('#b8352b')} position={[-0.25, 1.0, 0]} scale={[0.3, 0.34, 0.27]} />
      <mesh geometry={GEO.sphere} material={toon('#f4c9a6')} position={[-0.08, 1.42, 0]} scale={[0.2, 0.2, 0.19]} />
      <mesh geometry={GEO.sphere} material={toon('#fbf6ec')} position={[-0.02, 1.31, 0.13]} scale={[0.15, 0.12, 0.11]} />
      <mesh geometry={GEO.cone} material={toon('#b8352b')} position={[-0.12, 1.68, 0]} rotation={[0, 0, -0.25]} scale={[0.22, 0.42, 0.22]} />
      <mesh geometry={GEO.sphere} material={toon('#fbf6ec')} position={[-0.23, 1.88, 0]} scale={[0.075, 0.075, 0.075]} />

      {/* reno delantero */}
      <mesh geometry={parts.harness} material={toon('#efd59c')} />
      <mesh geometry={GEO.sphere} material={toon('#9f633f')} position={[2.35, 0.6, 0]} scale={[0.55, 0.32, 0.28]} />
      <mesh geometry={GEO.sphere} material={toon('#9f633f')} position={[2.9, 0.88, 0]} scale={[0.22, 0.22, 0.2]} />
      <mesh geometry={GEO.sphere} material={toon('#e8d2b4')} position={[3.06, 0.78, 0]} scale={[0.14, 0.1, 0.12]} />
      <mesh geometry={GEO.sphere} material={glow('#ff6b57', 2.4)} position={[3.18, 0.79, 0]} scale={[0.065, 0.065, 0.065]} />
      {parts.antlers.map((g, i) => (
        <mesh key={i} geometry={g} material={toon('#784a2c')} />
      ))}
      {[2.12, 2.6].flatMap((x) =>
        [-0.18, 0.18].map((z) => (
          <mesh key={`${x}:${z}`} geometry={GEO.cylinder} material={toon('#784a2c')} position={[x, 0.18, z]} rotation={[0, 0, (x - 2.36) * 0.5]} scale={[0.045, 0.5, 0.045]} />
        )),
      )}
    </group>
  );
}

/** Vuelo en X con cabeceo derivado; `still` congela en la pose legible del contrato. */
function FlyingSleigh({ reduced, active }: { reduced: boolean; active: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  useFrame((_, rawDt) => {
    const group = ref.current;
    if (!group) return;
    const still = reduced || !active;
    if (!still) elapsed.current += clampDt(rawDt);
    const t = SCENE_DEBUG.frozenTime ?? elapsed.current;
    const pose = sleighPose(t, still && SCENE_DEBUG.frozenTime === null);
    group.position.set(pose.x, pose.y, 2.2);
    group.rotation.set(Math.sin(t * 0.7) * 0.02, pose.yaw, pose.pitch);
  });
  return (
    <group ref={ref}>
      <SleighModel />
    </group>
  );
}

const FLAKES = 80;

/** Un solo draw call para la nieve; semilla fija y sin movimiento con reduced motion. */
function Snow({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const ready = useRef(false);
  const elapsed = useRef(0);
  const data = useMemo(() => {
    const rnd = rngFor(31);
    const arr = new Float32Array(FLAKES * 5); // x, y, z, velocidad, fase
    for (let i = 0; i < FLAKES; i++) {
      arr[i * 5] = (rnd() - 0.5) * (CORDILLERA.width + 4);
      arr[i * 5 + 1] = CORDILLERA.baseY + rnd() * 12;
      arr[i * 5 + 2] = -8 + rnd() * 11;
      arr[i * 5 + 3] = 0.3 + rnd() * 0.5;
      arr[i * 5 + 4] = rnd() * Math.PI * 2;
    }
    return arr;
  }, []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fffaf0', transparent: true, opacity: 0.9, depthWrite: false }), []);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const frozen = reduced || !ready.current;
    const dt = frozen ? 0 : clampDt(rawDt);
    ready.current = true;
    if (!reduced) elapsed.current += dt;
    for (let i = 0; i < FLAKES; i++) {
      const o = i * 5;
      if (!frozen) {
        data[o + 1]! -= data[o + 3]! * dt;
        if (data[o + 1]! < CORDILLERA.baseY) data[o + 1] = CORDILLERA.baseY + 12;
      }
      const sway = frozen ? 0 : Math.sin(elapsed.current * 0.8 + data[o + 4]!) * 0.12;
      const s = 0.035 + (data[o + 3]! - 0.3) * 0.035;
      matrix.makeScale(s, s, s);
      matrix.setPosition(data[o]! + sway, data[o + 1]!, data[o + 2]!);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[GEO.sphereLow, material, FLAKES]} frustumCulled={false} />;
}

/** Dos nubecillas de acuarela que pasan delante de los cerros. */
function Clouds({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, rawDt) => {
    if (reduced || !ref.current) return;
    const dt = clampDt(rawDt);
    ref.current.children.forEach((cloud, i) => {
      cloud.position.x += dt * (0.18 + i * 0.07);
      if (cloud.position.x > 17) cloud.position.x = -17;
    });
  });
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fffaf0', transparent: true, opacity: 0.72, depthWrite: false }), []);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group ref={ref}>
      {[
        { x: -7, y: 3.6, z: -0.2, s: 1 },
        { x: 6, y: 2.7, z: -3, s: 0.75 },
      ].map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          <mesh geometry={GEO.sphere} material={material} position={[-0.5, 0, 0]} scale={[0.75, 0.24, 0.3]} />
          <mesh geometry={GEO.sphere} material={material} position={[0.1, 0.12, 0]} scale={[0.85, 0.34, 0.34]} />
          <mesh geometry={GEO.sphere} material={material} position={[0.75, -0.02, 0]} scale={[0.6, 0.22, 0.28]} />
        </group>
      ))}
    </group>
  );
}

/** Bookmarks de inspección: vista de diseño y planos cercano/lejano. */
function DebugCamera() {
  const { camera } = useThree();
  useEffect(() => {
    const shot = SCENE_DEBUG.shot;
    const near = shot === 'cordillera-cerca';
    const z = near ? 8 : shot === 'cordillera-lejos' ? 20 : 14;
    camera.position.set(0, near ? 4.4 : 3.2, z);
    camera.lookAt(new THREE.Vector3(0, near ? 4.2 : 2.8, near ? -1 : -2));
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

function Scene({ reduced, active }: { reduced: boolean; active: boolean }) {
  return (
    <>
      <color attach="background" args={['#f6e2c4']} />
      <fog attach="fog" args={['#f2d9b8', 14, 38]} />
      <hemisphereLight args={['#fff4e2', '#8e6a52', 1.05]} />
      <directionalLight position={[4, 8, 9]} intensity={1.5} color="#ffe6c0" />
      <directionalLight position={[-5, 3, -6]} intensity={0.35} color="#cfe0e6" />
      <Sky reduced={reduced} />
      <Ridges />
      <Clouds reduced={reduced} />
      <Snow reduced={reduced} />
      <FlyingSleigh reduced={reduced} active={active} />
      <DebugCamera />
    </>
  );
}

export default function Cordillera3D({ label, reduced, active }: Props) {
  const [webgl] = useState(supportsWebGL);
  const fallback = <StageScene icon="montana" label={label} />;
  if (!webgl) return fallback;

  return (
    <SceneBoundary fallback={fallback}>
      <div className="h-full w-full" style={{ width: '100%', height: '100%' }} role="img" aria-label={label}>
        <Canvas
          aria-hidden="true"
          dpr={[1, 1.75]}
          camera={{ position: [0, 3.2, 14], fov: 38, near: 0.1, far: 60 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping;
            gl.toneMappingExposure = 1;
          }}
        >
          <Scene reduced={reduced} active={active} />
        </Canvas>
      </div>
    </SceneBoundary>
  );
}
