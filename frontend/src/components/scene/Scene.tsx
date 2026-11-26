import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { Suspense, useEffect, useState } from 'react';
import { useIsPresent } from 'framer-motion';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { useScene } from '@/stores/scene';
import { CameraRig } from './CameraRig';
import { Fireplace } from './Fireplace';
import { FlyingLetter } from './FlyingLetter';
import { Garlands } from './Garlands';
import { Outside } from './Outside';
import { Ladder, SortingBoxes, Table, Tree } from './Props';
import { Room } from './Room';
import { Elf } from './characters/Elf';
import { Stable } from './characters/Reindeer';
import { Santa } from './characters/Santa';
import { CAMERA } from './layout';
import { SCENE_DEBUG } from './debug';

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const on = () => setM(window.innerWidth < 768);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return m;
}

/** ?t=… congela el reloj para capturas reproducibles (validación visual). */
function FrozenClock({ at }: { at: number }) {
  useFrame((state) => {
    state.clock.elapsedTime = at;
    state.clock.stop();
  }, -1000);
  return null;
}

function ReadySignal() {
  const setReady = useScene((s) => s.setSceneReady);
  useEffect(() => {
    setReady(true);
    return () => setReady(false);
  }, [setReady]);
  return null;
}

/**
 * Postprocesado: Bloom en HDR → ToneMapping → SMAA.
 * Bloom en HDR (antes del tone mapping): solo superan el umbral las emisiones de
 * la jerarquía EMISSION; la escena iluminada queda en 0..1.
 */
function Post({ smaa }: { smaa: boolean }) {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={0.9} luminanceThreshold={1.2} luminanceSmoothing={0.25} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      {smaa ? <SMAA /> : <></>}
    </EffectComposer>
  );
}

/**
 * Escena principal: el taller y oficina de correo del Polo Norte.
 * Se carga de forma diferida desde la landing (React.lazy).
 */
export default function Scene() {
  const reduced = useReducedMotion();
  const mobile = useIsMobile();
  // 0 = calidad completa, 1 = sin SMAA, 2 = sin Bloom ni luces extra
  const forced = SCENE_DEBUG.forcedQuality;
  const [tier, setTier] = useState(forced ?? (mobile ? 1 : 0));
  const post = tier < 2 && !SCENE_DEBUG.noPost;
  // mientras la portada se despide (cambio de ruta), la escena deja de dibujar: queda el último cuadro
  const isPresent = useIsPresent();

  return (
    <Canvas
      frameloop={isPresent ? 'always' : 'never'}
      dpr={[1, 2]}
      camera={{ position: (mobile ? CAMERA.mobilePos : CAMERA.pos).toArray(), fov: mobile ? 52 : 44, near: 0.1, far: 40 }}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
      // Un solo dueño del tone mapping por camino: el renderer cuando no hay post;
      // con post, la escena se dibuja en HDR (sin tone mapping) y lo aplica el efecto final.
      // Neutral (Khronos) conserva el tono de la paleta plana mejor que ACES.
      onCreated={({ gl }) => {
        gl.setClearColor('#efe1c8');
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 0.95;
      }}
      aria-hidden="true"
    >
      <PerformanceMonitor
        onDecline={() => forced === null && setTier((t) => Math.min(2, t + 1))}
        onIncline={() => forced === null && setTier((t) => Math.max(mobile ? 1 : 0, t - 1))}
        flipflops={3}
        onFallback={() => forced === null && setTier(2)}
      >
        <AdaptiveDpr pixelated={false} />
        <Suspense fallback={null}>
          {/* Interior cálido del boceto: luz de chimenea ámbar y una ventana fría y suave */}
          <color attach="background" args={['#efe1c8']} />
          <fog attach="fog" args={['#e9d6b8', 16, 30]} />
          <hemisphereLight args={['#fff4e2', '#a27250', 1.0]} />
          <ambientLight intensity={0.25} color="#ffecd2" />
          <directionalLight position={[3, 6, 5]} intensity={1.6} color="#ffe6c0" />
          <directionalLight position={[-2, 3, -4]} intensity={0.3} color="#cfdde0" />

          <Room />
          <Outside reduced={reduced} />
          <Fireplace reduced={reduced} />
          <Table />
          <Tree />
          <SortingBoxes />
          <Ladder />
          <Stable reduced={reduced} />
          <Garlands reduced={reduced} lowPower={tier >= 2} />

          <Santa reduced={reduced} />
          <Elf kind="stamper" seed={0.2} reduced={reduced} />
          <Elf kind="sorter" seed={1.3} reduced={reduced} />
          <Elf kind="ladder" seed={2.6} reduced={reduced} />
          <Elf kind="sleeper" seed={3.1} reduced={reduced} />
          <Elf kind="runner" seed={4.7} reduced={reduced} />

          <FlyingLetter reduced={reduced} />
          <CameraRig reduced={reduced} mobile={mobile} />
          <ReadySignal />
          {SCENE_DEBUG.frozenTime !== null && <FrozenClock at={SCENE_DEBUG.frozenTime} />}
        </Suspense>
        {post && <Post smaa={tier === 0} />}
      </PerformanceMonitor>
    </Canvas>
  );
}
