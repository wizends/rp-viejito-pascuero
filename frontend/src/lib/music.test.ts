import { SONGS, chordNotes, freq, midi, timeline } from './music';

describe('música navideña', () => {
  it('convierte notas a frecuencias', () => {
    expect(midi('A4')).toBe(69);
    expect(midi('C4')).toBe(60);
    expect(midi('C#5')).toBe(73);
    expect(freq(69)).toBeCloseTo(440);
    expect(freq(81)).toBeCloseTo(880);
    expect(() => midi('H2')).toThrow();
  });

  it('arma acordes mayores y menores', () => {
    expect(chordNotes('C')).toEqual([48, 52, 55]);
    expect(chordNotes('Am')).toEqual([57, 60, 64]);
  });

  it.each(SONGS.map((s) => [s.title, s] as const))('%s: compases completos y un acorde por compás', (_t, s) => {
    const tl = timeline(s);
    // cada compás suma exactamente su métrica (atrapa errores al transcribir la melodía)
    expect(Number.isInteger(tl.bars)).toBe(true);
    expect(s.chords).toHaveLength(tl.bars);
    expect(tl.notes.length).toBeGreaterThan(10);
    // en un registro agradable de caja musical
    for (const [, , m] of tl.notes) {
      expect(m).toBeGreaterThanOrEqual(midi('C4'));
      expect(m).toBeLessThanOrEqual(midi('C7'));
    }
  });

  it('todas son melodías de dominio público con su origen', () => {
    for (const s of SONGS) expect(s.origin).toMatch(/Tradicional|18\d\d/);
  });
});
