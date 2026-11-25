import { rng } from '@/features/selfie/compose';
import { drawFrame, drawThemeBackground } from './decor';
import { stickerSvg, type StickerId } from './stickers';
import { FONTS, STYLE_FONT_FACES, drawStyledText, stickerShadow, styleBackground, styleOverlay, styledSticker, type Style } from './styles';

/** Postal navideña dibujada en canvas: la vista previa y la imagen final son la misma. */

export const FORMATS = {
  cuadrado: { w: 1080, h: 1080, label: 'Cuadrada', hint: 'Feed de Instagram o Facebook' },
  historia: { w: 1080, h: 1920, label: 'Vertical', hint: 'Historias y estados' },
} as const;
export type Format = keyof typeof FORMATS;

interface ThemeInfo {
  label: string;
  /** color del título y de la firma */
  title: string;
  sign: string;
  /** contorno de los textos: oscuro en fondos oscuros, claro en fondos claros */
  halo: string;
  /** muestra para el selector (CSS) */
  swatch: string;
}

const DARK = 'rgb(40 16 10 / 0.55)';
const LIGHT = 'rgb(255 255 255 / 0.9)';

export const THEMES = {
  noche: { label: 'Noche estrellada', title: '#ffe6a3', sign: '#fff7e0', halo: DARK, swatch: 'linear-gradient(#0d1838,#24386e)' },
  kraft: { label: 'Papel kraft', title: '#b8352b', sign: '#4a2e1e', halo: 'rgb(255 245 225 / 0.7)', swatch: 'linear-gradient(#d6b083,#b98d5c)' },
  rojo: { label: 'Rojo regalo', title: '#fff3c4', sign: '#ffffff', halo: DARK, swatch: 'linear-gradient(#d0333a,#8e1220)' },
  bosque: { label: 'Bosque nevado', title: '#fff3c4', sign: '#ffffff', halo: DARK, swatch: 'linear-gradient(#173d2a,#2f6b4a)' },
  rosa: { label: 'Rosa chicle', title: '#c2185b', sign: '#7a1f4a', halo: LIGHT, swatch: 'linear-gradient(#ffd6e7,#ffa8c8)' },
  lavanda: { label: 'Lavanda', title: '#6a3fa0', sign: '#3d2766', halo: LIGHT, swatch: 'linear-gradient(#efe4ff,#c4aef0)' },
  hielo: { label: 'Hielo', title: '#1f4e8c', sign: '#17365f', halo: LIGHT, swatch: 'linear-gradient(#eef8ff,#aed6f3)' },
  dorado: { label: 'Champaña', title: '#9b2c2c', sign: '#5a3a10', halo: LIGHT, swatch: 'radial-gradient(circle,#fff6dc,#e2b866)' },
  menta: { label: 'Menta', title: '#b8352b', sign: '#1e5a44', halo: LIGHT, swatch: 'linear-gradient(#e2f8ee,#9fdcc0)' },
  baston: { label: 'Bastón de dulce', title: '#8e1220', sign: '#8e1220', halo: LIGHT, swatch: 'repeating-linear-gradient(45deg,#d6262f 0 6px,#fff6f2 6px 12px)' },
  arcoiris: { label: 'Arcoíris pastel', title: '#c2185b', sign: '#5b3a8a', halo: LIGHT, swatch: 'linear-gradient(#ffd6e0,#fff3bf,#d4f5d0,#d4ecff,#e6dcff)' },
} as const satisfies Record<string, ThemeInfo>;
export type Theme = keyof typeof THEMES;

export const FRAMES = {
  luces: 'Luces',
  guirnalda: 'Guirnalda',
  baston: 'Bastón de dulce',
  dorado: 'Dorado',
  copos: 'Copos de nieve',
  corazones: 'Corazones',
  encaje: 'Encaje',
  cinta: 'Cinta de regalo',
  ninguno: 'Sin marco',
} as const;
export type Frame = keyof typeof FRAMES;

