import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MagicRibbon, swirlPath } from './ribbon';
import { AROUND_CHAIR, DELIVERY, GIVE_POS, SWIRL, letterState, stamperPose } from './cinematic';
import { READ_POS, SANTA, STAMPER } from './layout';
import { PHASE_MS } from '@/stores/scene';

describe('cinta mágica dorada', () => {
  const cam = new THREE.Vector3(0, 2, 8);

  it('arma una tira finita que se apaga hacia la cola', () => {
    const r = new MagicRibbon(32, 0.1, 1);
    for (let i = 0; i < 20; i++) {
      r.push(new THREE.Vector3(i * 0.1, Math.sin(i) * 0.2, 0));
      r.update(1 / 60, cam);
    }
    const pos = r.geometry.getAttribute('position').array as Float32Array;
    const col = r.geometry.getAttribute('color').array as Float32Array;
    expect(Array.from(pos.slice(0, r.size * 9)).every(Number.isFinite)).toBe(true);
    // alfa del centro: la cabeza (i=0) es más opaca que la cola
    const alpha = (i: number) => col[i * 12 + 4 + 3]!;
    expect(alpha(0)).toBeGreaterThan(alpha(r.size - 1));
    // bordes transparentes (luz suave, no listón plano)
    expect(col[3]).toBe(0);
    expect(col[11]).toBe(0);
  });

  it('los puntos mueren al cumplir su vida y no queda nada que dibujar', () => {
    const r = new MagicRibbon(16, 0.1, 0.5);
    for (let i = 0; i < 10; i++) r.push(new THREE.Vector3(i * 0.1, 0, 0));
    r.update(0.6, cam);
    expect(r.size).toBe(0);
    expect(r.geometry.drawRange.count).toBe(0);
  });

  it('no crece más allá de su capacidad (sin allocations)', () => {
    const r = new MagicRibbon(8, 0.1, 10);
    for (let i = 0; i < 50; i++) r.push(new THREE.Vector3(i, 0, 0));
    expect(r.size).toBe(8);
  });

  it('el remolino nace en la carta y sube alrededor del taller', () => {
    const a = swirlPath(0, READ_POS, SWIRL.center, new THREE.Vector3());
    expect(a.distanceTo(READ_POS)).toBeLessThan(1e-6);
    const end = swirlPath(1, READ_POS, SWIRL.center, new THREE.Vector3());
    expect(end.y).toBeGreaterThan(READ_POS.y);
    // abre la espiral: a mitad de camino está lejos del centro
    const mid = swirlPath(0.5, READ_POS, SWIRL.center, new THREE.Vector3());
    expect(Math.hypot(mid.x - SWIRL.center.x, mid.z - SWIRL.center.z)).toBeGreaterThan(1);
  });
});

describe('entrega de la carta: el duende rodea el sillón', () => {
  const out = new THREE.Vector3();
  /** punto del mundo en coordenadas del sillón */
  const local = (p: THREE.Vector3) =>
    p.clone().sub(SANTA.pos).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -SANTA.rotY);

  it('el recorrido nunca atraviesa el sillón (brazos enrollados y respaldo)', () => {
    for (let i = 0; i <= 200; i++) {
      const p = local(AROUND_CHAIR.getPointAt(i / 200));
      const inside = Math.abs(p.x) < 0.92 + 0.15 && p.z > -0.59 - 0.15 && p.z < 0.6;
      expect(inside, `punto ${i}: ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`).toBe(false);
    }
  });

  it('pasa por detrás del sillón y entrega por el otro costado', () => {
    const back = local(AROUND_CHAIR.getPointAt(0.5));
    expect(back.z).toBeLessThan(-0.7);
    const start = local(AROUND_CHAIR.getPointAt(0));
    expect(start.x).toBeLessThan(-1);
    expect(local(GIVE_POS).x).toBeGreaterThan(1);
  });

  it('es continua entre fases y termina de vuelta en su taburete', () => {
    const endCaught = stamperPose('caught', PHASE_MS.caught / 1000, new THREE.Vector3())!.pos.clone();
    const startReading = stamperPose('reading', 0, out)!.pos;
    expect(endCaught.distanceTo(startReading)).toBeLessThan(0.06);
    // la lectura mínima alcanza para que vuelva
    expect(PHASE_MS.readMin / 1000).toBeGreaterThan(DELIVERY.hopUp[1]);
    expect(stamperPose('reading', PHASE_MS.readMin / 1000, out)!.pos.distanceTo(STAMPER.pos)).toBeLessThan(1e-6);
    expect(stamperPose('celebrate', 0, out)!.pos.distanceTo(STAMPER.pos)).toBeLessThan(1e-6);
  });

  it('no se teletransporta: avanza a paso de duende en toda la ida y la vuelta', () => {
    for (const [phase, end] of [['caught', PHASE_MS.caught / 1000], ['reading', PHASE_MS.readMin / 1000]] as const) {
      let prev = stamperPose(phase, 0, new THREE.Vector3())!.pos.clone();
      for (let t = 1 / 60; t <= end; t += 1 / 60) {
        const p = stamperPose(phase, t, out)!.pos;
        // a 60 fps: < 3,6 m/s en horizontal
        expect(Math.hypot(p.x - prev.x, p.z - prev.z)).toBeLessThan(0.06);
        prev = p.clone();
      }
    }
  });

  it('la carta va en sus manos y termina frente al pecho del Viejito', () => {
    const mid = (DELIVERY.walk[0] + DELIVERY.walk[1]) / 2;
    const elf = stamperPose('caught', mid, new THREE.Vector3())!.pos.clone();
    const letter = letterState('caught', mid, 0, out);
    expect(letter.pos.distanceTo(elf)).toBeLessThan(0.8);
    expect(letterState('caught', DELIVERY.give[1], 0, out).pos.distanceTo(READ_POS)).toBeLessThan(1e-3);
  });
});
