import { fitSize, measure, pickSide, rng, santaBox } from './compose';

describe('selfie del Viejito', () => {
  it('pone al Viejito en la mitad más tranquila de la foto', () => {
    expect(pickSide({ busyLeft: 10, busyRight: 40 })).toBe('izq');
    expect(pickSide({ busyLeft: 40, busyRight: 10 })).toBe('der');
    expect(pickSide({ busyLeft: 20, busyRight: 20 })).toBe('der');
  });

  it('detecta en qué lado está el árbol iluminado', () => {
    const w = 8, h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        // a la izquierda, lucecitas de colores que parpadean; a la derecha, pared lisa
        const on = x < w / 2 && (x + y) % 2 === 0;
        data.set(on ? [255, 220, 40, 255] : x < w / 2 ? [20, 80, 30, 255] : [120, 110, 100, 255], i);
      }
    const s = measure(data, w, h);
    expect(s.busyLeft).toBeGreaterThan(s.busyRight);
    expect(pickSide(s)).toBe('der');
    expect(s.luma).toBeGreaterThan(0);
    expect(s.luma).toBeLessThan(1);
  });

  it('el Viejito queda grande, en primer plano y cortado por el borde', () => {
    const der = santaBox(1600, 1200, 'der');
    expect(der.w).toBeLessThanOrEqual(800);
    expect(der.x + der.w).toBeGreaterThan(1600); // el brazo sale por el costado
    expect(der.y + der.h).toBeGreaterThan(1200); // y el busto por abajo
    const izq = santaBox(1600, 1200, 'izq');
    expect(izq.x).toBeLessThan(0);
    expect(izq.w).toBe(der.w);
    // en vertical no se come la foto entera
    expect(santaBox(900, 1600, 'der').w).toBeLessThanOrEqual(900 * 0.66 + 1);
  });

  it('achica sin deformar y es reproducible', () => {
    expect(fitSize(4000, 3000)).toEqual({ w: 1600, h: 1200 });
    expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 });
    const a = rng(42), b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
