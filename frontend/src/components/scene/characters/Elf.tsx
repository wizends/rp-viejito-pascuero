import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useScene } from '@/stores/scene';
import { GEO, PALETTE, clamp01, easeInOutSine, easeOutBack, smooth, toon } from '../kit';
import { LADDER, SLEEPER, SORTER, STAMPER, cartPath } from '../layout';
import { stamperPose } from '../cinematic';
import {
  Spring,
  damp,
  dampAngle,
  hop,
  letterTracker,
  lookAngles,
  stepCycle,
  type HopPose,
  type StepPose,
} from '../anim';
import { Face } from './Face';
import { clampDt } from '../debug';

export type ElfRole = 'sorter' | 'stamper' | 'ladder' | 'sleeper' | 'runner';

/** Vestuario de cada duende según la lámina de duendes ("model sheet"). */
interface Outfit {
  /** abrigo */
  suit: string;
  /** gorro (o capucha) */
  hat: string;
  /** ribete del gorro */
  trim: string;
  pom: string;
  /** cuello del abrigo; null = sin cuello (lleva bufanda) */
  collar: string | null;
  mitten: string;
  /** medias: color sólido o rayas rojas y blancas */
  legs: string;
  boots: string;
  hood?: boolean;
  belt?: boolean;
  buttons?: boolean;
}

const FUR = '#fbf6ec';
const STRIPES = 'rayas';
const OUTFITS: Record<ElfRole, Outfit> = {
  // traje azul con capucha de piel y bufanda (duende 1)
  sorter: { suit: '#a9c8e8', hat: '#a9c8e8', trim: FUR, pom: FUR, collar: null, mitten: '#4f72b5', legs: '#7d9bd0', boots: '#4b6cad', hood: true },
  // chaqueta roja con cuello verde y botones dorados, gorro verde (duende 2)
  stamper: { suit: '#cf4a40', hat: '#4f9a55', trim: FUR, pom: FUR, collar: '#4f9a55', mitten: '#4f9a55', legs: '#4f9a55', boots: '#8a5532', buttons: true },
  // verde clásico con cuello rojo y medias a rayas (lámina de utilería)
  ladder: { suit: '#4f9a55', hat: '#4f9a55', trim: FUR, pom: '#e9c25a', collar: '#cf4a40', mitten: PALETTE.piel, legs: STRIPES, boots: '#8a5532', belt: true },
  sleeper: { suit: '#5aa35c', hat: '#3f8a4b', trim: FUR, pom: FUR, collar: '#cf4a40', mitten: PALETTE.piel, legs: STRIPES, boots: '#8a5532', belt: true },
  // traje amarillo, gorro rojo con ribete verde, con su carrito de juguetes
  runner: { suit: '#e6bd4f', hat: '#cf4a40', trim: '#4f9a55', pom: '#4f9a55', collar: '#e6bd4f', mitten: '#cf4a40', legs: '#e0b546', boots: '#8a5532' },
};

