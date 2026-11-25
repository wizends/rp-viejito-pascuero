/**
 * Música navideña tocada por el navegador (WebAudio), sin archivos de audio.
 * Solo villancicos tradicionales de dominio público, arreglados como caja musical
 * con bajo suave, colchón de acordes y cascabeles.
 */

/** [nota, duración en pulsos]; null = silencio. */
export type Note = readonly [string | null, number];

export interface Song {
  id: string;
  title: string;
  /** autor u origen de la melodía (todas de dominio público) */
  origin: string;
  bpm: number;
  beatsPerBar: number;
  /** pulsos de anacrusa antes del primer compás */
  pickup?: number;
  /** semitonos para subir o bajar toda la melodía */
  transpose?: number;
  bells?: boolean;
  melody: readonly Note[];
  /** un acorde por compás (C, F, G, D, E, A, Am…) */
  chords: readonly string[];
}

const n = (s: string): Note[] =>
  s
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const [p, d] = tok.split(':') as [string, string];
      return [p === 'r' ? null : p, Number(d)] as const;
    });

export const SONGS: readonly Song[] = [
  {
    id: 'cascabel',
    title: 'Cascabel (Jingle Bells)',
    origin: 'James Lord Pierpont, 1857',
    bpm: 150,
    beatsPerBar: 4,
    bells: true,
    melody: n(`
      E5:1 E5:1 E5:2  E5:1 E5:1 E5:2  E5:1 G5:1 C5:1.5 D5:0.5  E5:4
      F5:1 F5:1 F5:1.5 F5:0.5  F5:1 E5:1 E5:1 E5:0.5 E5:0.5  E5:1 D5:1 D5:1 E5:1  D5:2 G5:2
      E5:1 E5:1 E5:2  E5:1 E5:1 E5:2  E5:1 G5:1 C5:1.5 D5:0.5  E5:4
      F5:1 F5:1 F5:1.5 F5:0.5  F5:1 E5:1 E5:1 E5:0.5 E5:0.5  G5:1 G5:1 F5:1 D5:1  C5:4`),
    chords: ['C', 'C', 'C', 'C', 'F', 'C', 'D', 'G', 'C', 'C', 'C', 'C', 'F', 'C', 'G', 'C'],
  },
  {
    id: 'falala',
    title: 'Adornemos el hogar (Deck the Halls)',
    origin: 'Tradicional galés',
    bpm: 132,
    beatsPerBar: 4,
    bells: true,
    melody: n(`
      G5:1.5 F5:0.5 E5:1 D5:1  C5:1 D5:1 E5:1 C5:1  D5:0.5 E5:0.5 F5:0.5 D5:0.5 E5:1.5 D5:0.5  C5:1 B4:1 C5:2
      G5:1.5 F5:0.5 E5:1 D5:1  C5:1 D5:1 E5:1 C5:1  D5:0.5 E5:0.5 F5:0.5 D5:0.5 E5:1.5 D5:0.5  C5:1 B4:1 C5:2
      D5:1.5 E5:0.5 F5:1 D5:1  E5:1.5 F5:0.5 G5:1 D5:1  E5:0.5 F5:0.5 G5:1 A5:0.5 B5:0.5 C6:1  B5:1 A5:1 G5:2
      G5:1.5 F5:0.5 E5:1 D5:1  C5:1 D5:1 E5:1 C5:1  A5:0.5 A5:0.5 A5:0.5 A5:0.5 G5:1.5 F5:0.5  E5:1 D5:1 C5:2`),
    chords: ['C', 'C', 'G', 'C', 'C', 'C', 'G', 'C', 'G', 'C', 'D', 'G', 'C', 'C', 'F', 'C'],
  },
  {
    id: 'deseamos',
    title: 'Les deseamos feliz Navidad',
    origin: 'Tradicional inglés',
    bpm: 150,
    beatsPerBar: 3,
    pickup: 1,
    bells: true,
    melody: n(`
      G4:1
      C5:1 C5:0.5 D5:0.5 C5:0.5 B4:0.5  A4:1 A4:1 A4:1  D5:1 D5:0.5 E5:0.5 D5:0.5 C5:0.5  B4:1 G4:1 G4:1
      E5:1 E5:0.5 F5:0.5 E5:0.5 D5:0.5  C5:1 A4:1 G4:0.5 G4:0.5  A4:1 D5:1 B4:1  C5:2 r:1`),
    chords: ['C', 'F', 'D', 'G', 'E', 'Am', 'G', 'C'],
  },
  {
    id: 'nochedepaz',
    title: 'Noche de paz',
    origin: 'Franz Xaver Gruber, 1818',
    bpm: 132,
    beatsPerBar: 6,
    transpose: 12,
    melody: n(`
      G4:1.5 A4:0.5 G4:1 E4:3  G4:1.5 A4:0.5 G4:1 E4:3  D5:2 D5:1 B4:3  C5:2 C5:1 G4:3
      A4:2 A4:1 C5:1.5 B4:0.5 A4:1  G4:1.5 A4:0.5 G4:1 E4:3  A4:2 A4:1 C5:1.5 B4:0.5 A4:1  G4:1.5 A4:0.5 G4:1 E4:3
      D5:2 D5:1 F5:1.5 D5:0.5 B4:1  C5:3 E5:3  C5:1.5 G4:0.5 E4:1 G4:1.5 F4:0.5 D4:1  C4:6`),
    chords: ['C', 'C', 'G', 'C', 'F', 'C', 'F', 'C', 'G', 'C', 'G', 'C'],
  },
];

