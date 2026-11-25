import { FORMATS, defaultPostcard, hitTest, inBox, letterText, stickerBox, wrapText } from './render';
import { STICKER_GROUPS, STICKER_IDS, stickerSvg } from './stickers';

const mono = (s: string) => s.length * 10; // cada letra mide 10 px

describe('postal navideña', () => {
  it('corta el texto en renglones y respeta los saltos de línea', () => {
    expect(wrapText(mono, 'quiero una bici roja', 100)).toEqual(['quiero una', 'bici roja']);
    expect(wrapText(mono, 'hola\n\nchao', 100)).toEqual(['hola', '', 'chao']);
    // una palabra larguísima no se pierde
    expect(wrapText(mono, 'supercalifragilistico', 50)).toEqual(['supercalifragilistico']);
    expect(wrapText(mono, 'fin\n\n', 100)).toEqual(['fin']);
  });

  it('detecta toques dentro de cajas giradas', () => {
    const b = { cx: 100, cy: 100, w: 100, h: 20, rot: Math.PI / 2 };
    expect(inBox(b, 100, 145)).toBe(true); // girada 90°: ahora es alta
    expect(inBox(b, 145, 100)).toBe(false);
  });

  it('el sticker de arriba gana sobre la carta', () => {
    const p = defaultPostcard('Sofi');
    const { w, h } = FORMATS[p.format];
    const letter = { cx: w / 2, cy: h / 2, w: 600, h: 600, rot: 0 };
    p.stickers = [
      { id: 'a', sticker: 'estrella', x: 0.5, y: 0.5, size: 0.1, rot: 0 },
      { id: 'b', sticker: 'copo', x: 0.5, y: 0.5, size: 0.1, rot: 0 },
    ];
    expect(hitTest(p, letter, w / 2, h / 2)).toEqual({ type: 'sticker', id: 'b' });
    expect(hitTest(p, letter, w / 2 + 250, h / 2)).toEqual({ type: 'carta' });
    expect(hitTest(p, letter, 5, 5)).toBeNull();
    expect(stickerBox(p.stickers[0]!, w, h)).toMatchObject({ cx: w / 2, w: w * 0.1 });
  });

  it('la firma usa el apodo y la carta escrita trae su texto', () => {
    expect(defaultPostcard('Sofi').signature).toBe('Con cariño, Sofi');
    expect(letterText({ texto_normalizado: '', texto_original: 'Hola Viejito', mensaje: '', gifts: [] })).toBe('Hola Viejito');
    expect(letterText({ texto_normalizado: '', texto_original: '', mensaje: '', gifts: [{ nombre: 'trompo' }] })).toBe('Mis deseos:\n- trompo');
  });

  it('la paleta muestra cada sticker una sola vez', () => {
    const shown = STICKER_GROUPS.flatMap((g) => g.ids);
    expect(new Set(shown).size).toBe(shown.length);
    expect([...shown].sort()).toEqual([...STICKER_IDS].sort());
  });

  it('todos los stickers son SVG válidos', () => {
    for (const id of STICKER_IDS) {
      const doc = new DOMParser().parseFromString(stickerSvg(id), 'image/svg+xml');
      expect(doc.querySelector('parsererror')).toBeNull();
    }
  });
});
