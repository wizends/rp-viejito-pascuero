import { describe, expect, it } from 'vitest';
import { POLO_NORTE, countdown, countdownLabel, currentStopIndex, flightRoute, fromLocalInput, newlyCompleted, sleighPosition, toLocalInput } from './time';
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

describe('ruta del trineo desde el Polo Norte', () => {
  const H = 3_600_000;
  const mk = (id: string, eta: number, geo: [number, number] | null, done = false) =>
    ({ id, eta: new Date(eta).toISOString(), completed_at: done ? new Date(eta).toISOString() : null, lat: geo?.[0] ?? null, lng: geo?.[1] ?? null }) as Stop;
  const plan = (doneUpTo: number) => [
    mk('taller', 0, null, doneUpTo >= 0),
    mk('renos', 10 * H, null, doneUpTo >= 1),
    mk('andes', 18 * H, [-27.1, -68.5], doneUpTo >= 2),
    mk('ciudad', 20 * H, [-33.45, -70.66], doneUpTo >= 3),
  ];

  it('espera en el Polo Norte mientras el taller trabaja', () => {
    const r = flightRoute(plan(0), 5 * H)!;
    expect(r.departed).toBe(false);
    expect([r.sleigh.lat, r.sleigh.lng]).toEqual(POLO_NORTE);
    expect(r.points).toHaveLength(3);
    expect(r.flown).toHaveLength(0);
  });

  it('vuela por la curva hacia los Andes después de que despegan los renos', () => {
    const r = flightRoute(plan(1), 14 * H)!;
    expect(r.departed).toBe(true);
    expect(r.sleigh.segment).toBe(0);
    expect(r.sleigh.t).toBeCloseTo(0.5, 2);
    // entre el Polo Norte y los Andes, y con estela recorrida
    expect(r.sleigh.lat).toBeLessThan(POLO_NORTE[0]);
    expect(r.sleigh.lat).toBeGreaterThan(-27.1);
    expect(r.flown.length).toBeGreaterThan(5);
  });

  it('llega a la ciudad al completar todo y sin paradas con coordenadas no hay ruta', () => {
    const r = flightRoute(plan(3), 30 * H)!;
    expect(r.sleigh.lat).toBeCloseTo(-33.45, 5);
    expect(flightRoute([mk('x', 0, null)], 0)).toBeNull();
  });
});