// ---------- teoría mínima ----------

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#5" → número MIDI. */
export function midi(pitch: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(pitch);
  if (!m) throw new Error(`Nota inválida: ${pitch}`);
  const [, l, acc, oct] = m as unknown as [string, string, string, string];
  return 12 * (Number(oct) + 1) + SEMI[l]! + (acc === '#' ? 1 : acc === 'b' ? -1 : 0);
}

export const freq = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Notas MIDI del acorde (fundamental en la octava 3). */
export function chordNotes(name: string): number[] {
  const minor = name.endsWith('m');
  const root = midi(`${name.replace('m', '')}3`);
  return [root, root + (minor ? 3 : 4), root + 7];
}

export interface Timeline {
  /** [inicio en pulsos, duración en pulsos, nota MIDI] */
  notes: [number, number, number][];
  bars: number;
  /** duración total en pulsos (anacrusa incluida) */
  length: number;
}

export function timeline(s: Song): Timeline {
  let t = 0;
  const notes: Timeline['notes'] = [];
  for (const [p, d] of s.melody) {
    if (p) notes.push([t, d, midi(p) + (s.transpose ?? 0)]);
    t += d;
  }
  const pickup = s.pickup ?? 0;
  return { notes, bars: (t - pickup) / s.beatsPerBar, length: t };
}

// ---------- motor de sonido ----------

interface Engine {
  ctx: AudioContext;
  master: GainNode;
  /** eco suave para la caja musical */
  wet: GainNode;
  noise: AudioBuffer;
}

let engine: Engine | null = null;

function getEngine(): Engine | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!engine) {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // eco: delay con realimentación y filtro, mezcla baja
    const wet = ctx.createGain();
    const delay = ctx.createDelay(1);
    const fb = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    delay.delayTime.value = 0.27;
    fb.gain.value = 0.28;
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    wet.gain.value = 0.22;
    wet.connect(delay).connect(lp).connect(fb).connect(delay);
    lp.connect(master);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const ch = noise.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    engine = { ctx, master, wet, noise };
  }
  return engine;
}

function musicBox(e: Engine, m: number, t: number, dur: number, vel = 1) {
  const f = freq(m);
  const len = Math.min(2.2, Math.max(0.5, dur * 1.8));
  [
    [1, 0.16],
    [2, 0.05],
    [3, 0.02],
    [4.2, 0.012],
  ].forEach(([ratio, gain]) => {
    const o = e.ctx.createOscillator();
    const g = e.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f * ratio!;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain! * vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len / ratio! ** 0.5);
    o.connect(g);
    g.connect(e.master);
    g.connect(e.wet);
    o.start(t);
    o.stop(t + len + 0.05);
  });
}

function bass(e: Engine, m: number, t: number, dur: number) {
  const o = e.ctx.createOscillator();
  const g = e.ctx.createGain();
  o.type = 'triangle';
  o.frequency.value = freq(m - 12);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.11, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
  o.connect(g).connect(e.master);
  o.start(t);
  o.stop(t + dur);
}

