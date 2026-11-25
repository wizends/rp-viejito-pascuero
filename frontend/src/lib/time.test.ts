import { describe, expect, it } from 'vitest';
import { countdown, countdownLabel, currentStopIndex, fromLocalInput, newlyCompleted, sleighPosition, toLocalInput } from './time';
import type { Stop } from './types';

const stop = (p: Partial<Stop>): Stop => ({
  id: Math.random().toString(36),
  position: 0,
  nombre: 'x',
  icono: 'estrella',
  descripcion: '',
  lat: null,
  lng: null,
  eta: null,
  completed_at: null,
  auto_advance: false,
  ...p,
});

describe('cuenta regresiva', () => {
  it('descompone días, horas y minutos', () => {
    const c = countdown((2 * 86400 + 4 * 3600 + 13 * 60) * 1000, 0);
    expect(countdownLabel(c)).toBe('El Viejito Pascuero llega en 2 d 04 h 13 min');
  });
  it('no baja de cero', () => {
    expect(countdown(0, 5000).done).toBe(true);
  });
});

describe('hora de Chile', () => {
  it('ida y vuelta datetime-local ↔ ISO en verano (UTC-3)', () => {
    const iso = fromLocalInput('2026-12-25T00:00');
    expect(iso).toBe('2026-12-25T03:00:00.000Z');
    expect(toLocalInput(iso)).toBe('2026-12-25T00:00');
  });
});

describe('posición del trineo', () => {
  it('interpola entre la última parada completada y la siguiente', () => {
    const stops = [
      stop({ lat: 0, lng: 0, completed_at: new Date(0).toISOString() }),
      stop({ lat: 10, lng: 20, eta: new Date(100_000).toISOString() }),
    ];
    const p = sleighPosition(stops, 50_000)!;
    expect(p.lat).toBeCloseTo(5);
    expect(p.lng).toBeCloseTo(10);
    expect(currentStopIndex(stops)).toBe(1);
  });
  it('se queda en la última si todo está completado', () => {
    const stops = [
      stop({ lat: 0, lng: 0, completed_at: '2026-01-01T00:00:00Z' }),
      stop({ lat: 10, lng: 20, completed_at: '2026-01-02T00:00:00Z' }),
    ];
    expect(sleighPosition(stops, Date.now())).toMatchObject({ lat: 10, lng: 20 });
  });
  it('sin coordenadas no hay trineo en el mapa', () => {
    expect(sleighPosition([stop({})], 0)).toBeNull();
  });
});

describe('paradas recién completadas (sin WebSocket)', () => {
  const stop = (id: string, done: boolean) => ({ id, completed_at: done ? '2026-12-24T10:00:00Z' : null }) as Stop;
  it('no celebra en la primera carga', () => {
    expect(newlyCompleted(null, [stop('a', true)])).toEqual([]);
  });
  it('celebra solo las que se completaron desde la consulta anterior', () => {
    const seen = new Set(['a']);
    expect(newlyCompleted(seen, [stop('a', true), stop('b', true), stop('c', false)]).map((s) => s.id)).toEqual(['b']);
  });
});
