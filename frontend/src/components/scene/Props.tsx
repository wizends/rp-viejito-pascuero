import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { EMISSION, GEO, PALETTE, STAR_GEO, glow, toon } from './kit';
import { LADDER, MAILBOX, SORTER, TABLE, TREE } from './layout';

/** Mesa grande de madera llena de cartas (instanciadas). */
export function Table() {
  const wood = toon(PALETTE.madera);
  const dark = toon(PALETTE.maderaOscura);
  const letters = useMemo(() => {
    // pseudoaleatorio estable para que la mesa siempre se vea igual
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 46 }, (_, i) => {
      const pile = i < 26;
      const px = pile ? -1.55 + (rnd() - 0.5) * 0.5 : TABLE.x + (rnd() - 0.5) * (TABLE.w - 0.6);
      const pz = pile ? TABLE.z + 0.2 + (rnd() - 0.5) * 0.4 : TABLE.z + (rnd() - 0.5) * (TABLE.d - 0.4);
      const py = pile ? TABLE.top + 0.03 + i * 0.022 : TABLE.top + 0.012;
      return { p: [px, py, pz] as const, r: rnd() * Math.PI, kraft: rnd() > 0.55 };
    });
  }, []);

  const envGeo = useMemo(() => new THREE.BoxGeometry(0.3, 0.012, 0.2), []);
  const sealGeo = useMemo(() => new THREE.CylinderGeometry(0.03, 0.03, 0.014, 12), []);

  return (
    <group>
      <RoundedBox args={[TABLE.w, 0.12, TABLE.d]} radius={0.04} position={[TABLE.x, TABLE.top - 0.06, TABLE.z]} material={wood} />
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[TABLE.x + sx! * (TABLE.w / 2 - 0.18), (TABLE.top - 0.12) / 2, TABLE.z + sz! * (TABLE.d / 2 - 0.15)]} material={dark} geometry={GEO.cylinder} scale={[0.08, TABLE.top - 0.12, 0.08]} />
      ))}
      {letters.map((l, i) => (
        <group key={i} position={l.p as unknown as THREE.Vector3Tuple} rotation-y={l.r}>
          <mesh geometry={envGeo} material={toon(l.kraft ? '#e2c9a1' : PALETTE.crema)} />
          <mesh geometry={sealGeo} position={[0.05, 0.008, 0]} material={toon(PALETTE.rojo)} />
        </group>
      ))}
      {/* tazón de leche y galletas para el Viejito */}
      <group position={[0.1, TABLE.top, 0.55]}>
        <mesh position={[0, 0.07, 0]} material={toon(PALETTE.rojo)} geometry={GEO.cylinder} scale={[0.07, 0.14, 0.07]} />
        <mesh position={[0, 0.145, 0]} material={toon(PALETTE.blanco)} geometry={GEO.cylinder} scale={[0.06, 0.005, 0.06]} />
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[0.16 + k * 0.03, 0.012 + k * 0.016, 0.02]} material={toon(PALETTE.canela)} geometry={GEO.cylinder} scale={[0.055, 0.014, 0.055]} />
        ))}
      </group>
      <Mailbox />
      {/* taburetes para los duendes */}
      <Stool position={[1.3, 0, 0.6]} />
      <Stool position={[-1.75, 0, 0.75]} />
    </group>
  );
}

function Stool({ position }: { position: THREE.Vector3Tuple }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]} material={toon(PALETTE.rojoBaya)} geometry={GEO.cylinder} scale={[0.26, 0.06, 0.26]} />
      {[0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2;
        return (
          <mesh key={k} position={[Math.cos(a) * 0.16, 0.19, Math.sin(a) * 0.16]} material={toon(PALETTE.maderaOscura)} geometry={GEO.cylinder} scale={[0.03, 0.38, 0.03]} />
        );
      })}
    </group>
  );
}

/**
 * Buzón rojo de la lámina de utilería: cuerpo con tapa curva y la puerta
 * delantera abierta hacia abajo (bisagra abajo), por donde entran las cartas.
 */
