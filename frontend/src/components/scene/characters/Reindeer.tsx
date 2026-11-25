import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useScene } from '@/stores/scene';
import { EMISSION, GEO, PALETTE, clamp01, glow, toon } from '../kit';
import { READ_POS, STABLE } from '../layout';
import { Spring, damp, hop, letterTracker, type HopPose } from '../anim';
import { clampDt, rngFor } from '../debug';
import { Face } from './Face';

const fur = toon(PALETTE.renoCafe);
const furLight = toon(PALETTE.renoClaro);
const antler = toon('#d9b98c');
const blackNose = toon(PALETTE.negro);
const tmp = new THREE.Vector3();

interface ReindeerProps {
  /** posición local dentro del establo */
  offset: THREE.Vector3Tuple;
  seed: number;
  redNose?: boolean;
  reduced: boolean;
}

/** Cabeza de reno asomándose por la puerta del establo. */
function ReindeerHead({ offset, seed, redNose, reduced }: ReindeerProps) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const earL = useRef<THREE.Group>(null);
  const earR = useRef<THREE.Group>(null);
  const nose = useRef<THREE.Mesh>(null);

  const s = useMemo(
    () => ({
      hop: { y: 0, squash: 1 } as HopPose,
      squash: new Spring(1, 240, 12),
      earL: new Spring(0.9, 90, 5),
      earR: new Spring(-0.9, 90, 5),
      yaw: 0,
      pitch: 0,
      nextFlick: seed * 3 + 2,
      rng: rngFor(10 + Math.round(seed * 10)),
    }),
    [seed],
  );

  useFrame((state, rawDt) => {
    const dt = clampDt(rawDt);
    const t = state.clock.elapsedTime + seed * 5;
    const amp = reduced ? 0.15 : 1;
    const { phase, phaseStart } = useScene.getState();
    const pt = (performance.now() - phaseStart) / 1000;
    let y = Math.sin(t * 1.3) * 0.02 * amp;
    let lookY = Math.sin(t * 0.4) * 0.25 * amp;
    let lookX = 0;
    let squash = 1;

    // curiosidad: siguen el sobre mientras vuela y mientras el Viejito lee
    const curious = phase === 'flying' || phase === 'caught' || phase === 'reading';
    if (curious) {
      root.current?.getWorldPosition(tmp);
      const target = letterTracker.visible ? letterTracker.pos : READ_POS;
      lookY = Math.atan2(target.x - tmp.x, target.z - tmp.z) - STABLE.rotY;
      lookX = -0.1;
      y += 0.07; // se estiran para ver mejor
    }
    if (phase === 'celebrate') {
      // saltan de alegría desfasados, con anticipación y aplaste
      const fade = 1 - clamp01((pt - 2.8) / 0.6);
      if (fade > 0) {
        hop(((pt + seed * 0.31) * 1.6) % 1, 0.3 * amp * fade, s.hop);
        y += s.hop.y;
        squash = 1 + (s.hop.squash - 1) * fade;
      }
      lookX = -0.25;
    }
    const sq = s.squash.update(squash, dt);
    if (root.current) {
      root.current.position.y = offset[1] + y;
      root.current.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    }
    s.yaw = damp(s.yaw, THREE.MathUtils.clamp(lookY, -1.1, 1.1), curious ? 5 : 2.5, dt);
    s.pitch = damp(s.pitch, lookX, 5, dt);
    if (head.current) head.current.rotation.set(s.pitch, s.yaw, 0);

    // orejas: sacudida ocasional con resorte (y siempre al aterrizar un salto)
    if (t > s.nextFlick) {
      s.earL.kick((s.rng() > 0.5 ? 9 : -9) * amp);
      s.nextFlick = t + 2.5 + s.rng() * 4;
    }
    if (s.hop.squash < 0.9) {
      s.earL.kick(-1.2 * amp);
      s.earR.kick(1.2 * amp);
    }
    if (earL.current) earL.current.rotation.z = s.earL.update(0.9 + Math.sin(t * 1.7) * 0.08 * amp, dt);
    if (earR.current) earR.current.rotation.z = s.earR.update(-0.9 - Math.sin(t * 1.9) * 0.08 * amp, dt);
    if (nose.current && redNose) {
      nose.current.scale.setScalar(0.075 * (1 + Math.sin(t * 3) * 0.08 * amp));
    }
  });
  return (
    <group ref={root} position={offset}>
      {/* cuello */}
      <mesh position={[0, -0.35, -0.05]} material={fur} geometry={GEO.capsule} scale={[0.26, 0.5, 0.26]} />
      <group ref={head}>
        <mesh material={fur} geometry={GEO.sphere} scale={[0.25, 0.23, 0.24]} />
        {/* hocico */}
        <mesh position={[0, -0.07, 0.17]} material={furLight} geometry={GEO.sphere} scale={[0.15, 0.12, 0.15]} />
        <mesh
          ref={nose}
          position={[0, -0.02, 0.31]}
          material={redNose ? glow('#ff2a3a', EMISSION.nose) : blackNose}
          geometry={GEO.sphere}
          scale={redNose ? 0.075 : 0.05}
        />
        {redNose && <pointLight position={[0, -0.02, 0.45]} color="#ff3040" intensity={0.8} distance={1.2} />}
        <Face spread={0.1} eyeY={0.06} z={0.2} eyeSize={0.04} seed={seed} cheekY={-0.03} cheekSpread={0.17} />
        {/* orejas */}
        {[
          [-1, earL],
          [1, earR],
        ].map(([sx, ref]) => (
          <group key={sx as number} ref={ref as React.RefObject<THREE.Group>} position={[(sx as number) * 0.2, 0.1, -0.03]}>
            <mesh position={[0, 0.08, 0]} material={fur} geometry={GEO.sphere} scale={[0.05, 0.11, 0.035]} />
            <mesh position={[0, 0.08, 0.02]} material={toon(PALETTE.mejilla)} geometry={GEO.sphere} scale={[0.03, 0.07, 0.02]} />
          </group>
        ))}
        {/* astas */}
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * 0.1, 0.2, -0.04]} rotation-z={sx * -0.35}>
            <mesh position={[0, 0.14, 0]} material={antler} geometry={GEO.capsule} scale={[0.05, 0.25, 0.05]} />
            <mesh position={[sx * 0.06, 0.2, 0]} rotation-z={sx * -0.9} material={antler} geometry={GEO.capsule} scale={[0.04, 0.12, 0.04]} />
            <mesh position={[sx * -0.03, 0.26, 0]} rotation-z={sx * 0.7} material={antler} geometry={GEO.capsule} scale={[0.035, 0.1, 0.035]} />
          </group>
        ))}
      </group>
    </group>
  );
}

