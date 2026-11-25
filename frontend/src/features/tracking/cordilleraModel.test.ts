import { describe, expect, it } from 'vitest';
import { CORDILLERA, LAYERS, maxPeakHeight, ridgeProfile, ridgeShape, sleighPose, snowShapes } from './cordilleraModel';

describe('modelado de la cordillera (contrato visual reproducible)', () => {
  it('un mismo planeta da el mismo perfil; capas distintas, perfiles distintos', () => {
    const a = ridgeProfile(1);
    expect(ridgeProfile(1)).toEqual(a);
    expect(ridgeProfile(0)).not.toEqual(a);
    const xs = a.points.map((p) => p[0]);
    expect(xs).toEqual([...xs].sort((x, y) => x - y));
    expect(xs[0]).toBe(-CORDILLERA.width / 2);
    expect(xs[xs.length - 1]).toBe(CORDILLERA.width / 2);
  });

  it('las coronas de nieve salen del mismo perfil y no flotan sobre el pico', () => {
    const ridge = ridgeProfile(2);
    const caps = snowShapes(ridge);
    expect(caps).toHaveLength(ridge.peaks.length);
    expect(ridgeShape(ridge).getPoints().length).toBeGreaterThan(3);
    ridge.peaks.forEach((peak) => {
      expect(peak.capY).toBeLessThan(peak.y);
      expect(peak.capLeft).toBeLessThan(peak.x);
      expect(peak.capRight).toBeGreaterThan(peak.x);
    });
  });

  it('cada capa respeta su rango de alturas', () => {
    LAYERS.forEach((layer, i) => {
      ridgeProfile(i).peaks.forEach((peak) => {
        expect(peak.y).toBeGreaterThanOrEqual(layer.minHeight);
        expect(peak.y).toBeLessThanOrEqual(layer.maxHeight);
      });
    });
  });

  it('el trineo sobrevuela los picos y el movimiento es determinista', () => {
    expect(CORDILLERA.sleighBaseY - 0.16).toBeGreaterThan(maxPeakHeight() + 0.5);
    expect(sleighPose(CORDILLERA.flightSeconds)).toEqual(sleighPose(0));
    const still = sleighPose(123, true);
    expect(still).toEqual(sleighPose(999, true));
    expect(still.x).toBeGreaterThan(-CORDILLERA.flightWidth / 2);
    expect(still.x).toBeLessThan(CORDILLERA.flightWidth / 2);
  });
});