export interface PlacedSticker {
  id: string;
  sticker: StickerId;
  /** centro, en fracción del ancho (x) y del alto (y) */
  x: number;
  y: number;
  /** lado, en fracción del ancho */
  size: number;
  /** giro en radianes */
  rot: number;
}

export interface LetterPlacement {
  x: number;
  y: number;
  scale: number;
  rot: number;
}

export interface Postcard {
  /** estilo gráfico: cambia fondo, borde, stickers y letras */
  style: Style;
  format: Format;
  theme: Theme;
  frame: Frame;
  snow: boolean;
  title: string;
  signature: string;
  letter: LetterPlacement;
  stickers: PlacedSticker[];
}

export type LetterContent =
  | { kind: 'foto'; image: CanvasImageSource & { width: number; height: number } }
  | { kind: 'texto'; text: string };

export type Selection = { type: 'carta' } | { type: 'sticker'; id: string } | null;

export interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rot: number;
}

export const MAX_STICKERS = 40;

export function defaultPostcard(nickname = ''): Postcard {
  return {
    style: 'tradicional',
    format: 'cuadrado',
    theme: 'noche',
    frame: 'luces',
    snow: true,
    title: '¡Mi carta al Viejito Pascuero!',
    signature: nickname ? `Con cariño, ${nickname}` : 'Con cariño',
    letter: { x: 0.5, y: 0.53, scale: 1, rot: -0.04 },
    stickers: [
      { id: 's1', sticker: 'estrella', x: 0.15, y: 0.25, size: 0.13, rot: -0.2 },
      { id: 's2', sticker: 'muerdago', x: 0.85, y: 0.78, size: 0.16, rot: 0.15 },
    ],
  };
}

// ---------- utilidades puras ----------

/** Corta el texto en líneas que caben en maxW (respeta saltos de línea). */
export function wrapText(measure: (s: string) => number, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (measure(next) <= maxW || !line) {
        line = next;
      } else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  // sin líneas vacías al final
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}

/** ¿El punto (x, y) cae dentro de la caja girada? */
export function inBox(b: Box, x: number, y: number, pad = 0): boolean {
  const dx = x - b.cx;
  const dy = y - b.cy;
  const c = Math.cos(-b.rot);
  const s = Math.sin(-b.rot);
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  return Math.abs(lx) <= b.w / 2 + pad && Math.abs(ly) <= b.h / 2 + pad;
}

export function stickerBox(st: PlacedSticker, W: number, H: number): Box {
  const s = st.size * W;
  return { cx: st.x * W, cy: st.y * H, w: s, h: s, rot: st.rot };
}

/** Lo de más arriba gana: primero los stickers (del último al primero), luego la carta. */
export function hitTest(p: Postcard, letter: Box | null, x: number, y: number): Selection {
  const { w: W, h: H } = FORMATS[p.format];
  for (let i = p.stickers.length - 1; i >= 0; i--) {
    const st = p.stickers[i]!;
    if (inBox(stickerBox(st, W, H), x, y, W * 0.01)) return { type: 'sticker', id: st.id };
  }
  if (letter && inBox(letter, x, y)) return { type: 'carta' };
  return null;
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// ---------- recursos ----------

export function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('No se pudo cargar un sticker.'));
    img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  });
}

let stickerImgs: Promise<Record<StickerId, HTMLImageElement>> | null = null;
export function loadStickers(ids: StickerId[]): Promise<Record<StickerId, HTMLImageElement>> {
  stickerImgs ??= Promise.all(ids.map(async (id) => [id, await loadSvg(stickerSvg(id))] as const)).then(
    (pairs) => Object.fromEntries(pairs) as Record<StickerId, HTMLImageElement>,
  );
  return stickerImgs;
}

export function loadFonts(): Promise<unknown> {
  if (!document.fonts) return Promise.resolve();
  return Promise.all(
    STYLE_FONT_FACES.map((f) => document.fonts.load(f).catch(() => undefined)),
  );
}

