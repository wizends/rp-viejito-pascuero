import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useScene } from '@/stores/scene';
import { GEO, PALETTE, STAR_GEO, clamp01, easeInOutSine, smooth, toon } from '../kit';
import { SANTA, STAMPER } from '../layout';
import { DELIVERY } from '../cinematic';
import { Spring, damp, letterTracker, lookAngles } from '../anim';
import { clampDt } from '../debug';
import { DynamicTube, FieldDeformer, VerletChain } from '../organic';
import { ARM, DIMS, HAT_REST, buildSanta, hatRadius } from './santaModel';
import { Face } from './Face';

// rojo de acuarela (lámina: 'watercolor wash'), algo más claro que el rojo de utilería
const red = toon('#cc463c');
const fur = toon(PALETTE.blanco);
// barba en crema muy suave: separa planos con el bigote y las cejas (blanco puro)
const beardTone = toon('#f8f1e6');
const skin = toon(PALETTE.piel);
const black = toon(PALETTE.negro);
// guantes y botas gris carbón (lámina del personaje)
const charcoal = toon('#4b4a4f');
const gold = toon(PALETTE.oro);
const mouthTone = toon('#8c2f35');
const noseTone = toon('#f59a8c');
// sillón club verde menta (lámina: 'watercolor wash - viridian')
const velvet = toon('#6fae93');
const velvetLight = toon('#8cc3aa');
const velvetDeep = toon('#55937a');
const wood = toon(PALETTE.maderaOscura);
const glass = new THREE.MeshToonMaterial({ color: '#f3ead8', transparent: true, opacity: 0.25 });

const HC = DIMS.headCenter;
const SH = DIMS.shoulder;
/** a dónde mira cuando le sonríe al duende que le trajo la carta (ya de vuelta en su taburete) */
const ELF_FACE = STAMPER.pos.clone().add(new THREE.Vector3(0, 0.72, 0));
/** cuando el duende, tras rodear el sillón, le pasa la carta (s de la fase `caught`) */
const GIVE_AT = DELIVERY.give[0];
/** el duende ya volvió a su taburete (s de la fase `reading`) */
const ELF_BACK = DELIVERY.hopUp[1];

/** Pose de un brazo: hombro (adelante), codo, giro hacia adentro y apertura lateral. */
interface ArmPose {
  up: number;
  elbow: number;
  yawIn: number;
  roll: number;
}
const ARM_POSES = {
  // manos sobre los muslos (lámina del personaje)
  rest: { up: -0.5, elbow: -0.63, yawIn: 0.27, roll: 0 },
  // estira las manos para recibir la carta
  reach: { up: -1.0, elbow: -0.5, yawIn: 0.25, roll: 0 },
  // sostiene la carta frente al pecho con las dos manos (boceto)
  hold: { up: -1.15, elbow: -0.65, yawIn: 0.42, roll: 0 },
  // la levanta un poco al reír
  raise: { up: -1.35, elbow: -0.6, yawIn: 0.42, roll: 0 },
  // manos sobre la panza
  belly: { up: -0.55, elbow: -1.0, yawIn: 0.32, roll: 0.08 },
  // se rasca la cabeza (ayuda)
  scratch: { up: -2.5, elbow: -1.5, yawIn: 0.3, roll: 0 },
} satisfies Record<string, ArmPose>;

const mixPose = (a: ArmPose, b: ArmPose, k: number, out: ArmPose) => {
  out.up = a.up + (b.up - a.up) * k;
  out.elbow = a.elbow + (b.elbow - a.elbow) * k;
  out.yawIn = a.yawIn + (b.yawIn - a.yawIn) * k;
  out.roll = a.roll + (b.roll - a.roll) * k;
  return out;
};

/**
 * El Viejito Pascuero del boceto: superficies continuas (santaModel.ts) y un
 * lenguaje de movimiento de cuento ilustrado: gestos lentos y suaves, mirada
 * cómplice al duende, risa con los ojos cerrados y la panza que tiembla.
 * Física: respiración y panza deformando el abrigo, barba con resorte, gorro como
 * cadena verlet con el pompón colgando junto a la oreja.
 */
