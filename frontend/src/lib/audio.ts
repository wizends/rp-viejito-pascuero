/**
 * Sonidos sintetizados con WebAudio (sin archivos ni descargas):
 * un "clic" de enchufe y campanitas. Solo suenan si el usuario activó el audio.
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function playClick(): void {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1800, t);
  osc.frequency.exponentialRampToValueAtTime(240, t + 0.04);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.07);
}

/** Campanitas: tres notas pentatónicas con armónicos inarmónicos de campana. */
export function playBells(): void {
  const c = getCtx();
  if (!c) return;
  const notes = [1318.5, 1568, 1760, 2093];
  notes.forEach((f, i) => {
    const t = c.currentTime + i * 0.12;
    [1, 2.76, 5.4].forEach((ratio, k) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = f * ratio;
      const peak = 0.07 / (k + 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2 / (k + 1));
      osc.connect(g).connect(c.destination);
      osc.start(t);
      osc.stop(t + 1.3);
    });
  });
}