// ---------- capas fijas (en caché) ----------

const cache = new Map<string, HTMLCanvasElement>();

function layer(key: string, W: number, H: number, draw: (c: CanvasRenderingContext2D) => void) {
  let cv = cache.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    draw(cv.getContext('2d')!);
    if (cache.size > 16) cache.clear();
    cache.set(key, cv);
  }
  return cv;
}

function drawBackground(c: CanvasRenderingContext2D, theme: Theme, W: number, H: number) {
  const r = rng(theme.length * 97 + H);
  if (theme === 'noche') {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1533');
    g.addColorStop(1, '#25397a');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < (W * H) / 6000; i++) {
      c.fillStyle = `rgb(255 250 230 / ${0.3 + r() * 0.7})`;
      c.beginPath();
      c.arc(r() * W, r() * H, 0.6 + r() * 1.8, 0, Math.PI * 2);
      c.fill();
    }
    // luna creciente con halo, abajo a la izquierda para no chocar con el título
    const mx = W * 0.14;
    const my = H * 0.8;
    const mr = W * 0.05;
    const glow = c.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3.2);
    glow.addColorStop(0, 'rgb(255 240 200 / 0.28)');
    glow.addColorStop(1, 'rgb(255 240 200 / 0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, W, H);
    const moon = document.createElement('canvas');
    moon.width = moon.height = Math.ceil(mr * 2 + 4);
    const m = moon.getContext('2d')!;
    m.fillStyle = '#fff1c4';
    m.beginPath();
    m.arc(mr + 2, mr + 2, mr, 0, Math.PI * 2);
    m.fill();
    m.globalCompositeOperation = 'destination-out';
    m.beginPath();
    m.arc(mr + 2 + mr * 0.45, mr + 2 - mr * 0.2, mr * 0.88, 0, Math.PI * 2);
    m.fill();
    c.drawImage(moon, mx - mr - 2, my - mr - 2);
  } else if (theme === 'kraft') {
    c.fillStyle = '#c9a274';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < (W * H) / 260; i++) {
      c.fillStyle = r() > 0.5 ? `rgb(120 80 40 / ${r() * 0.18})` : `rgb(255 240 210 / ${r() * 0.18})`;
      c.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
    }
    c.strokeStyle = 'rgb(110 70 35 / 0.08)';
    for (let i = 0; i < 120; i++) {
      const x = r() * W;
      const y = r() * H;
      c.lineWidth = 1 + r();
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 12);
      c.stroke();
    }
  } else if (theme === 'rojo') {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#d0333a');
    g.addColorStop(1, '#8e1220');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // papel de regalo: copitos y puntos en diagonal
    const step = W / 9;
    c.strokeStyle = 'rgb(255 255 255 / 0.16)';
    c.fillStyle = 'rgb(255 255 255 / 0.16)';
    c.lineWidth = 3;
    c.lineCap = 'round';
    for (let y = 0, row = 0; y < H + step; y += step, row++) {
      for (let x = row % 2 ? step / 2 : 0; x < W + step; x += step) {
        const s = step * 0.16;
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI) / 3;
          c.beginPath();
          c.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s);
          c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
          c.stroke();
        }
        c.beginPath();
        c.arc(x + step / 2, y + step / 4, 4, 0, Math.PI * 2);
        c.fill();
      }
    }
  } else if (theme === 'bosque') {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#12301f');
    g.addColorStop(1, '#2f6b4a');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < (W * H) / 9000; i++) {
      c.fillStyle = `rgb(255 255 255 / ${0.2 + r() * 0.5})`;
      c.beginPath();
      c.arc(r() * W, r() * H * 0.6, 0.6 + r() * 1.4, 0, Math.PI * 2);
      c.fill();
    }
    // pinos y lomas de nieve abajo
    const base = H * 0.86;
    for (let i = 0; i < 14; i++) {
      const x = (i / 13) * W + (r() - 0.5) * 40;
      const th = H * (0.08 + r() * 0.1);
      const tw = th * 0.55;
      c.fillStyle = r() > 0.5 ? '#0f2a1b' : '#173d2a';
      c.beginPath();
      c.moveTo(x, base - th);
      c.lineTo(x - tw / 2, base);
      c.lineTo(x + tw / 2, base);
      c.fill();
    }
    c.fillStyle = '#f4f8fb';
    c.beginPath();
    c.moveTo(0, H);
    c.lineTo(0, base);
    c.quadraticCurveTo(W * 0.25, base - H * 0.04, W * 0.5, base + H * 0.01);
    c.quadraticCurveTo(W * 0.75, base + H * 0.05, W, base - H * 0.02);
    c.lineTo(W, H);
    c.fill();
  } else {
    drawThemeBackground(c, theme, W, H, r);
  }
}