export function Mailbox() {
  const red = toon('#c8433a');
  const redDark = toon('#a8352e');
  return (
    <group position={MAILBOX.toArray()}>
      <mesh position={[0, 0.012, 0]} material={toon(PALETTE.maderaOscura)} geometry={GEO.box} scale={[0.46, 0.024, 0.58]} />
      <RoundedBox args={[0.38, 0.34, 0.52]} radius={0.03} position={[0, 0.19, 0]} material={red} />
      {/* tapa curva: medio cilindro a lo largo */}
      <mesh position={[0, 0.36, 0]} rotation-x={Math.PI / 2} material={red} geometry={GEO.cylinder} scale={[0.19, 0.52, 0.19]} />
      {/* boca oscura al frente */}
      <mesh position={[0, 0.3, 0.262]} material={toon('#3a1c16')}>
        <circleGeometry args={[0.15, 24, 0, Math.PI]} />
      </mesh>
      <mesh position={[0, 0.2, 0.262]} material={toon('#3a1c16')} geometry={GEO.plane} scale={[0.3, 0.2, 1]} />
      {/* puerta abierta con bisagra abajo y tirador dorado */}
      <group position={[0, 0.07, 0.265]} rotation-x={1.65}>
        <RoundedBox args={[0.34, 0.36, 0.025]} radius={0.01} position={[0, 0.18, 0]} material={redDark} />
        <mesh position={[0, 0.32, 0.018]} material={toon(PALETTE.oro)} geometry={GEO.box} scale={[0.08, 0.025, 0.02]} />
      </group>
      {/* bisagras */}
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.07, 0.268]} rotation-z={Math.PI / 2} material={toon(PALETTE.negro)} geometry={GEO.cylinder} scale={[0.018, 0.05, 0.018]} />
      ))}
    </group>
  );
}

/**
 * Repisa de renos (lámina de utilería): caja de madera con cuatro cabezas de
 * reno de peluche, cuernos y nariz roja.
 */
export function ReindeerShelf({ position }: { position: THREE.Vector3Tuple }) {
  const frame = toon(PALETTE.maderaOscura);
  const back = toon('#5e3a24');
  const fur = toon('#9f633f');
  const muzzle = toon('#e3c39a');
  const antler = toon('#d6b585');
  const nose = toon('#c8433a');
  const eye = toon(PALETTE.negro);
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.05]} material={back} geometry={GEO.box} scale={[1.7, 0.72, 0.04]} />
      {[
        [0, 0.38, 1.8, 0.09],
        [0, -0.38, 1.8, 0.09],
      ].map(([x, y, w, h], i) => (
        <mesh key={`h${i}`} position={[x!, y!, 0.06]} material={frame} geometry={GEO.box} scale={[w!, h!, 0.26]} />
      ))}
      {[-0.86, 0.86].map((x) => (
        <mesh key={x} position={[x, 0, 0.06]} material={frame} geometry={GEO.box} scale={[0.09, 0.84, 0.26]} />
      ))}
      {[-0.6, -0.2, 0.2, 0.6].map((x, i) => (
        <group key={x} position={[x, -0.04, 0.06]} rotation-z={(i - 1.5) * 0.06}>
          <mesh material={fur} geometry={GEO.sphere} scale={[0.14, 0.13, 0.12]} />
          <mesh position={[0, -0.06, 0.08]} material={muzzle} geometry={GEO.sphere} scale={[0.085, 0.065, 0.07]} />
          <mesh position={[0, -0.04, 0.15]} material={nose} geometry={GEO.sphere} scale={0.032} />
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <mesh position={[sx * 0.05, 0.03, 0.105]} material={eye} geometry={GEO.sphereLow} scale={[0.018, 0.022, 0.012]} />
              <mesh position={[sx * 0.14, 0.04, 0]} rotation-z={sx * -1.1} material={fur} geometry={GEO.sphereLow} scale={[0.035, 0.07, 0.025]} />
              {/* cuernos: tronco y dos puntas */}
              <group position={[sx * 0.07, 0.11, -0.01]} rotation-z={sx * -0.35}>
                <mesh position={[0, 0.07, 0]} material={antler} geometry={GEO.cylinder} scale={[0.014, 0.14, 0.014]} />
                <mesh position={[sx * 0.03, 0.08, 0]} rotation-z={sx * -0.9} material={antler} geometry={GEO.cylinder} scale={[0.011, 0.07, 0.011]} />
                <mesh position={[sx * -0.02, 0.11, 0]} rotation-z={sx * 0.7} material={antler} geometry={GEO.cylinder} scale={[0.011, 0.06, 0.011]} />
              </group>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Piso de ramas: cono con el borde dentado, como agujas que cuelgan. */
const TREE_TIER = (() => {
  const g = new THREE.ConeGeometry(1, 1, 28, 2, true);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < -0.49) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      p.setY(i, p.getY(i) - 0.12 * (0.5 + 0.5 * Math.cos(a * 14)));
    }
  }
  g.computeVertexNormals();
  return g;
})();