/** Establo con media puerta en la pared izquierda y tres renos curiosos. */
export function Stable({ reduced }: { reduced: boolean }) {
  const wood = toon(PALETTE.maderaClara);
  const dark = toon(PALETTE.maderaOscura);
  return (
    <group position={STABLE.pos.toArray()} rotation-y={STABLE.rotY}>
      {/* hueco oscuro del establo */}
      <mesh position={[0, 1.35, -0.02]} material={toon('#5a3a2a')} geometry={GEO.plane} scale={[2.3, 2.7, 1]} />
      {/* marco */}
      <mesh position={[0, 2.75, 0.05]} material={dark} geometry={GEO.box} scale={[2.6, 0.2, 0.2]} />
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 1.22, 1.35, 0.05]} material={dark} geometry={GEO.box} scale={[0.18, 2.8, 0.2]} />
      ))}
      <ReindeerHead offset={[-0.65, 1.35, 0.1]} seed={0.3} reduced={reduced} />
      <ReindeerHead offset={[0.05, 1.5, 0.15]} seed={1.1} reduced={reduced} redNose />
      <ReindeerHead offset={[0.72, 1.3, 0.1]} seed={2.2} reduced={reduced} />
      {/* media puerta tipo establo con cruz en X */}
      <group position={[0, 0.55, 0.3]}>
        <RoundedBox args={[2.3, 1.1, 0.1]} radius={0.03} material={wood} />
        <mesh rotation-z={0.43} material={dark} geometry={GEO.box} scale={[2.4, 0.1, 0.12]} />
        <mesh rotation-z={-0.43} material={dark} geometry={GEO.box} scale={[2.4, 0.1, 0.12]} />
        <mesh position={[0, 0.55, 0]} material={dark} geometry={GEO.box} scale={[2.36, 0.1, 0.16]} />
      </group>
      {/* letrero */}
      <group position={[0, 2.98, 0.12]}>
        <RoundedBox args={[1.2, 0.3, 0.06]} radius={0.05} material={toon(PALETTE.rojo)} />
      </group>
      {/* heno */}
      <mesh position={[0.9, 0.12, 0.6]} material={toon('#e0b84f')} geometry={GEO.sphere} scale={[0.35, 0.15, 0.3]} />
    </group>
  );
}
