import { describe, expect, it } from 'vitest';
import { Spring, hop } from './anim';
import { clampDt, makeRng } from './debug';

describe('azar con semilla (validación visual reproducible)', () => {
  it('misma semilla → misma secuencia; otra semilla → distinta', () => {
    const a = makeRng(7);
    const b = makeRng(7);
    const c = makeRng(8);
    const sa = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(sa);
    expect(Array.from({ length: 5 }, c)).not.toEqual(sa);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe('resorte', () => {
  it('converge al objetivo igual a 30 y a 120 fps', () => {
    const run = (fps: number) => {
      const s = new Spring(0, 120, 2 * Math.sqrt(120));
      for (let i = 0; i < fps * 2; i++) s.update(1, 1 / fps);
      return s.value;
    };
    expect(run(30)).toBeCloseTo(1, 3);
    expect(run(120)).toBeCloseTo(1, 3);
  });

  it('a 4 FPS el riel de cámara llega igual en ~2 s (sigue la línea de tiempo)', () => {
    const s = new Spring(0, 7, 2 * Math.sqrt(7));
    for (let i = 0; i < 10; i++) s.update(1, clampDt(0.25, 0.25));
    expect(s.value).toBeGreaterThan(0.9);
  });

  it('dt gigante (pestaña suspendida) no explota', () => {
    const s = new Spring(0, 260, 14);
    s.update(1, clampDt(5));
    expect(Number.isFinite(s.value)).toBe(true);
    expect(Math.abs(s.value)).toBeLessThan(2);
  });
});

describe('salto con principios de animación', () => {
  it('anticipa aplastado, vuela estirado y aterriza aplastado', () => {
    const p = { y: 0, squash: 1 };
    expect(hop(0.1, 0.2, p).squash).toBeLessThan(1);
    expect(hop(0.1, 0.2, p).y).toBe(0);
    expect(hop(0.5, 0.2, p).y).toBeCloseTo(0.2, 2);
    expect(hop(0.91, 0.2, p).squash).toBeLessThan(1);
  });
});