export function Santa({ reduced }: { reduced: boolean }) {
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const beard = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const shoulderL = useRef<THREE.Group>(null);
  const shoulderR = useRef<THREE.Group>(null);
  const elbowL = useRef<THREE.Group>(null);
  const elbowR = useRef<THREE.Group>(null);
  const glasses = useRef<THREE.Group>(null);
  const pompom = useRef<THREE.Mesh>(null);
  const eyesClosed = useRef(0);

  const geo = useMemo(() => buildSanta(), []);
  // campos del abrigo: [0] panza (gaussiana en altura × cara delantera), [1] pecho
  const coatFields = useMemo(
    () =>
      new FieldDeformer(geo.coat, [
        (p) => Math.exp(-(((p.y - 0.9) / 0.2) ** 2)) * clamp01((p.z - 0.05) / 0.45),
        (p) => Math.exp(-(((p.y - 1.12) / 0.16) ** 2)) * 0.6,
      ]),
    [geo],
  );
  const hat = useMemo(() => {
    const tube = new DynamicTube(HAT_REST, hatRadius, 26, 3);
    const chain = new VerletChain(HAT_REST, reduced ? 40 : 16, 0.9, -5);
    return { tube, chain, ready: false };
  }, [reduced]);

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => (Array.isArray(g) ? g.forEach((x) => x.dispose()) : g.dispose()));
      hat.tube.geometry.dispose();
    },
    [geo, hat],
  );

  const s = useMemo(
    () => ({
      belly: new Spring(0, 160, 6),
      headKick: new Spring(0, 140, 9),
      beardX: new Spring(0, 90, 6),
      beardZ: new Spring(0, 90, 6),
      look: { yaw: 0, pitch: 0 },
      glance: { yaw: 0, pitch: 0 },
      laughs: 0,
      lastPhaseStart: -1,
      hx: 0,
      hy: 0,
      hz: 0,
      prevHx: 0,
      prevHy: 0,
      mouth: 0.3,
      pose: { ...ARM_POSES.rest },
      arm: [{ ...ARM_POSES.rest }, { ...ARM_POSES.rest }],
      pomPrev: new THREE.Vector3(),
    }),
    [],
  );

  useFrame((state, rawDt) => {
    const dt = clampDt(rawDt);
    const t = state.clock.elapsedTime;
    const amp = reduced ? 0.15 : 1;
    const { phase, phaseStart } = useScene.getState();
    const pt = (performance.now() - phaseStart) / 1000;
    if (phaseStart !== s.lastPhaseStart) {
      s.lastPhaseStart = phaseStart;
      s.laughs = 0;
    }

    // reposo: respiración lenta y mirada que pasea por el taller
    const breath = Math.sin(t * 1.4);
    let headX = Math.sin(t * 0.5) * 0.04 * amp;
    let headY = Math.sin(t * 0.27) * 0.18 * amp;
    let headZ = Math.sin(t * 0.21) * 0.05 * amp;
    let poseL: ArmPose = ARM_POSES.rest;
    let poseR: ArmPose = ARM_POSES.rest;
    let look = 0;
    let closed = 0;
    let mouthOpen = 0.3;
    let shake = 0;

    if (phase === 'flying') look = 1;
    if (phase === 'caught') {
      // con movimiento reducido la entrega va 4× más rápido (igual que el duende y el sobre)
      const cpt = reduced ? pt * 4 : pt;
      // sigue la carta mientras el duende la atrapa y cuando asoma por su costado;
      // mientras pasa por detrás del sillón solo la sigue a medias
      look = cpt < 1.2 || cpt > GIVE_AT - 1.2 ? 1 : 0.35;
      // estira los brazos al ver llegar al duende y toma la carta
      const k = smooth((cpt - (GIVE_AT - 0.5)) / 0.8);
      poseL = poseR = mixPose(ARM_POSES.rest, cpt < GIVE_AT + 0.45 ? ARM_POSES.reach : ARM_POSES.hold, k, s.pose);
    }
    if (phase === 'reading' || phase === 'help') {
      poseL = poseR = ARM_POSES.hold;
      // lee renglón por renglón por encima de los lentes: barrido lento y vuelta suave
      const line = pt / 1.6;
      const n = Math.floor(line);
      const x = line - n;
      const sweepK = x < 0.8 ? easeInOutSine(x / 0.8) : 1 - easeInOutSine((x - 0.8) / 0.2);
      headY = (sweepK - 0.5) * 0.26 * amp;
      headX = 0.24 + Math.min(n, 4) * 0.02;
      headZ = (sweepK - 0.5) * 0.05 * amp;
      // mirada cómplice al duende (como en el boceto), cada ~6 s, cuando ya está en su taburete
      const from = phase === 'reading' ? ELF_BACK : 1.3;
      const g = (pt - from) % 6;
      const glance = pt > from ? smooth(g / 0.5) * (1 - smooth((g - 1.6) / 0.6)) : 0;
      if (glance > 0 && head.current) {
        lookAngles(head.current, ELF_FACE, s.glance, 0.9, 0.5);
        headY = THREE.MathUtils.lerp(headY, s.glance.yaw, glance);
        headX = THREE.MathUtils.lerp(headX, s.glance.pitch + 0.05, glance);
        headZ = THREE.MathUtils.lerp(headZ, 0.1, glance);
        mouthOpen = 0.3 + glance * 0.25;
      }
      if (phase === 'help') {
        poseR = mixPose(ARM_POSES.hold, ARM_POSES.scratch, smooth(pt / 0.8), s.pose);
        headZ = 0.16;
        headX = 0.12;
      }
    }
    if (phase === 'celebrate') {
      // ¡jo, jo, jo! con los ojos cerrados y la cabeza hacia atrás: dos tandas de risa
      const beats = [0.15, 0.45, 0.75, 1.3, 1.6, 1.9];
      while (s.laughs < beats.length && pt >= beats[s.laughs]!) {
        s.belly.kick(3.0 * amp);
        s.headKick.kick(-1.6 * amp);
        s.beardX.kick(-2.2 * amp);
        s.laughs++;
      }
      const laugh = smooth(pt / 0.3) * (1 - smooth((pt - 2.1) / 0.5));
      closed = laugh;
      shake = laugh;
      mouthOpen = 0.35 + laugh * (0.5 + 0.25 * Math.abs(Math.sin(pt * 10)));
      headX = -0.2 * laugh + 0.05;
      headY = 0;
      // la carta se vuelve magia (2.2 s): manos a la panza y sigue la cinta con la mirada
      const after = smooth((pt - 2.3) / 0.7);
      poseL = poseR = mixPose(ARM_POSES.raise, ARM_POSES.belly, after, s.pose);
      look = after;
    }

    if (look > 0 && letterTracker.visible && head.current) {
      lookAngles(head.current, letterTracker.pos, s.look, 0.9, 0.45);
      headY = THREE.MathUtils.lerp(headY, s.look.yaw, look);
      headX = THREE.MathUtils.lerp(headX, s.look.pitch, look);
    }

    // ---- cuerpo blando: respiración en el pecho, temblor de panza, hombros que se sacuden ----
    const jiggle = s.belly.update(0, dt);
    coatFields.apply([breath * 0.006 * amp + jiggle * 0.035, breath * 0.012 * amp], [jiggle * 0.01, 0]);
    if (body.current) {
      body.current.position.y = jiggle * 0.01;
      body.current.rotation.z = Math.sin(pt * 17) * 0.012 * shake * amp;
    }

    // ---- cabeza (gestos lentos de cuento: amortiguación más suave que antes) ----
    const kick = s.headKick.update(0, dt);
    s.hx = damp(s.hx, headX, 4, dt);
    s.hy = damp(s.hy, headY, 3.2, dt);
    s.hz = damp(s.hz, headZ, 3.2, dt);
    const vHx = (s.hx - s.prevHx) / Math.max(dt, 1e-4);
    const vHy = (s.hy - s.prevHy) / Math.max(dt, 1e-4);
    s.prevHx = s.hx;
    s.prevHy = s.hy;
    if (head.current) {
      head.current.rotation.set(s.hx + kick * 0.12, s.hy, s.hz);
      head.current.position.y = HC.y + jiggle * 0.03 + breath * 0.004 * amp;
    }
    eyesClosed.current = damp(eyesClosed.current, closed, 10, dt);
    s.mouth = damp(s.mouth, mouthOpen, 12, dt);
    if (mouth.current) {
      // la sonrisa siempre se ve; la boca abierta solo aparece al reír o conversar
      mouth.current.scale.y = 0.035 * Math.max(0.05, s.mouth - 0.3) * 1.6;
      mouth.current.visible = s.mouth > 0.34;
    }

    // ---- barba: péndulo con resorte que reacciona al giro de la cabeza ----
    if (beard.current) {
      beard.current.rotation.x = s.beardX.update(THREE.MathUtils.clamp(-vHx * 0.08, -0.3, 0.3), dt);
      beard.current.rotation.z = s.beardZ.update(THREE.MathUtils.clamp(-vHy * 0.06, -0.25, 0.25), dt);
    }

    // ---- brazos: hombro (orden YXZ: dobla adelante y luego gira hacia adentro) + codo ----
    const sides = [
      [-1, shoulderL, elbowL, poseL, s.arm[0]!],
      [1, shoulderR, elbowR, poseR, s.arm[1]!],
    ] as const;
    for (const [sx, sh, el, target, cur] of sides) {
      cur.up = damp(cur.up, target.up, 4.5, dt);
      cur.elbow = damp(cur.elbow, target.elbow, 4.5, dt);
      cur.yawIn = damp(cur.yawIn, target.yawIn, 4.5, dt);
      cur.roll = damp(cur.roll, target.roll, 4.5, dt);
      const tremble = Math.sin(pt * 17 + sx) * 0.03 * shake * amp;
      if (sh.current) sh.current.rotation.set(cur.up + tremble, -sx * cur.yawIn, sx * cur.roll);
      if (el.current) el.current.rotation.x = cur.elbow;
    }
    if (glasses.current) {
      // se pone los lentes solo para leer (la lámina lo muestra sin lentes)
      const reading = phase === 'reading' || phase === 'help' || (phase === 'caught' && pt * (reduced ? 4 : 1) > GIVE_AT + 0.3);
      const g = glasses.current;
      const k = damp(g.scale.x, reading ? 1 : 0, 6, dt);
      g.scale.setScalar(k);
      g.visible = k > 0.02;
      g.position.y = -0.02 * k;
    }

    // ---- gorro: cadena verlet anclada a la cabeza (espacio del mundo) ----
    if (head.current) {
      head.current.updateWorldMatrix(true, false);
      if (!hat.ready) {
        hat.chain.reset(head.current.matrixWorld);
        hat.ready = true;
      }
      hat.chain.step(head.current.matrixWorld, dt);
      hat.tube.update(hat.chain.points);
      const tip = hat.chain.points[hat.chain.points.length - 1]!;
      if (pompom.current) {
        pompom.current.position.copy(tip);
        // el pompón se estira un poco con la velocidad (squash & stretch suave)
        const v = s.pomPrev.distanceTo(tip) / Math.max(dt, 1e-4);
        const st = 1 + Math.min(0.2, v * 0.1);
        pompom.current.scale.set(0.11 / Math.sqrt(st), 0.11 * st, 0.11 / Math.sqrt(st));
        s.pomPrev.copy(tip);
      }
    }
  });

  return (
    <>
      <group position={SANTA.pos.toArray()} rotation-y={SANTA.rotY}>
        <Armchair />
        <group ref={body}>
          {/* abrigo continuo + ribetes derivados del mismo perfil */}
          <mesh geometry={geo.coat} material={red} />
          <mesh geometry={geo.hem} material={fur} />
          <mesh geometry={geo.belt} material={black} />
          <mesh geometry={geo.placket} material={fur} />
          {/* hebilla dorada grande y cuadrada (boceto) */}
          <RoundedBox args={[0.23, 0.17, 0.04]} radius={0.02} position={[0, DIMS.beltY, 0.62]} material={gold} />
          <RoundedBox args={[0.15, 0.1, 0.03]} radius={0.012} position={[0, DIMS.beltY, 0.637]} material={black} />
          <mesh geometry={STAR_GEO} material={gold} position={[0, DIMS.beltY, 0.655]} scale={0.04} />

          {/* piernas y botas de cuero */}
          <mesh geometry={geo.legL} material={red} />
          <mesh geometry={geo.legR} material={red} />
          <mesh geometry={geo.bootL} material={charcoal} />
          <mesh geometry={geo.bootR} material={charcoal} />
          {[-1, 1].map((sx) => (
            <mesh key={sx} geometry={geo.bootCuff} material={fur} position={[sx * DIMS.hipX * 1.05, 0.26, 0.63]} />
          ))}

          {/* brazos: hombro → codo → antebrazo con puño de piel y mano desnuda */}
          {(
            [
              [-1, shoulderL, elbowL, geo.thumbL],
              [1, shoulderR, elbowR, geo.thumbR],
            ] as const
          ).map(([sx, sh, el, thumbGeo]) => (
            <group key={sx} ref={sh} position={[sx * SH.x, SH.y, SH.z]} rotation-order="YXZ">
              <mesh geometry={geo.upperArm} material={red} />
              {/* codo redondeado: oculta el pliegue entre tramos */}
              <mesh geometry={GEO.sphere} material={red} position={[0, -ARM.upper, 0]} scale={0.128} />
              <group ref={el} position={[0, -ARM.upper, 0]}>
                <mesh geometry={geo.forearm} material={red} />
                <mesh geometry={geo.cuff} material={fur} position={[0, -ARM.fore, 0.01]} />
                <group position={[0, -ARM.fore - 0.03, 0.02]}>
                  <mesh geometry={geo.mitten} material={charcoal} />
                  <mesh geometry={thumbGeo} material={charcoal} />
                </group>
              </group>
            </group>
          ))}

          {/* cabeza (pivote en su centro) */}
          <group ref={head} position={HC.toArray()}>
            <group position={[-HC.x, -HC.y, -HC.z]}>
              <mesh geometry={geo.head} material={skin} />
              {geo.brows.map((g, i) => (
                <mesh key={i} geometry={g} material={fur} />
              ))}
              {geo.sideburns.map((g, i) => (
                <mesh key={i} geometry={g} material={beardTone} />
              ))}
            </group>
            {/* barba con pivote bajo la boca */}
            <group ref={beard} position={[0, -0.04, 0.05]}>
              <group position={[-HC.x, -HC.y + 0.04, -HC.z - 0.05]}>
                <mesh geometry={geo.beard} material={beardTone} />
                {geo.mustache.map((g, i) => (
                  <mesh key={i} geometry={g} material={fur} />
                ))}
                {/* boca: sonrisa bajo el bigote que se abre al reír */}
                <group position={[0, 1.478, 0.44]}>
                  <mesh geometry={GEO.smile} material={mouthTone} rotation-z={Math.PI} scale={[0.07, 0.05, 0.05]} />
                  <mesh ref={mouth} geometry={GEO.sphere} material={mouthTone} position={[0, -0.03, -0.005]} scale={[0.06, 0.03, 0.02]} />
                </group>
              </group>
            </group>
            <Face spread={0.11} eyeY={0.07} z={0.3} eyeSize={0.04} seed={1.7} cheekY={-0.025} cheekSpread={0.2} closed={eyesClosed} />
            {/* nariz redonda y sonrosada */}
            <mesh position={[0, -0.025, 0.34]} material={noseTone} geometry={GEO.sphere} scale={[0.082, 0.074, 0.075]} />
            {/* lentes redondos dorados en la punta de la nariz */}
            <group ref={glasses} position={[0, 0, 0.385]} scale={0} visible={false}>
              {[-1, 1].map((sx) => (
                <group key={sx} position={[sx * 0.092, 0.035, 0]}>
                  <mesh material={gold} geometry={GEO.thinTorus} scale={0.066} />
                  <mesh material={glass} geometry={GEO.sphereLow} scale={[0.062, 0.062, 0.006]} />
                </group>
              ))}
              <mesh material={gold} geometry={GEO.box} scale={[0.05, 0.012, 0.012]} position={[0, 0.045, 0.004]} />
            </group>
            {/* borde de piel del gorro, mullido y apenas inclinado hacia atrás */}
            <mesh geometry={geo.brim} material={fur} position={[0, DIMS.brimY, -0.025]} rotation-x={-0.14} />
          </group>
        </group>
      </group>
      {/* gorro dinámico (espacio del mundo) */}
      <mesh geometry={hat.tube.geometry} material={red} frustumCulled={false} />
      <mesh ref={pompom} geometry={GEO.sphere} material={fur} frustumCulled={false} />
    </>
  );
}