const hair = toon('#8a5232');
const skin = toon(PALETTE.piel);
/** Medias a rayas rojas y blancas (textura de 8 texeles; la cápsula mapea v a lo alto). */
const stockings = (() => {
  const data = new Uint8Array(8 * 4);
  for (let i = 0; i < 8; i++) data.set(i % 2 ? [248, 240, 226, 255] : [184, 53, 43, 255], i * 4);
  const tex = new THREE.DataTexture(data, 1, 8, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const m = toon('#ffffff').clone();
  m.map = tex;
  return m;
})();
/** Falda del abrigo en "A" (lámina): los abrigos se abren un poco bajo la cintura. */
const COAT_FLARE = new THREE.CylinderGeometry(0.165, 0.205, 0.17, 22);
/** Capucha: esfera abierta por delante (se ve por dentro, doble cara). */
const HOOD_GEO = new THREE.SphereGeometry(1, 28, 18, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9);
const hoodCache = new Map<string, THREE.MeshToonMaterial>();
const hoodMat = (c: string) => {
  let m = hoodCache.get(c);
  if (!m) {
    m = toon(c).clone();
    m.side = THREE.DoubleSide;
    hoodCache.set(c, m);
  }
  return m;
};
const STRIDE = 0.24; // metros por ciclo de paso: los pies no patinan
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/** Objetivos que cada rutina escribe en cada cuadro (se reutiliza, sin allocations). */
interface Pose {
  x: number;
  z: number;
  y: number;
  yaw: number;
  squash: number;
  lean: number;
  headX: number;
  headY: number;
  headZ: number;
  armLx: number;
  armRx: number;
  armLz: number;
  armRz: number;
  breath: number;
  /** 0..1: cuánto mira el sobre durante la cinemática */
  look: number;
  /** pasos: si es null se calcula según la distancia recorrida */
  forceStep: number | null;
}

/**
 * Duende chibi. `kind` define su rutina: clasifica cartas, sella con timbre,
 * sube la escalera, duerme o corre con su carrito.
 */
export function Elf({ kind: role, seed, reduced }: { kind: ElfRole; seed: number; reduced: boolean }) {
  const root = useRef<THREE.Group>(null);
  const lift = useRef<THREE.Group>(null);
  const squashG = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const hatTip = useRef<THREE.Group>(null);
  const zzz = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Group>(null);
  const outfit = OUTFITS[role];

  const start = useMemo(() => {
    switch (role) {
      case 'sorter':
        return { pos: SORTER.pos.clone(), rotY: SORTER.rotY };
      case 'stamper':
        return { pos: STAMPER.pos.clone(), rotY: STAMPER.rotY };
      case 'ladder':
        return { pos: LADDER.pos.clone().add(new THREE.Vector3(0, 0, 0.22)), rotY: Math.PI };
      case 'sleeper':
        return { pos: SLEEPER.pos.clone(), rotY: SLEEPER.rotY };
      case 'runner':
        return { pos: cartPath(0, new THREE.Vector3()), rotY: 0 };
    }
  }, [role]);

  // Estado mutable de la animación (resortes, fases, posiciones previas)
  const s = useMemo(
    () => ({
      pose: {} as Pose,
      hop: { y: 0, squash: 1 } as HopPose,
      step: {} as StepPose,
      look: { yaw: 0, pitch: 0 },
      walkPhase: seed * 3,
      prevX: start.pos.x,
      prevZ: start.pos.z,
      prevY: 0,
      prevYaw: start.rotY,
      squash: new Spring(1, 260, 14),
      hatX: new Spring(0, 70, 5),
      hatZ: new Spring(0.5, 70, 5),
      lastStampCycle: -1,
      wheelAngle: 0,
      headX: 0,
      headY: 0,
      headZ: 0,
    }),
    [seed, start],
  );

  useFrame((state, rawDt) => {
    const g = root.current;
    if (!g) return;
    const dt = clampDt(rawDt);
    const t = state.clock.elapsedTime + seed * 10;
    const amp = reduced ? 0.15 : 1;
    const { phase, phaseStart } = useScene.getState();
    const pt = (performance.now() - phaseStart) / 1000;
    const celebrating = phase === 'celebrate';
    const cinematic = phase === 'flying' || phase === 'caught' || phase === 'reading';

    // ---------- pose base (reposo con vida) ----------
    const p = s.pose;
    p.x = start.pos.x;
    p.z = start.pos.z;
    p.y = start.pos.y;
    p.yaw = start.rotY;
    p.squash = 1;
    p.lean = 0;
    p.breath = Math.sin(t * 2.1) * 0.025 * amp;
    p.headX = Math.sin(t * 0.9) * 0.05 * amp;
    p.headY = Math.sin(t * 0.43 + seed) * 0.12 * amp;
    p.headZ = Math.sin(t * 0.6) * 0.06 * amp;
    p.armLx = 0;
    p.armRx = 0;
    p.armLz = 0.15;
    p.armRz = -0.15;
    p.look = cinematic ? 1 : 0;
    p.forceStep = null;

    switch (role) {
      case 'stamper': {
        const cine = stamperPose(phase, phase === 'caught' && reduced ? pt * 4 : pt, tmp);
        if (cine) {
          p.x = cine.pos.x;
          p.z = cine.pos.z;
          p.y = cine.pos.y;
          p.squash = cine.squash;
          p.yaw = cine.facing;
          p.armLx = p.armRx = -2.8 * cine.armsUp;
          p.armLz = 0.3 * cine.armsUp;
          p.armRz = -0.3 * cine.armsUp;
          // caminando: pasos según la distancia; en el lugar: pies quietos
          p.forceStep = cine.walk ? null : 0;
          p.look = cine.walk ? 0.25 : cine.armsUp > 0.5 ? 0.4 : 1;
          if (cine.chin > 0) {
            // mentón en las manos, cabeza ladeada, se mece embobado
            p.armLx = p.armRx = THREE.MathUtils.lerp(p.armLx, -2.25, cine.chin);
            p.armLz = THREE.MathUtils.lerp(p.armLz, 0.55, cine.chin);
            p.armRz = THREE.MathUtils.lerp(p.armRz, -0.55, cine.chin);
            p.headZ = 0.18 * cine.chin + Math.sin(t * 1.2) * 0.06 * amp * cine.chin;
            p.lean = 0.08 * cine.chin;
            p.look = 1;
          }
          if (cine.clap > 0) clapPose(p, t, cine.clap, amp);
        } else {
          // Timbre: sube lento (anticipación), baja de golpe, rebota y aplasta.
          const period = 1.25;
          const c = (t / period) % 1;
          const cycleId = Math.floor(t / period);
          let arm: number;
          if (c < 0.55) arm = -0.5 - easeInOutSine(c / 0.55) * 1.7; // levanta
          else if (c < 0.62) arm = -2.2 + ((c - 0.55) / 0.07) * 1.9; // ¡pum!
          else arm = -0.3 - Math.sin(((c - 0.62) / 0.38) * Math.PI) * 0.15; // rebote suave
          if (c >= 0.62 && s.lastStampCycle !== cycleId) {
            s.lastStampCycle = cycleId;
            s.squash.kick(-2.2 * amp);
          }
          p.armRx = arm;
          p.headX = c < 0.55 ? -0.12 : 0.22;
          p.lean = c < 0.55 ? -0.06 : 0.08;
          p.yaw = start.rotY - 0.5; // mira hacia la mesa
        }
        break;
      }
      case 'sorter': {
        // Camina entre los tres buzones; en cada uno se inclina y mete la carta.
        const period = 4.6;
        const c = (t / period) % 3;
        const slot = Math.floor(c);
        const local = c - slot;
        const from = (slot - 1) * 0.5;
        const to = (((slot + 1) % 3) - 1) * 0.5;
        const walk = smooth(clamp01((local - 0.55) / 0.45));
        tmp2.set(THREE.MathUtils.lerp(from, to, walk), 0, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, SORTER.rotY);
        p.x += tmp2.x;
        p.z += tmp2.z;
        if (local < 0.5) {
          // anticipación (se echa atrás) y empuje con sobrepaso
          const k = local / 0.5;
          const thrust = k < 0.35 ? -smooth(k / 0.35) * 0.3 : easeOutBack((k - 0.35) / 0.4) * 1.0;
          p.armRx = -1.1 - thrust;
          p.lean = thrust * 0.1;
          p.headX = 0.15 + thrust * 0.1;
          p.yaw = Math.PI; // de cara al buzón
        } else {
          p.yaw = to > from ? Math.PI / 2 : -Math.PI / 2;
          if (local < 0.56) p.yaw = Math.PI;
        }
        break;
      }
      case 'ladder': {
        // Sube peldaño a peldaño, deja la carta arriba y baja.
        const c = (t * 0.1) % 1;
        let h: number;
        if (c < 0.4) h = easeInOutSine(c / 0.4) * 1.9;
        else if (c < 0.6) h = 1.9;
        else h = (1 - easeInOutSine((c - 0.6) / 0.4)) * 1.9;
        const climbing = c < 0.4 || c > 0.6;
        const rung = (h / 0.33) * Math.PI; // un medio ciclo por peldaño
        p.y = h + (climbing ? Math.abs(Math.sin(rung)) * 0.03 * amp : 0);
        p.armLx = -2.5 + (climbing ? Math.sin(rung) * 0.35 : 0);
        p.armRx = -2.5 - (climbing ? Math.sin(rung) * 0.35 : 0);
        if (c >= 0.42 && c < 0.58) {
          // estira el brazo hacia el estante con sobrepaso
          p.armRx = -2.5 - easeOutBack(clamp01((c - 0.42) / 0.06)) * 0.45;
          p.headX = -0.35;
        } else p.headX = -0.15;
        p.forceStep = climbing ? rung : 0;
        p.look = cinematic ? 0.5 : 0;
        break;
      }
      case 'sleeper': {
        // Duerme: respiración lenta y ronquido que levanta la cabeza.
        const snore = Math.max(0, Math.sin(t * 0.9));
        p.breath = Math.sin(t * 0.9) * 0.05 * amp;
        p.headX = 0.92 - snore * 0.08 * amp;
        p.headZ = 0.45;
        p.armLx = p.armRx = -1.4;
        p.look = 0;
        if (celebrating && pt < 3.2) {
          // ¡se despierta de un salto!, mira alrededor y vuelve a cabecear
          if (pt < 0.7) {
            hop(pt / 0.7, 0.22 * amp, s.hop);
            p.y += s.hop.y;
            p.squash = s.hop.squash;
            p.headX = 0;
            p.headZ = 0;
            p.armLx = p.armRx = -2.9;
          } else {
            const k = smooth((pt - 2.2) / 1.0); // se vuelve a dormir
            p.headX = THREE.MathUtils.lerp(-0.1, 0.92, k);
            p.headZ = THREE.MathUtils.lerp(0, 0.45, k);
            p.headY = Math.sin(pt * 5) * 0.5 * (1 - k) * amp; // mira a todos lados
            p.armLx = p.armRx = THREE.MathUtils.lerp(-0.4, -1.4, k);
          }
        }
        if (zzz.current) {
          zzz.current.visible = !(celebrating && pt < 3.2);
          zzz.current.children.forEach((child, i) => {
            const k = (t * 0.35 + i / 3) % 1;
            child.position.set(0.15 + k * 0.25 + Math.sin(k * 6 + i) * 0.04, 1.0 + k * 0.55, 0.1);
            child.rotation.z = Math.sin(k * 4 + i) * 0.3;
            child.scale.setScalar((0.12 + k * 0.1) * smooth(k / 0.15));
            ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - k * k;
          });
        }
        break;
      }
      case 'runner': {
        // Corre con su carrito: inclinado hacia adelante, pasos por distancia.
        const k = (t * (reduced ? 0.02 : 0.05)) % 1;
        cartPath(k, tmp);
        cartPath((k + 0.004) % 1, tmp2);
        p.x = tmp.x;
        p.z = tmp.z;
        p.yaw = Math.atan2(tmp2.x - tmp.x, tmp2.z - tmp.z);
        p.lean = 0.18;
        p.armLx = p.armRx = -1.25;
        p.headX = -0.12;
        break;
      }
    }

    if (celebrating && role !== 'stamper' && role !== 'sleeper' && !(role === 'ladder' && p.y > 0.2)) {
      // aplauden felices (boceto), con un leve rebote de talones en vez de saltos
      const fade = smooth(pt / 0.4) * (1 - smooth((pt - 2.6) / 0.6));
      if (fade > 0) {
        clapPose(p, t + seed, fade, amp);
        p.y += Math.abs(Math.sin(pt * 5 + seed)) * 0.02 * amp * fade;
      }
    }

    // ---------- aplicar con amortiguación independiente de FPS ----------
    g.position.x = p.x;
    g.position.z = p.z;
    const yawPrev = g.rotation.y;
    g.rotation.y = dampAngle(g.rotation.y, p.yaw, 9, dt);
    const yawVel = (g.rotation.y - yawPrev) / Math.max(dt, 1e-4);

    // pasos según distancia recorrida (sin patinar)
    const moved = Math.hypot(p.x - s.prevX, p.z - s.prevZ);
    s.prevX = p.x;
    s.prevZ = p.z;
    const speed = moved / Math.max(dt, 1e-4);
    if (p.forceStep !== null) s.walkPhase = p.forceStep;
    else s.walkPhase += (moved / STRIDE) * Math.PI * 2;
    const walking = p.forceStep !== null ? (p.forceStep === 0 ? 0 : 1) : clamp01(speed / 0.3);
    stepCycle(s.walkPhase, walking * (reduced ? 0.4 : 1), s.step);

    const yNow = p.y + s.step.bob;
    const vy = (yNow - s.prevY) / Math.max(dt, 1e-4);
    s.prevY = yNow;
    if (lift.current) lift.current.position.y = yNow;

    // aplaste: el resorte persigue la pose y conserva los golpes recibidos
    const sq = s.squash.update(p.squash, dt);
    if (squashG.current) {
      squashG.current.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      squashG.current.rotation.x = damp(squashG.current.rotation.x, p.lean, 8, dt);
      squashG.current.rotation.z = s.step.sway * 0.6;
    }
    if (body.current) body.current.scale.set(1 - p.breath * 0.4, 1 + p.breath, 1 - p.breath * 0.4);

    // mirada: mezcla del gesto de la rutina con seguir el sobre
    let hx = p.headX;
    let hy = p.headY;
    if (head.current && p.look > 0 && letterTracker.visible) {
      lookAngles(head.current, letterTracker.pos, s.look, 1.1, 0.6);
      hx = THREE.MathUtils.lerp(hx, s.look.pitch, p.look);
      hy = THREE.MathUtils.lerp(hy, s.look.yaw, p.look);
    }
    s.headX = damp(s.headX, hx, 7, dt);
    s.headY = damp(s.headY, hy, 6, dt);
    s.headZ = damp(s.headZ, p.headZ, 6, dt);
    if (head.current) head.current.rotation.set(s.headX, s.headY, s.headZ);

    if (armL.current) {
      armL.current.rotation.x = damp(armL.current.rotation.x, p.armLx + s.step.armL, 14, dt);
      armL.current.rotation.z = damp(armL.current.rotation.z, p.armLz, 10, dt);
    }
    if (armR.current) {
      armR.current.rotation.x = damp(armR.current.rotation.x, p.armRx + s.step.armR, 14, dt);
      armR.current.rotation.z = damp(armR.current.rotation.z, p.armRz, 10, dt);
    }
    if (legL.current) legL.current.rotation.x = s.step.legL;
    if (legR.current) legR.current.rotation.x = s.step.legR;

    // gorro: se queda atrás al moverse y rebota (acción secundaria)
    if (hatTip.current) {
      const idle = Math.sin(t * 1.7) * 0.06 * amp;
      hatTip.current.rotation.x = s.hatX.update(THREE.MathUtils.clamp(vy * 0.35 + speed * 0.25, -0.8, 0.8) + idle, dt);
      hatTip.current.rotation.z = s.hatZ.update(0.5 - THREE.MathUtils.clamp(yawVel * 0.12, -0.5, 0.5), dt);
    }

    // ruedas del carrito
    if (wheels.current) {
      s.wheelAngle -= (moved / 0.07) * (reduced ? 1 : 1);
      wheels.current.children.forEach((w) => (w.rotation.x = s.wheelAngle));
    }
  });

  const suit = toon(outfit.suit);
  const trim = toon(outfit.trim);
  const hat = toon(outfit.hat);
  const pom = toon(outfit.pom);
  const mitten = toon(outfit.mitten);
  const legs = outfit.legs === STRIPES ? stockings : toon(outfit.legs);
  const boots = toon(outfit.boots);
  const collar = outfit.collar;
  const isSleeper = role === 'sleeper';

  return (
    <group ref={root} position={[start.pos.x, 0, start.pos.z]} rotation-y={start.rotY}>
      {/* la altura (taburete, escalera, saltos) la pone `lift` en cada cuadro: la raíz va al piso */}
      <group ref={lift}>
        <group ref={squashG}>
          <group ref={body}>
            {/* piernas con pivote en la cadera */}
            {[
              [-1, legL],
              [1, legR],
            ].map(([sx, ref]) => (
              <group key={sx as number} ref={ref as React.RefObject<THREE.Group>} position={[(sx as number) * 0.075, 0.22, 0]}>
                <mesh position={[0, -0.1, 0]} material={legs} geometry={GEO.capsule} scale={[0.09, 0.12, 0.09]} />
                <mesh position={[0, -0.19, 0.04]} material={boots} geometry={GEO.sphere} scale={[0.065, 0.045, 0.1]} />
                <mesh position={[0, -0.16, 0.14]} rotation-x={-1.1} material={boots} geometry={GEO.cone} scale={[0.03, 0.08, 0.03]} />
              </group>
            ))}
            {/* abrigo: pecho redondito y falda en "A" */}
            <mesh position={[0, 0.38, 0]} material={suit} geometry={GEO.sphere} scale={[0.18, 0.2, 0.16]} />
            <mesh position={[0, 0.25, 0]} material={suit} geometry={COAT_FLARE} scale={[1, 1, 0.85]} />
            {outfit.belt && (
              <>
                <mesh position={[0, 0.31, 0]} material={toon(PALETTE.negro)} geometry={GEO.cylinder} scale={[0.176, 0.035, 0.15]} />
                <mesh position={[0, 0.31, 0.15]} material={toon(PALETTE.oro)} geometry={GEO.box} scale={[0.06, 0.05, 0.02]} />
              </>
            )}
            {outfit.buttons &&
              [0.43, 0.35, 0.27].map((y) => (
                <mesh key={y} position={[0, y, 0.163 - Math.abs(y - 0.36) * 0.2]} material={toon(PALETTE.oro)} geometry={GEO.sphereLow} scale={0.018} />
              ))}
            {/* cuello en puntas, o bufanda si lleva capucha */}
            {collar !== null ? (
              Array.from({ length: 8 }, (_, i) => {
                const a = (i / 8) * Math.PI * 2;
                return (
                  <mesh key={i} position={[Math.sin(a) * 0.13, 0.53, Math.cos(a) * 0.11]} rotation={[Math.cos(a) * 2.4, 0, -Math.sin(a) * 2.4]} material={toon(collar)} geometry={GEO.cone} scale={[0.045, 0.09, 0.045]} />
                );
              })
            ) : (
              <group>
                <mesh position={[0, 0.54, 0]} material={trim} geometry={GEO.torus} rotation-x={Math.PI / 2} scale={[0.14, 0.13, 0.35]} />
                <mesh position={[0.07, 0.45, 0.14]} rotation-z={0.12} material={trim} geometry={GEO.box} scale={[0.06, 0.15, 0.025]} />
              </group>
            )}
            {/* brazos con pivote en el hombro */}
            {[
              [-1, armL],
              [1, armR],
            ].map(([sx, ref]) => (
              <group key={sx as number} ref={ref as React.RefObject<THREE.Group>} position={[(sx as number) * 0.18, 0.46, 0]}>
                <mesh position={[0, -0.1, 0]} material={suit} geometry={GEO.capsule} scale={[0.09, 0.13, 0.09]} />
                {/* mitón con pulgar */}
                <mesh position={[0, -0.21, 0]} material={mitten} geometry={GEO.sphere} scale={[0.05, 0.058, 0.045]} />
                <mesh position={[(sx as number) * -0.03, -0.19, 0.03]} material={mitten} geometry={GEO.sphere} scale={0.022} />
                {role === 'stamper' && sx === 1 && <Stamp />}
                {role === 'sorter' && sx === 1 && (
                  <mesh position={[0, -0.25, 0.05]} rotation-x={Math.PI / 2} material={toon(PALETTE.crema)} geometry={GEO.box} scale={[0.16, 0.11, 0.015]} />
                )}
              </group>
            ))}
            {/* cabeza grande */}
            <group ref={head} position={[0, 0.72, 0]}>
              <mesh material={skin} geometry={GEO.sphere} scale={[0.23, 0.22, 0.21]} />
              <Face spread={0.08} eyeY={0.02} z={0.19} eyeSize={0.038} seed={seed} mouthY={-0.08} cheekY={-0.04} cheekSpread={0.13} sleeping={isSleeper} />
              <mesh position={[0, -0.01, 0.215]} material={toon(PALETTE.pielSombra)} geometry={GEO.sphere} scale={0.035} />
              {/* orejas puntudas grandes */}
              {[-1, 1].map((sx) => (
                <mesh key={sx} position={[sx * 0.24, 0.03, -0.02]} rotation={[0, sx * -0.35, sx * -1.15]} material={skin} geometry={GEO.cone} scale={[0.07, 0.21, 0.035]} />
              ))}
              {/* mechón castaño bajo el gorro */}
              {[-0.09, -0.02, 0.06].map((x, i) => (
                <mesh key={i} position={[x, 0.12 - i * 0.008, 0.16 - Math.abs(x) * 0.3]} rotation-z={0.5 - i * 0.35} material={hair} geometry={GEO.sphere} scale={[0.07, 0.045, 0.05]} />
              ))}
              {outfit.hood ? (
                <>
                  {/* capucha con borde de piel y pompón atrás (duende 1) */}
                  <mesh position={[0, 0.03, -0.03]} material={hoodMat(outfit.hat)} geometry={HOOD_GEO} scale={[0.265, 0.27, 0.255]} />
                  <mesh position={[0, 0.03, 0.15]} rotation-x={-0.25} material={trim} geometry={GEO.torus} scale={[0.2, 0.22, 0.45]} />
                  <mesh position={[0, 0.14, -0.27]} material={pom} geometry={GEO.sphere} scale={0.05} />
                </>
              ) : (
                <>
                  {/* gorro con ribete de piel y pompón */}
                  <mesh position={[0, 0.13, 0]} material={trim} geometry={GEO.torus} rotation-x={Math.PI / 2} scale={[0.21, 0.21, 0.4]} />
                  <group position={[0, 0.16, -0.01]}>
                    <mesh position={[0, 0.1, 0]} material={hat} geometry={GEO.cone} scale={[0.2, 0.22, 0.2]} />
                    <group ref={hatTip} position={[0, 0.2, 0]}>
                      <mesh position={[0, 0.1, 0]} material={hat} geometry={GEO.cone} scale={[0.08, 0.22, 0.08]} />
                      <mesh position={[0, 0.22, 0]} material={pom} geometry={GEO.sphere} scale={0.05} />
                    </group>
                  </group>
                </>
              )}
            </group>
          </group>
        </group>
      </group>
      {role === 'runner' && <Cart wheelsRef={wheels} />}
      {isSleeper && (
        <group ref={zzz}>
          {[0, 1, 2].map((i) => (
            <ZGlyph key={i} />
          ))}
        </group>
      )}
    </group>
  );
}

/** Una "z" de sueño hecha con tres barritas (sin fuentes externas). */
/** Aplauso: brazos al frente que se juntan y se separan; cabeza que sigue el ritmo. */
function clapPose(p: Pose, t: number, k: number, amp: number) {
  const beat = 0.5 + 0.5 * Math.sin(t * 13);
  p.armLx = THREE.MathUtils.lerp(p.armLx, -1.35, k);
  p.armRx = THREE.MathUtils.lerp(p.armRx, -1.35, k);
  p.armLz = THREE.MathUtils.lerp(p.armLz, 0.2 + beat * 0.45 * amp, k);
  p.armRz = THREE.MathUtils.lerp(p.armRz, -0.2 - beat * 0.45 * amp, k);
  p.headX = THREE.MathUtils.lerp(p.headX, -0.1 + beat * 0.05, k);
}

function ZGlyph() {
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#cfe8f5', transparent: true, depthWrite: false }),
    [],
  );
  return (
    <mesh material={mat}>
      <group>
        <mesh material={mat} geometry={GEO.box} position={[0, 0.4, 0]} scale={[0.8, 0.16, 0.05]} />
        <mesh material={mat} geometry={GEO.box} rotation-z={0.9} scale={[1.0, 0.16, 0.05]} />
        <mesh material={mat} geometry={GEO.box} position={[0, -0.4, 0]} scale={[0.8, 0.16, 0.05]} />
      </group>
    </mesh>
  );
}