/** Árbol de pascua con adornos (las ampolletas las pone Garlands). */
export function Tree() {
  const greens = ['#3f7d45', '#346b3b', '#4b8a4c'];
  const ornaments = useMemo(() => {
    const out: { p: THREE.Vector3Tuple; c: string }[] = [];
    const colors = ['#c8433a', '#e2b04a', '#5b7fc4', '#c8433a'];
    for (let i = 0; i < 22; i++) {
      const h = 0.7 + (i / 22) * 2.1;
      const r = (1 - (h - 0.4) / 2.9) * 1.15 + 0.05;
      const a = i * 2.4;
      out.push({ p: [Math.cos(a) * r, h, Math.sin(a) * r], c: colors[i % colors.length]! });
    }
    return out;
  }, []);
  return (
    <group position={TREE.pos.toArray()}>
      <mesh position={[0, 0.25, 0]} material={toon(PALETTE.maderaOscura)} geometry={GEO.cylinder} scale={[0.16, 0.5, 0.16]} />
      <mesh position={[0, 0.2, 0]} material={toon(PALETTE.rojo)} geometry={GEO.cylinder} scale={[0.4, 0.4, 0.4]} />
      {/* follaje en seis pisos de ramas que se solapan (pino tupido de la lámina) */}
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <mesh key={k} position={[0, 0.85 + k * 0.42, 0]} rotation-y={k * 0.5} material={toon(greens[k % 3]!)} geometry={TREE_TIER} scale={[1.4 - k * 0.2, 0.85 - k * 0.06, 1.4 - k * 0.2]} />
      ))}
      {ornaments.map((o, i) => (
        <mesh key={i} position={o.p} material={toon(o.c)} geometry={GEO.sphere} scale={0.085} />
      ))}
      <mesh position={[0, 3.45, 0]} material={glow(PALETTE.oro, EMISSION.star)} geometry={STAR_GEO} scale={0.24} />
      {/* regalos bajo el árbol */}
      {[
        [0.75, 0.85, '#c8433a', PALETTE.oro],
        [-0.65, 0.8, '#f6efe2', PALETTE.oro],
        [0.05, 1.2, '#5b7fc4', PALETTE.oro],
        [-0.2, 0.6, '#c8433a', '#4f9a55'],
      ].map(([x, z, c, ribbon], i) => (
        <group key={i} position={[x as number, 0.18, z as number]} rotation-y={i * 0.6}>
          <RoundedBox args={[0.38, 0.36, 0.38]} radius={0.03} material={toon(c as string)} />
          <mesh material={toon(ribbon as string)} geometry={GEO.box} scale={[0.4, 0.37, 0.07]} />
          <mesh material={toon(ribbon as string)} geometry={GEO.box} scale={[0.07, 0.37, 0.4]} />
          <mesh position={[0, 0.2, 0]} material={toon(ribbon as string)} geometry={GEO.torus} scale={0.07} rotation-x={Math.PI / 2} />
        </group>
      ))}
    </group>
  );
}

/** Estación de clasificación: tres buzones de colores. */
export function SortingBoxes() {
  const colors = [PALETTE.rojo, PALETTE.muerdago, PALETTE.oro];
  return (
    <group position={SORTER.pos.toArray()} rotation-y={SORTER.rotY}>
      {colors.map((c, i) => (
        <group key={c} position={[(i - 1) * 0.5, 0, -0.45]}>
          <RoundedBox args={[0.42, 0.7, 0.36]} radius={0.05} position={[0, 0.35, 0]} material={toon(c)} />
          <mesh position={[0, 0.58, 0.185]} material={toon('#2a0a10')} geometry={GEO.box} scale={[0.22, 0.04, 0.01]} />
          <mesh position={[0, 0.3, 0.183]} material={toon(PALETTE.crema)} geometry={GEO.box} scale={[0.22, 0.14, 0.01]} />
        </group>
      ))}
    </group>
  );
}

/** Escalera de madera apoyada en la estantería. */
export function Ladder() {
  const wood = toon(PALETTE.maderaClara);
  return (
    <group position={LADDER.pos.toArray()} rotation-x={-0.12}>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 1.6, 0]} material={wood} geometry={GEO.box} scale={[0.06, 3.2, 0.06]} />
      ))}
      {Array.from({ length: 9 }, (_, k) => (
        <mesh key={k} position={[0, 0.3 + k * 0.33, 0]} material={wood} geometry={GEO.box} scale={[0.44, 0.04, 0.05]} />
      ))}
    </group>
  );
}
