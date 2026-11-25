import type { Stop } from './types';

export interface Countdown {
  done: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function countdown(targetMs: number, nowMs: number): Countdown {
  const diff = Math.max(0, targetMs - nowMs);
  const s = Math.floor(diff / 1000);
  return {
    done: diff === 0,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

export function countdownLabel(c: Countdown): string {
  if (c.done) return '¡El Viejito Pascuero ya llegó!';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `El Viejito Pascuero llega en ${c.days} d ${pad(c.hours)} h ${pad(c.minutes)} min`;
}

/** Índice de la parada actual: la primera no completada (o -1 si todas lo están). */
export function currentStopIndex(stops: Stop[]): number {
  return stops.findIndex((s) => !s.completed_at);
}

export interface SleighPosition {
  lat: number;
  lng: number;
  /** índice del tramo [i, i+1] sobre la lista de paradas con coordenadas */
  segment: number;
  /** 0..1 dentro del tramo */
  t: number;
}

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);

/**
 * Posición del trineo interpolada por tiempo entre paradas con coordenadas.
 * Usa la hora real (completed_at) si existe; si no, la estimada (eta).
 */
export function sleighPosition(stops: Stop[], nowMs: number): SleighPosition | null {
  const geo = stops.filter((s) => s.lat !== null && s.lng !== null);
  if (geo.length === 0) return null;
  const first = geo[0]!;
  if (geo.length === 1) return { lat: first.lat!, lng: first.lng!, segment: 0, t: 0 };

  const when = (s: Stop) => (s.completed_at ? ms(s.completed_at) : ms(s.eta));
  for (let i = 0; i < geo.length - 1; i++) {
    const a = geo[i]!;
    const b = geo[i + 1]!;
    if (!b.completed_at) {
      const ta = a.completed_at ? when(a) : NaN;
      const tb = when(b);
      let t = 0;
      if (a.completed_at && Number.isFinite(ta) && Number.isFinite(tb) && tb > ta) {
        t = Math.min(0.97, Math.max(0, (nowMs - ta) / (tb - ta)));
      }
      if (!a.completed_at) t = 0;
      return { lat: a.lat! + (b.lat! - a.lat!) * t, lng: a.lng! + (b.lng! - a.lng!) * t, segment: i, t };
    }
  }
  const last = geo[geo.length - 1]!;
  return { lat: last.lat!, lng: last.lng!, segment: geo.length - 2, t: 1 };
}

/** Curva cuadrática "de arco" entre dos puntos, para dibujar rutas de trineo. */
export function arcPoints(
  a: [number, number],
  b: [number, number],
  bend = 0.25,
  steps = 32,
): [number, number][] {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const mid: [number, number] = [(lat1 + lat2) / 2, (lng1 + lng2) / 2];
  // Control perpendicular al tramo
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const ctrl: [number, number] = [mid[0] - dLng * bend, mid[1] + dLat * bend];
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([
      u * u * lat1 + 2 * u * t * ctrl[0] + t * t * lat2,
      u * u * lng1 + 2 * u * t * ctrl[1] + t * t * lng2,
    ]);
  }
  return pts;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return 'Sin hora';
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Convierte ISO → valor de <input type="datetime-local"> en hora de Chile. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
  return parts.replace(' ', 'T');
}

/** Interpreta un datetime-local como hora de Chile y devuelve ISO UTC. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const guess = new Date(`${value}:00Z`);
  // Desfase de America/Santiago en ese instante
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    timeZoneName: 'longOffset',
  })
    .formatToParts(guess)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = tzName?.match(/GMT([+-])(\d{2}):(\d{2})/);
  const offsetMin = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(guess.getTime() - offsetMin * 60_000).toISOString();
}

/**
 * Paradas que se completaron desde la consulta anterior (para la celebración cuando
 * no hay WebSocket). `seen` null = primera carga: no se celebra lo que ya estaba hecho.
 */
export function newlyCompleted(seen: ReadonlySet<string> | null, stops: Stop[]): Stop[] {
  if (!seen) return [];
  return stops.filter((s) => s.completed_at && !seen.has(s.id));
}