function pad(e: Engine, notes: number[], t: number, dur: number) {
  for (const m of notes) {
    const o = e.ctx.createOscillator();
    const g = e.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq(m + 12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.018, t + Math.min(0.4, dur * 0.3));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(e.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

function sleighBell(e: Engine, t: number, accent: boolean) {
  const src = e.ctx.createBufferSource();
  const hp = e.ctx.createBiquadFilter();
  const g = e.ctx.createGain();
  src.buffer = e.noise;
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(accent ? 0.06 : 0.035, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  src.connect(hp).connect(g).connect(e.master);
  src.start(t);
  src.stop(t + 0.16);
}

// ---------- reproductor ----------

export interface PlayerEvents {
  /** se llamó cuando empieza cada canción (índice en SONGS) */
  onSong?: (index: number) => void;
}

/**
 * Reproductor con programación anticipada (la forma fiable de llevar el tiempo en
 * WebAudio): cada 50 ms agenda las notas de los próximos 0,4 s.
 */
export class MusicPlayer {
  private timer: number | undefined;
  private index = 0;
  private songStart = 0;
  private cursor = 0; // próximo pulso a programar
  private volume = 0.7;
  private ev: PlayerEvents;

  constructor(ev: PlayerEvents = {}) {
    this.ev = ev;
  }

  get playing() {
    return this.timer !== undefined;
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    const e = engine;
    if (e && this.playing) e.master.gain.setTargetAtTime(this.volume * 0.5, e.ctx.currentTime, 0.1);
  }

  play(index = this.index) {
    const e = getEngine();
    if (!e) return false;
    void e.ctx.resume();
    this.stopTimer();
    this.start(index, e.ctx.currentTime + 0.12);
    e.master.gain.cancelScheduledValues(e.ctx.currentTime);
    e.master.gain.setTargetAtTime(this.volume * 0.5, e.ctx.currentTime, 0.15);
    this.timer = window.setInterval(() => this.tick(), 50);
    this.tick();
    return true;
  }

  pause() {
    const e = engine;
    this.stopTimer();
    if (!e) return;
    // las notas ya agendadas se apagan con un fundido
    e.master.gain.cancelScheduledValues(e.ctx.currentTime);
    e.master.gain.setTargetAtTime(0, e.ctx.currentTime, 0.08);
  }

  next() {
    this.play((this.index + 1) % SONGS.length);
  }

  private stopTimer() {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
  }

  private start(index: number, at: number) {
    this.index = index;
    this.songStart = at;
    this.cursor = 0;
    this.ev.onSong?.(index);
  }

  private tick() {
    const e = engine;
    if (!e) return;
    const s = SONGS[this.index]!;
    const tl = timeline(s);
    const spb = 60 / s.bpm;
    const horizon = e.ctx.currentTime + 0.4;
    const pickup = s.pickup ?? 0;
    // un compás de silencio entre canciones
    const end = tl.length + s.beatsPerBar;
    while (this.songStart + this.cursor * spb < horizon) {
      const from = this.cursor;
      const to = from + 0.5; // se programa de a medio pulso
      for (const [b, d, m] of tl.notes) if (b >= from && b < to) musicBox(e, m, this.songStart + b * spb, d * spb);
      for (let beat = Math.ceil(from); beat < to; beat++) {
        const rel = beat - pickup;
        if (rel < 0 || beat >= tl.length) continue;
        const inBar = rel % s.beatsPerBar;
        const bar = Math.floor(rel / s.beatsPerBar);
        const chord = s.chords[bar];
        const t = this.songStart + beat * spb;
        if (chord && inBar === 0) {
          const notes = chordNotes(chord);
          pad(e, notes, t, s.beatsPerBar * spb);
          bass(e, notes[0]!, t, Math.min(s.beatsPerBar, 2) * spb);
        } else if (chord && s.beatsPerBar >= 4 && inBar === s.beatsPerBar / 2) {
          bass(e, chordNotes(chord)[2]!, t, 2 * spb);
        }
        if (s.bells) sleighBell(e, t, inBar === 0);
      }
      this.cursor = to;
      if (this.cursor >= end) {
        this.start((this.index + 1) % SONGS.length, this.songStart + end * spb);
        return;
      }
    }
  }
}
