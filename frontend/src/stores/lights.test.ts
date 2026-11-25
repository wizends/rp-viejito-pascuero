import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SWEEP_MS, bulbColorIndex, bulbIntensity, useLights } from './lights';

describe('bulbIntensity (efecto encendido bombilla por bombilla)', () => {
  it('apagadas: todas en 0 una vez pasada la onda', () => {
    for (let i = 0; i < 10; i++) expect(bulbIntensity('off', 0, i, 10, SWEEP_MS * 2)).toBe(0);
  });

  it('la onda enciende primero las primeras bombillas', () => {
    const mid = SWEEP_MS * 0.3;
    expect(bulbIntensity('steady', 0, 0, 20, mid)).toBeGreaterThan(0);
    expect(bulbIntensity('steady', 0, 19, 20, mid)).toBe(0);
    expect(bulbIntensity('steady', 0, 19, 20, SWEEP_MS + 1)).toBeGreaterThan(0);
  });

  it('al apagar, las últimas siguen encendidas hasta que llega el frente', () => {
    const mid = SWEEP_MS * 0.3;
    expect(bulbIntensity('off', 0, 0, 20, mid)).toBe(0);
    expect(bulbIntensity('off', 0, 19, 20, mid)).toBeGreaterThan(0);
  });

  it('con movimiento reducido el cambio es inmediato y sin parpadeo', () => {
    expect(bulbIntensity('twinkle', 0, 19, 20, 1, true)).toBe(1);
  });

  it('en modo secuencia los colores rotan con el tiempo', () => {
    expect(bulbColorIndex('sequence', 0, 0)).not.toBe(bulbColorIndex('sequence', 0, 950));
    expect(bulbColorIndex('steady', 0, 0)).toBe(bulbColorIndex('steady', 0, 950));
  });
});

describe('store de luces', () => {
  beforeEach(() => {
    useLights.setState({ mode: 'off', lastOnMode: 'twinkle', audio: false });
    localStorage.clear();
  });

  it('toggle enciende con el último modo y persiste', () => {
    useLights.getState().toggle();
    expect(useLights.getState().mode).toBe('twinkle');
    expect(JSON.parse(localStorage.getItem('vp:luces')!).mode).toBe('twinkle');
    useLights.getState().toggle();
    expect(useLights.getState().mode).toBe('off');
  });

  it('setMode recuerda el modo elegido', () => {
    useLights.getState().setMode('sequence');
    useLights.getState().toggle();
    useLights.getState().toggle();
    expect(useLights.getState().mode).toBe('sequence');
  });

  it('localStorage que falla no rompe la app', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => useLights.getState().toggle()).not.toThrow();
    spy.mockRestore();
  });
});
