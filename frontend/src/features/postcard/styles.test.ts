import { defaultPostcard } from './render';
import { FONTS, STYLES, STYLE_FONT_FACES, STYLE_IDS, posterizeData, stickerShadow } from './styles';

describe('estilos gráficos de la postal', () => {
  it('hay al menos 5 estilos y cada uno trae su tipografía', () => {
    expect(STYLE_IDS).toEqual(expect.arrayContaining(['tradicional', 'anime', 'acuarela', 'realista', 'crayon']));
    for (const s of STYLE_IDS) {
      expect(STYLES[s].label).toBeTruthy();
      expect(FONTS[s].title(40)).toMatch(/40px/);
      expect(FONTS[s].sign(30)).toMatch(/30px/);
    }
    // los estilos no comparten la letra del título
    expect(new Set(STYLE_IDS.map((s) => FONTS[s].title(10))).size).toBe(STYLE_IDS.length);
    // y todas sus fuentes se precargan
    for (const fam of ['Fredoka', 'Dancing Script', 'Playfair Display', 'Gochi Hand']) {
      expect(STYLE_FONT_FACES.some((f) => f.includes(fam))).toBe(true);
    }
  });

  it('la postal nueva parte en estilo tradicional', () => {
    expect(defaultPostcard().style).toBe('tradicional');
  });

  it('posterizar deja pocos tonos y no toca la transparencia', () => {
    const d = new Uint8ClampedArray([10, 120, 250, 77, 200, 60, 130, 255]);
    posterizeData(d, 3); // tonos: 0, 127.5, 255
    expect([...d]).toEqual([0, 128, 255, 77, 255, 0, 128, 255]);
  });

  it('cada estilo pega los stickers con su propia sombra', () => {
    expect(stickerShadow('acuarela', 1000).color).toBe('transparent');
    expect(stickerShadow('realista', 1000).blur).toBeGreaterThan(stickerShadow('tradicional', 1000).blur);
  });
});