/** Sillón club de la lámina: respaldo bajo y redondeado, brazos enrollados gruesos y patas cortas. */
function Armchair() {
  return (
    <group>
      {/* base y cojín */}
      <RoundedBox args={[1.46, 0.44, 1.1]} radius={0.14} position={[0, 0.32, 0.05]} material={velvet} />
      <RoundedBox args={[1.04, 0.15, 0.9]} radius={0.07} position={[0, 0.58, 0.1]} material={velvetLight} />
      {/* respaldo redondeado: llega a la altura de los hombros */}
      <RoundedBox args={[1.46, 1.05, 0.34]} radius={0.17} position={[0, 0.95, -0.42]} material={velvet} />
      <mesh position={[0, 1.42, -0.42]} rotation-z={Math.PI / 2} material={velvet} geometry={GEO.cylinder} scale={[0.19, 1.3, 0.19]} />
      {/* brazos enrollados: bloque + rollo que sobresale hacia afuera */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * 0.7, 0, 0.05]}>
          <RoundedBox args={[0.26, 0.46, 1.04]} radius={0.11} position={[0, 0.66, 0]} material={velvet} />
          <mesh position={[sx * 0.05, 0.9, 0]} rotation-x={Math.PI / 2} material={velvet} geometry={GEO.cylinder} scale={[0.17, 1.04, 0.17]} />
          <mesh position={[sx * 0.05, 0.9, 0.525]} rotation-x={Math.PI / 2} material={velvetDeep} geometry={GEO.cylinder} scale={[0.135, 0.02, 0.135]} />
        </group>
      ))}
      {/* patas cortas de madera */}
      {[-0.6, 0.6].map((x) =>
        [-0.42, 0.5].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.05, z]} material={wood} geometry={GEO.cylinder} scale={[0.06, 0.1, 0.06]} />
        )),
      )}
    </group>
  );
}