function drawOverlay(c: CanvasRenderingContext2D, p: Pick<Postcard, 'frame' | 'snow'>, W: number, H: number) {
  const r = rng(W + H * 3);
  if (p.snow) {
    for (let i = 0; i < (W * H) / 7000; i++) {
      const rad = W * (0.002 + r() * 0.005);
      c.fillStyle = `rgb(255 255 255 / ${0.45 + r() * 0.5})`;
      c.beginPath();
      c.arc(r() * W, r() * H, rad, 0, Math.PI * 2);
      c.fill();
    }
  }
  if (p.frame === 'dorado') {
    const a = W * 0.028;
    c.strokeStyle = '#e3b84f';
    c.lineWidth = W * 0.009;
    c.strokeRect(a, a, W - 2 * a, H - 2 * a);
    c.lineWidth = W * 0.003;
    const b = W * 0.046;
    c.strokeRect(b, b, W - 2 * b, H - 2 * b);
    for (const [x, y] of [[a, a], [W - a, a], [a, H - a], [W - a, H - a]] as const) {
      c.fillStyle = '#e3b84f';
      c.beginPath();
      c.arc(x, y, W * 0.022, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#c42630';
      c.beginPath();
      c.arc(x, y, W * 0.011, 0, Math.PI * 2);
      c.fill();
    }
  } else if (p.frame === 'luces') {
    const inset = W * 0.03;
    const per = 2 * (W + H - 4 * inset);
    const n = Math.round(per / (W * 0.07));
    const colors = ['#ff4d4d', '#ffd34d', '#4dd68a', '#5ab8ff', '#ff8ad8'];
    const at = (t: number): [number, number, number] => {
      // recorre el borde: arriba, derecha, abajo, izquierda (con el ángulo hacia afuera)
      const w = W - 2 * inset;
      const h = H - 2 * inset;
      let d = t * per;
      if (d < w) return [inset + d, inset, -Math.PI / 2];
      d -= w;
      if (d < h) return [W - inset, inset + d, 0];
      d -= h;
      if (d < w) return [W - inset - d, H - inset, Math.PI / 2];
      d -= w;
      return [inset, H - inset - d, Math.PI];
    };
    c.strokeStyle = '#1d3b26';
    c.lineWidth = W * 0.004;
    c.beginPath();
    for (let i = 0; i <= n * 4; i++) {
      const [x, y, ang] = at(i / (n * 4));
      const wob = Math.sin((i / 4) * Math.PI) * W * 0.008;
      const px = x - Math.cos(ang) * wob;
      const py = y - Math.sin(ang) * wob;
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.closePath();
    c.stroke();
    for (let i = 0; i < n; i++) {
      const [x, y, ang] = at((i + 0.5) / n);
      const col = colors[i % colors.length]!;
      const bx = x + Math.cos(ang) * W * 0.006;
      const by = y + Math.sin(ang) * W * 0.006;
      const g = c.createRadialGradient(bx, by, 0, bx, by, W * 0.035);
      g.addColorStop(0, `${col}aa`);
      g.addColorStop(1, `${col}00`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(bx, by, W * 0.035, 0, Math.PI * 2);
      c.fill();
      c.save();
      c.translate(bx, by);
      c.rotate(ang - Math.PI / 2);
      c.fillStyle = '#3b3b3b';
      c.fillRect(-W * 0.006, -W * 0.012, W * 0.012, W * 0.01);
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(0, W * 0.01, W * 0.009, W * 0.014, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgb(255 255 255 / 0.6)';
      c.beginPath();
      c.ellipse(-W * 0.003, W * 0.006, W * 0.0025, W * 0.005, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  } else {
    drawFrame(c, p.frame, W, H, r);
  }
}

// ---------- carta ----------

function letterBox(p: Postcard, content: LetterContent, c: CanvasRenderingContext2D, W: number, H: number) {
  const s = p.letter.scale;
  const maxW = W * 0.68 * s;
  const maxH = H * (p.format === 'historia' ? 0.6 : 0.62) * s;
  const cx = p.letter.x * W;
  const cy = p.letter.y * H;
  if (content.kind === 'foto') {
    const pad = W * 0.022 * s;
    const iw = content.image.width;
    const ih = content.image.height;
    let w = maxW - 2 * pad;
    let h = (w * ih) / iw;
    if (h > maxH - 2 * pad) {
      h = maxH - 2 * pad;
      w = (h * iw) / ih;
    }
    return { box: { cx, cy, w: w + 2 * pad, h: h + 2 * pad, rot: p.letter.rot }, pad, lines: [] as string[], font: 0, greet: false, head: 0 };
  }
  // carta escrita: papel con renglones, la letra se achica hasta caber
  const pad = W * 0.05 * s;
  const w = maxW;
  let font = W * 0.044 * s;
  // si la carta ya saluda, no se repite el encabezado
  const greet = !/^\s*(querido|querida|hola|estimado)/i.test(content.text);
  const head = (f: number) => (greet ? f * 2.4 : f * 1.2);
  let lines: string[] = [];
  for (let k = 0; k < 8; k++) {
    c.font = `500 ${font}px Caveat, "Comic Sans MS", cursive`;
    lines = wrapText((t) => c.measureText(t).width, content.text, w - 2 * pad);
    const need = head(font) + lines.length * font * 1.25 + 2 * pad;
    if (need <= maxH || font < W * 0.024) break;
    font *= 0.9;
  }
  const fit = Math.max(1, Math.floor((maxH - 2 * pad - head(font)) / (font * 1.25)));
  if (lines.length > fit) lines = [...lines.slice(0, fit - 1), `${lines[fit - 1] ?? ''}…`];
  const h = Math.min(maxH, head(font) + lines.length * font * 1.25 + 2 * pad);
  return { box: { cx, cy, w, h, rot: p.letter.rot }, pad, lines, font, greet, head: head(font) };
}

function drawLetter(c: CanvasRenderingContext2D, p: Postcard, content: LetterContent, W: number, H: number): Box {
  const { box, pad, lines, font, greet, head } = letterBox(p, content, c, W, H);
  c.save();
  c.translate(box.cx, box.cy);
  c.rotate(box.rot);
  c.shadowColor = 'rgb(0 0 0 / 0.38)';
  c.shadowBlur = W * 0.03;
  c.shadowOffsetY = W * 0.012;
  c.fillStyle = content.kind === 'foto' ? '#fffdf7' : '#fff9ec';
  c.fillRect(-box.w / 2, -box.h / 2, box.w, box.h);
  c.shadowColor = 'transparent';
  const left = -box.w / 2;
  const top = -box.h / 2;
  if (content.kind === 'foto') {
    c.drawImage(content.image, left + pad, top + pad, box.w - 2 * pad, box.h - 2 * pad);
  } else {
    // renglones y margen rojo
    const lh = font * 1.25;
    const y0 = top + pad + head;
    c.strokeStyle = 'rgb(90 140 200 / 0.35)';
    c.lineWidth = Math.max(1, W * 0.0015);
    for (let y = y0 + lh * 0.25; y < box.h / 2 - pad / 2; y += lh) {
      c.beginPath();
      c.moveTo(left + pad * 0.4, y);
      c.lineTo(-left - pad * 0.4, y);
      c.stroke();
    }
    c.strokeStyle = 'rgb(210 60 60 / 0.45)';
    c.beginPath();
    c.moveTo(left + pad * 0.75, top);
    c.lineTo(left + pad * 0.75, -top);
    c.stroke();
    c.textBaseline = 'alphabetic';
    if (greet) {
      c.fillStyle = '#b8352b';
      c.font = `700 ${font * 1.1}px Caveat, "Comic Sans MS", cursive`;
      c.fillText('Querido Viejito Pascuero:', left + pad, top + pad + font * 1.1);
    }
    c.fillStyle = '#1f2f6b';
    c.font = `500 ${font}px Caveat, "Comic Sans MS", cursive`;
    lines.forEach((ln, i) => c.fillText(ln, left + pad, y0 + i * lh));
  }
  // cinta adhesiva en dos esquinas
  const tw = box.w * 0.22;
  const th = W * 0.035 * p.letter.scale;
  c.fillStyle = 'rgb(255 236 170 / 0.75)';
  for (const [x, y, a] of [[left + tw * 0.25, top, -0.6], [-left - tw * 0.25, -top, -0.6]] as const) {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.fillRect(-tw / 2, -th / 2, tw, th);
    c.restore();
  }
  c.restore();
  return box;
}

// ---------- textos ----------

function drawTexts(c: CanvasRenderingContext2D, p: Postcard, W: number, H: number, link?: string) {
  const t = THEMES[p.theme];
  const style = p.style ?? 'tradicional';
  const fonts = FONTS[style];
  const look = { color: t.title, halo: t.halo, darkHalo: t.halo === DARK };
  const r = rng(p.title.length * 31 + p.signature.length + W);
  c.save();
  const tall = p.format === 'historia';
  if (p.title.trim()) {
    let size = W * 0.078 * fonts.titleK;
    c.font = fonts.title(size);
    let lines = wrapText((s) => c.measureText(s).width, p.title.trim(), W * 0.8);
    if (lines.length > 2) {
      size *= 0.8;
      c.font = fonts.title(size);
      lines = wrapText((s) => c.measureText(s).width, p.title.trim(), W * 0.8).slice(0, 3);
    }
    const y0 = H * (tall ? 0.1 : 0.115) - ((lines.length - 1) * size) / 2;
    lines.forEach((ln, i) => drawStyledText(c, style, 'title', ln, W / 2, y0 + i * size * 1.04, size, look, r));
  }
  if (p.signature.trim()) {
    const size = W * 0.06 * fonts.signK;
    c.font = fonts.sign(size);
    drawStyledText(c, style, 'sign', p.signature.trim().slice(0, 60), W / 2, H * (tall ? 0.885 : 0.895), size, { ...look, color: t.sign }, r);
  }
  drawFooter(c, W, H, link);
  c.restore();
}

/** Sello al pie con la dirección de la app, para que quien vea la postal escriba la suya. */
function drawFooter(c: CanvasRenderingContext2D, W: number, H: number, link?: string) {
  const text = link ? `Escribe tu carta en ${link}` : 'Buzón del Viejito Pascuero';
  c.save();
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `800 ${W * 0.021}px Nunito, system-ui, sans-serif`;
  const tw = Math.min(W * 0.86, c.measureText(text).width);
  const ph = W * 0.04;
  const pw = tw + ph * 1.4;
  const y = H - W * 0.052;
  c.fillStyle = 'rgb(255 253 247 / 0.9)';
  c.shadowColor = 'rgb(0 0 0 / 0.25)';
  c.shadowBlur = W * 0.008;
  c.beginPath();
  c.roundRect(W / 2 - pw / 2, y - ph / 2, pw, ph, ph / 2);
  c.fill();
  c.shadowColor = 'transparent';
  c.fillStyle = '#a8121f';
  c.fillText(text, W / 2, y, W * 0.86);
  c.restore();
}

// ---------- todo junto ----------

export interface RenderAssets {
  stickers: Record<StickerId, CanvasImageSource>;
  letter: LetterContent;
  /** dirección de la app, escrita al pie para que otros la usen */
  link?: string;
}

/** Dibuja la postal y devuelve dónde quedó la carta (para arrastrarla). */
export function renderPostcard(c: CanvasRenderingContext2D, p: Postcard, a: RenderAssets, sel: Selection = null): Box {
  const { w: W, h: H } = FORMATS[p.format];
  c.clearRect(0, 0, W, H);
  const style = p.style ?? 'tradicional';
  c.drawImage(
    layer(`bg|${style}|${p.theme}|${W}x${H}`, W, H, (x) => {
      drawBackground(x, p.theme, W, H);
      styleBackground(x.canvas, style, rng(W * 7 + H));
    }),
    0,
    0,
  );
  const letter = drawLetter(c, p, a.letter, W, H);
  c.drawImage(
    layer(`ov|${style}|${p.frame}|${p.snow}|${W}x${H}`, W, H, (x) => {
      // el estilo se aplica al borde; la nieve va después, liviana, para no ensuciar la carta
      drawOverlay(x, { frame: p.frame, snow: false }, W, H);
      styleOverlay(x.canvas, style, rng(W * 3 + H * 5));
      drawOverlay(x, { frame: 'ninguno', snow: p.snow }, W, H);
    }),
    0,
    0,
  );

  for (const st of p.stickers) {
    const b = stickerBox(st, W, H);
    c.save();
    c.translate(b.cx, b.cy);
    c.rotate(b.rot);
    const sh = stickerShadow(style, W);
    c.shadowColor = sh.color;
    c.shadowBlur = sh.blur;
    c.shadowOffsetY = sh.y;
    // el sticker estilizado trae margen para su contorno: se agranda para que el dibujo mida lo mismo
    const { image, pad } = styledSticker(a.stickers[st.sticker], st.sticker, style, rng(st.sticker.length * 101));
    const k = 1 / (1 - 2 * pad);
    c.drawImage(image, (-b.w / 2) * k, (-b.h / 2) * k, b.w * k, b.h * k);
    c.restore();
  }
  // los textos van al final: encima del borde, la nieve y los stickers, siempre legibles
  drawTexts(c, p, W, H, a.link);

  const selBox = sel?.type === 'carta' ? letter : sel?.type === 'sticker' ? p.stickers.find((s) => s.id === sel.id) : null;
  if (selBox) {
    const b = 'cx' in selBox ? selBox : stickerBox(selBox, W, H);
    c.save();
    c.translate(b.cx, b.cy);
    c.rotate(b.rot);
    c.strokeStyle = '#ffd34d';
    c.lineWidth = W * 0.004;
    c.setLineDash([W * 0.014, W * 0.01]);
    c.strokeRect(-b.w / 2 - 6, -b.h / 2 - 6, b.w + 12, b.h + 12);
    c.setLineDash([]);
    c.fillStyle = '#ffd34d';
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      c.beginPath();
      c.arc((x * (b.w + 12)) / 2, (y * (b.h + 12)) / 2, W * 0.009, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
  return letter;
}

/** Texto de la carta escrita para la postal (ya viene con los datos sensibles tapados). */
export function letterText(l: { texto_normalizado: string; texto_original: string; mensaje: string; gifts: { nombre: string }[] }): string {
  const t = (l.texto_normalizado || l.texto_original || l.mensaje).trim();
  if (t) return t;
  if (l.gifts.length) return `Mis deseos:\n${l.gifts.map((g) => `- ${g.nombre}`).join('\n')}`;
  return '';
}
