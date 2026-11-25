import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PHASE_MS, useScene } from '@/stores/scene';
import { EMISSION, GEO, PALETTE, STAR_GEO, glow, toon } from './kit';
import { SWIRL, letterState } from './cinematic';
import { letterTracker } from './anim';
import { clampDt, rngFor } from './debug';
import { MagicRibbon, ribbonMaterial, swirlPath } from './ribbon';
import { READ_POS } from './layout';

const DUST = 48;

/**
 * El sobre de la cinemática y su magia (boceto animado):
 * - en vuelo deja una cinta dorada luminosa con polvo de estrellas;
 * - al final la carta se disuelve en un remolino dorado que envuelve el taller.
 * También avanza la máquina de estados de la escena según el tiempo de cada fase.
 */
export function FlyingLetter({ reduced }: { reduced: boolean }) {
  const camera = useThree((s) => s.camera);
  const group = useRef<THREE.Group>(null);
  const flap = useRef<THREE.Group>(null);
  const sheet = useRef<THREE.Group>(null);
  const dust = useRef<THREE.InstancedMesh>(null);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const swirlHead = useMemo(() => new THREE.Vector3(), []);
  const hist = useMemo(() => Array.from({ length: DUST }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, spin: 0 })), []);
  const head = useRef(0);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const dustMat = useMemo(() => glow(PALETTE.oroSuave, EMISSION.sparkle), []);
  // dos cintas: la estela del vuelo (corta) y el remolino final (larga y ancha)
  const trail = useMemo(() => new MagicRibbon(48, 0.07, 0.7), []);
  const swirl = useMemo(() => new MagicRibbon(96, 0.16, 1.4), []);
  const ribbonMat = useMemo(() => ribbonMaterial(), []);
  const last = useRef({ phaseStart: -1 });
  useEffect(
    () => () => {
      trail.geometry.dispose();
      swirl.geometry.dispose();
      ribbonMat.dispose();
    },
    [trail, swirl, ribbonMat],
  );

  const rng = useMemo(() => rngFor(2), []);
  const emit = (p: THREE.Vector3, spread: number) => {
    head.current = (head.current + 1) % DUST;
    const h = hist[head.current]!;
    h.p.copy(p);
    h.p.x += (rng() - 0.5) * spread;
    h.p.y += (rng() - 0.5) * spread;
    h.p.z += (rng() - 0.5) * spread;
    // el polvo flota y cae lento, como chispas de papel dorado
    h.v.set((rng() - 0.5) * 0.12, -0.05 - rng() * 0.12, (rng() - 0.5) * 0.12);
    h.life = 1;
    h.spin = rng() * 6;
  };

  useFrame((state, rawDt) => {
    const dt = clampDt(rawDt);
    const scene = useScene.getState();
    const { phase, phaseStart } = scene;
    const ms = performance.now() - phaseStart;
    // con movimiento reducido la cinemática se acorta mucho
    const speed = reduced ? 4 : 1;
    const pt = (ms / 1000) * speed;

    // avance de fases por tiempo
    if (phase === 'flying' && ms * speed > PHASE_MS.flying) scene.setPhase('caught');
    else if (phase === 'caught' && ms * speed > PHASE_MS.caught) scene.setPhase('reading');
    // la lectura no se acelera con movimiento reducido: es estado, no desplazamiento
    else if (phase === 'reading' && ms > PHASE_MS.readMin) {
      if (scene.backendStatus === 'leida') scene.setPhase('celebrate');
      else if (scene.backendStatus === 'necesita_ayuda') scene.setPhase('help');
      // Si la cola está lenta, la escena no se queda pegada: el panel avisará igual.
      else if (ms > 45_000) scene.setPhase('idle');
    } else if ((phase === 'celebrate' || phase === 'help') && ms > PHASE_MS[phase]) scene.setPhase('idle');

    if (phaseStart !== last.current.phaseStart) {
      last.current.phaseStart = phaseStart;
      if (phase === 'flying') trail.clear();
      if (phase === 'celebrate') swirl.clear();
    }

    const g = group.current;
    if (!g) return;
    const s = letterState(phase, pt, state.clock.elapsedTime, pos);
    g.visible = s.visible;
    g.position.copy(s.pos);
    g.rotation.copy(s.rot);
    g.scale.set(s.scale / Math.sqrt(s.squash), s.scale * s.squash, s.scale / Math.sqrt(s.squash));
    if (flap.current) flap.current.rotation.x = -s.open * 2.6 - Math.abs(s.flap);
    // los personajes miran esta posición
    letterTracker.visible = s.visible;
    letterTracker.pos.copy(s.pos);
    if (sheet.current) {
      sheet.current.position.y = 0.02 + s.open * 0.16;
      sheet.current.visible = s.open > 0.05;
    }

    // ---- estela de vuelo ----
    if (s.trail && s.visible && !reduced) {
      trail.push(s.pos);
      if (rng() < 0.6) emit(s.pos, 0.12);
    }
    trail.update(dt, camera.position);

    // ---- remolino final: la carta se vuelve una cinta que envuelve el taller ----
    let swirlAlpha = 0;
    if (phase === 'celebrate' && !reduced) {
      const k = (pt - SWIRL.start) / SWIRL.length;
      if (k >= 0 && k <= 1) {
        swirlPath(k, READ_POS, SWIRL.center, swirlHead);
        swirl.push(swirlHead, 0.05);
        if (rng() < 0.8) emit(swirlHead, 0.2);
        // que lo miren a él cuando el sobre ya no está
        if (!s.visible) {
          letterTracker.visible = true;
          letterTracker.pos.copy(swirlHead);
        }
      }
      swirlAlpha = 1 - Math.min(1, Math.max(0, (k - 0.85) / 0.25));
    }
    swirl.update(dt, camera.position, swirlAlpha);

    // ---- polvo de estrellas ----
    const d = dust.current;
    if (!d) return;
    for (let i = 0; i < DUST; i++) {
      const h = hist[i]!;
      h.life = Math.max(0, h.life - dt * 0.9);
      h.p.addScaledVector(h.v, dt);
      e.set(0, 0, state.clock.elapsedTime * 2 + h.spin);
      q.setFromEuler(e);
      // titila mientras se apaga
      const tw = 0.75 + 0.25 * Math.sin(state.clock.elapsedTime * 14 + h.spin * 3);
      sc.setScalar(Math.sin(Math.min(1, h.life) * Math.PI * 0.5) * 0.04 * tw);
      m.compose(h.p, q, sc);
      d.setMatrixAt(i, m);
    }
    d.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <group ref={group} visible={false}>
        {/* sobre */}
        <mesh material={toon(PALETTE.crema)} geometry={GEO.box} scale={[0.34, 0.02, 0.23]} />
        <group ref={flap} position={[0, 0.012, -0.115]}>
          <mesh position={[0, 0, 0.07]} rotation-x={-Math.PI / 2} material={toon('#efe2c6')}>
            <circleGeometry args={[0.17, 3, Math.PI / 2 + Math.PI / 3, Math.PI / 3 * 2]} />
          </mesh>
        </group>
        {/* sello de lacre rojo (boceto) */}
        <mesh position={[0, 0.02, 0]} material={toon('#b3202a')} geometry={GEO.cylinder} scale={[0.05, 0.014, 0.05]} />
        <mesh position={[0, 0.03, 0]} material={toon('#8f1520')} geometry={GEO.thinTorus} rotation-x={-Math.PI / 2} scale={0.03} />
        {/* hoja de la carta que asoma al abrir */}
        <group ref={sheet} visible={false}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} material={toon('#fffdf6')} geometry={GEO.plane} scale={[0.28, 0.34, 1]} />
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} rotation-x={-Math.PI / 2} position={[-0.02 + (k % 2) * 0.02, 0.002, -0.11 + k * 0.05]} material={toon('#5a6fa8')} geometry={GEO.plane} scale={[0.18 - (k % 3) * 0.03, 0.008, 1]} />
          ))}
        </group>
      </group>
      <mesh geometry={trail.geometry} material={ribbonMat} frustumCulled={false} renderOrder={2} />
      <mesh geometry={swirl.geometry} material={ribbonMat} frustumCulled={false} renderOrder={2} />
      <instancedMesh ref={dust} args={[STAR_GEO, dustMat, DUST]} frustumCulled={false} />
    </>
  );
}
