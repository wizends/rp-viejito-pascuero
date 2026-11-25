import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DynamicTube, VerletChain, loft, ringXZ, sweep } from './organic';
import { BEARD_OVER_COAT, DIMS, HAT_REST, buildSanta, coatFrontZ, hatRadius } from './characters/santaModel';

/** Volumen con signo de una malla indexada: > 0 si las caras miran hacia afuera. */
function signedVolume(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const idx = g.getIndex()!;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let v = 0;
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(p, idx.getX(i));
    b.fromBufferAttribute(p, idx.getX(i + 1));
    c.fromBufferAttribute(p, idx.getX(i + 2));
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return v;
}

const finite = (g: THREE.BufferGeometry) => Array.from(g.getAttribute('position').array as Float32Array).every(Number.isFinite);

describe('kit orgánico: topología', () => {
  it('loft cerrado con normales hacia afuera', () => {
    const rings = [0.2, 0.5, 0.8].map((y) => ringXZ(new THREE.Vector3(0, y, 0), 0.3, 0.3, 24));
    expect(signedVolume(loft(rings))).toBeGreaterThan(0);
  });

  it('sweep con cúpulas cerrado y hacia afuera, en cualquier dirección', () => {
    for (const dir of [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0.2, 0), new THREE.Vector3(0, -1, 0.3)]) {
      const pts = [0, 1, 2, 3].map((i) => dir.clone().multiplyScalar(i * 0.2));
      expect(signedVolume(sweep(pts, () => 0.1))).toBeGreaterThan(0);
    }
  });
});

describe('Viejito Pascuero: contrato de geometría', () => {
  const g = buildSanta();

  it('las partes cerradas miran hacia afuera y no tienen NaN', () => {
    for (const key of ['coat', 'head', 'beard', 'placket', 'mitten', 'upperArm', 'bootL', 'bootR'] as const) {
      expect(finite(g[key]), key).toBe(true);
      expect(signedVolume(g[key]), key).toBeGreaterThan(0);
    }
    g.mustache.concat(g.brows, g.sideburns).forEach((m) => expect(signedVolume(m)).toBeGreaterThan(0));
  });

  it('la hebilla queda en relieve sobre el cinturón (dato compartido)', () => {
    const beltFront = coatFrontZ(DIMS.beltY) + 0.02;
    const buckleBack = 0.62 - 0.02;
    expect(buckleBack).toBeGreaterThanOrEqual(beltFront - 0.015); // contacto, sin hundirse
  });

  it('la barba nace bajo la boca y no atraviesa los ojos', () => {
    const box = new THREE.Box3().setFromBufferAttribute(g.beard.getAttribute('position') as THREE.BufferAttribute);
    expect(box.max.y).toBeLessThan(DIMS.headCenter.y + 0.05); // ojos en +0.07
    // las cejas quedan bajo el borde del gorro (centro del tubo a DIMS.brimY, radio DIMS.brimR)
    for (const b of g.brows) {
      const bb = new THREE.Box3().setFromBufferAttribute(b.getAttribute('position') as THREE.BufferAttribute);
      expect(bb.max.y).toBeLessThan(DIMS.headCenter.y + DIMS.brimY - DIMS.brimR + 0.01);
    }
  });

  it('la barba de nube descansa sobre la panza sin hundirse en ella', () => {
    const p = g.beard.getAttribute('position') as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    // en cada altura de la panza, el punto más adelantado de la barba queda delante del abrigo
    for (const y of [1.12, 1.19, 1.27]) {
      let front = -Infinity;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        if (Math.abs(v.y - y) < 0.03 && Math.abs(v.x) < 0.08) front = Math.max(front, v.z);
      }
      expect(front, `y=${y}`).toBeGreaterThan(coatFrontZ(y));
    }
  });

  it('el ribete de piel del frente no atraviesa la barba', () => {
    // radio máximo del placket (0.06) + su despegue (0.012) < lo que sobresale la barba
    expect(0.06 + 0.012).toBeLessThan(BEARD_OVER_COAT);
  });

  it('la barba es en V: ancha en las mejillas y en punta abajo (lámina del personaje)', () => {
    const p = g.beard.getAttribute('position') as THREE.BufferAttribute;
    const box = new THREE.Box3().setFromBufferAttribute(p);
    const width = box.max.x - box.min.x;
    expect(width).toBeGreaterThan(DIMS.headR * 2);
    expect(width).toBeLessThan(DIMS.headR * 2.6);
    // ancho cerca de la punta: menos de un cuarto del ancho máximo
    let low = 0;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      if (v.y < box.min.y + 0.08) low = Math.max(low, Math.abs(v.x) * 2);
    }
    expect(low).toBeLessThan(width * 0.25);
  });

  it('el gorro dinámico sigue la cadena sin NaN y la cadena conserva su largo', () => {
    const tube = new DynamicTube(HAT_REST, hatRadius);
    const chain = new VerletChain(HAT_REST);
    const anchor = new THREE.Matrix4().makeTranslation(0, 1.6, 0);
    chain.reset(anchor);
    const rest = HAT_REST[0]!.distanceTo(HAT_REST[HAT_REST.length - 1]!);
    for (let i = 0; i < 120; i++) chain.step(anchor, 1 / 60);
    tube.update(chain.points);
    expect(finite(tube.geometry)).toBe(true);
    const span = chain.points[0]!.distanceTo(chain.points[chain.points.length - 1]!);
    expect(span).toBeGreaterThan(rest * 0.6);
    expect(span).toBeLessThan(rest * 1.4);
  });
});
