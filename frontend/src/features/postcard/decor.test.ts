import { borderPoint } from './decor';
import { FRAMES, THEMES } from './render';

describe('fondos y bordes de la postal', () => {
  it('recorre el borde completo en sentido horario', () => {
    const W = 1000, H = 500, inset = 10;
    expect(borderPoint(W, H, inset, 0)).toEqual([10, 10, -Math.PI / 2]); // arriba
    const [x1, y1] = borderPoint(W, H, inset, 0.4); // lado derecho
    expect(x1).toBe(990);
    expect(y1).toBeGreaterThan(10);
    const [, y2, a2] = borderPoint(W, H, inset, 0.6); // abajo
    expect(y2).toBe(490);
    expect(a2).toBe(Math.PI / 2);
    expect(borderPoint(W, H, inset, 1)).toEqual(borderPoint(W, H, inset, 0)); // da la vuelta
  });

  it('cada fondo trae colores de texto legibles y cada borde un nombre', () => {
    for (const t of Object.values(THEMES)) {
      expect(t.title).toMatch(/^#/);
      expect(t.halo).toMatch(/^rgb/);
    }
    expect(Object.keys(THEMES).length).toBeGreaterThanOrEqual(11);
    expect(Object.keys(FRAMES)).toContain('ninguno');
    expect(new Set(Object.values(FRAMES)).size).toBe(Object.keys(FRAMES).length);
  });
});