function Stamp() {
  return (
    <group position={[0, -0.27, 0.02]}>
      <mesh material={toon(PALETTE.maderaClara)} geometry={GEO.cylinder} scale={[0.03, 0.12, 0.03]} position={[0, 0.03, 0]} />
      <mesh material={toon(PALETTE.maderaOscura)} geometry={GEO.sphere} scale={0.04} position={[0, 0.1, 0]} />
      <mesh material={toon(PALETTE.rojo)} geometry={GEO.box} scale={[0.1, 0.04, 0.08]} position={[0, -0.04, 0]} />
    </group>
  );
}

function Cart({ wheelsRef }: { wheelsRef: React.RefObject<THREE.Group> }) {
  return (
    <group position={[0, 0, 0.42]}>
      <mesh position={[0, 0.25, 0]} material={toon(PALETTE.rojo)} geometry={GEO.box} scale={[0.42, 0.2, 0.36]} />
      <mesh position={[0, 0.36, 0]} material={toon(PALETTE.oro)} geometry={GEO.box} scale={[0.44, 0.03, 0.38]} />
      <group ref={wheelsRef}>
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <group key={`${sx}${sz}`} position={[sx * 0.2, 0.08, sz * 0.13]}>
              {/* rueda con rayo para que se note el giro */}
              <mesh rotation-z={Math.PI / 2} material={toon(PALETTE.maderaOscura)} geometry={GEO.cylinder} scale={[0.07, 0.04, 0.07]} />
              <mesh material={toon(PALETTE.oro)} geometry={GEO.box} scale={[0.045, 0.12, 0.02]} />
            </group>
          )),
        )}
      </group>
      {/* cartas en el carrito */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[(i - 1.5) * 0.08, 0.4, (i % 2) * 0.05]} rotation-x={-0.3} rotation-z={(i - 1.5) * 0.15} material={toon(i % 2 ? PALETTE.crema : '#e2c9a1')} geometry={GEO.box} scale={[0.07, 0.14, 0.01]} />
      ))}
      {/* manilla */}
      <mesh position={[0, 0.42, -0.24]} material={toon(PALETTE.maderaOscura)} geometry={GEO.box} scale={[0.36, 0.03, 0.03]} />
    </group>
  );
}
