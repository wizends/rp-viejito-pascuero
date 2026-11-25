/**
 * Estilos gráficos de la postal. Cada estilo transforma TODO lo que se dibuja:
 * el fondo, el borde (y la nieve), los stickers y la tipografía del título y la firma.
 * Se logra con efectos de canvas sobre las mismas ilustraciones, así cualquier fondo,
 * borde o sticker nuevo hereda los estilos sin dibujarlo cinco veces.
 */

export const STYLES = {
  tradicional: { label: 'Tradicional', hint: 'Libro de cuentos navideño' },
  anime: { label: 'Anime', hint: 'Colores vivos, contornos y brillos' },
  acuarela: { label: 'Acuarela', hint: 'Pintado a mano sobre papel' },
  realista: { label: 'Realista', hint: 'Luces, sombras y relieve' },
  crayon: { label: 'Crayones', hint: 'Dibujado por un niño' },
} as const;
export type Style = keyof typeof STYLES;
export const STYLE_IDS = Object.keys(STYLES) as Style[];

type Rand = () => number;
type Ctx = CanvasRenderingContext2D;

// ---------- tipografías ----------

interface Fonts {
  title: (px: number) => string;
  sign: (px: number) => string;
  /** escala del título y de la firma respecto del tamaño base */
  titleK: number;
  signK: number;
}

export const FONTS: Record<Style, Fonts> = {
  tradicional: {
    title: (px) => `700 ${px}px "Mountains of Christmas", "Baloo 2", Georgia, serif`,
    sign: (px) => `700 ${px}px Caveat, "Comic Sans MS", cursive`,
    titleK: 1,
    signK: 1,
  },
  anime: {
    title: (px) => `700 ${px}px Fredoka, "Baloo 2", system-ui, sans-serif`,
    sign: (px) => `700 ${px}px Fredoka, "Baloo 2", system-ui, sans-serif`,
    titleK: 0.92,
    signK: 0.8,
  },
  acuarela: {
    title: (px) => `700 ${px}px "Dancing Script", Caveat, cursive`,
    sign: (px) => `700 ${px}px "Dancing Script", Caveat, cursive`,
    titleK: 1.08,
    signK: 1,
  },
  realista: {
    title: (px) => `700 ${px}px "Playfair Display", Georgia, serif`,
    sign: (px) => `italic 700 ${px}px "Playfair Display", Georgia, serif`,
    titleK: 0.86,
    signK: 0.78,
  },
  crayon: {
    title: (px) => `400 ${px}px "Gochi Hand", "Comic Sans MS", cursive`,
    sign: (px) => `400 ${px}px "Gochi Hand", "Comic Sans MS", cursive`,
    titleK: 1.04,
    signK: 0.95,
  },
};

export const STYLE_FONT_FACES = [
  '700 60px "Mountains of Christmas"',
  '700 40px Caveat',
  '500 40px Caveat',
  '800 20px Nunito',
  '700 60px Fredoka',
  '700 60px "Dancing Script"',
  '700 60px "Playfair Display"',
  'italic 700 40px "Playfair Display"',
  '400 60px "Gochi Hand"',
];

// ---------- utilidades ----------

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
const ctxOf = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;
const hasFilter = (c: Ctx) => 'filter' in c;

function copyOf(src: HTMLCanvasElement) {
  const c = canvas(src.width, src.height);
  ctxOf(c).drawImage(src, 0, 0);
  return c;
}

/** Reduce cada canal a `levels` tonos (aspecto de dibujo animado o de crayón). */
export function posterizeData(d: Uint8ClampedArray, levels: number) {
  const step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round(d[i]! / step) * step;
    d[i + 1] = Math.round(d[i + 1]! / step) * step;
    d[i + 2] = Math.round(d[i + 2]! / step) * step;
  }
}

function posterize(c: HTMLCanvasElement, levels: number) {
  const x = ctxOf(c);
  const img = x.getImageData(0, 0, c.width, c.height);
  posterizeData(img.data, levels);
  x.putImageData(img, 0, 0);
}

/** Grano parejo (película o papel). */
function grain(c: HTMLCanvasElement, amp: number, r: Rand) {
  const x = ctxOf(c);
  const img = x.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const n = (r() - 0.5) * amp;
    d[i] = d[i]! + n;
    d[i + 1] = d[i + 1]! + n;
    d[i + 2] = d[i + 2]! + n;
  }
  x.putImageData(img, 0, 0);
}

/** Redibuja el lienzo a través de un filtro CSS (si el navegador lo permite). */
function refilter(c: HTMLCanvasElement, filter: string, overscan = 0) {
  const x = ctxOf(c);
  if (!hasFilter(x)) return;
  const src = copyOf(c);
  x.save();
  x.clearRect(0, 0, c.width, c.height);
  x.filter = filter;
  x.drawImage(src, -overscan, -overscan, c.width + overscan * 2, c.height + overscan * 2);
  x.restore();
}

/** Contorno de color alrededor de todo lo que no es transparente. */
function outline(c: HTMLCanvasElement, color: string, width: number) {
  const src = copyOf(c);
  const sil = copyOf(c);
  const s = ctxOf(sil);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = color;
  s.fillRect(0, 0, sil.width, sil.height);
  const x = ctxOf(c);
  x.clearRect(0, 0, c.width, c.height);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    x.drawImage(sil, Math.cos(a) * width, Math.sin(a) * width);
  }
  x.drawImage(src, 0, 0);
}

/** Bordes del pigmento más oscuros, como cuando la acuarela se seca. */
function pigmentEdges(c: HTMLCanvasElement, amount: number, offset: number) {
  const src = copyOf(c);
  const x = ctxOf(c);
  x.save();
  x.globalCompositeOperation = 'source-atop';
  x.globalAlpha = amount;
  for (const [dx, dy] of [[offset, offset], [-offset, offset * 0.5]] as const) {
    x.globalCompositeOperation = 'multiply';
    x.drawImage(src, dx, dy);
  }
  x.restore();
  // lo que se salió del dibujo original no cuenta
  x.save();
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(src, 0, 0);
  x.restore();
}

/** Huecos del crayón: el papel se asoma entre el color. */
function crayonTooth(c: HTMLCanvasElement, r: Rand, density: number, unit: number) {
  const x = ctxOf(c);
  x.save();
  x.globalCompositeOperation = 'destination-out';
  x.lineCap = 'round';
  const n = (c.width * c.height * density) / (unit * unit);
  for (let i = 0; i < n; i++) {
    const px = r() * c.width;
    const py = r() * c.height;
    const len = unit * (0.5 + r() * 2);
    x.globalAlpha = 0.25 + r() * 0.5;
    x.lineWidth = unit * (0.15 + r() * 0.35);
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + len * 0.7, py - len * 0.7);
    x.stroke();
  }
  x.restore();
}

/** Volumen: luz arriba a la izquierda y sombra abajo a la derecha. */
function shade(c: HTMLCanvasElement, light: number, dark: number) {
  const x = ctxOf(c);
  const w = c.width;
  const h = c.height;
  x.save();
  x.globalCompositeOperation = 'source-atop';
  const g = x.createRadialGradient(w * 0.32, h * 0.28, 0, w * 0.32, h * 0.28, Math.max(w, h) * 0.75);
  g.addColorStop(0, `rgb(255 255 255 / ${light})`);
  g.addColorStop(0.45, 'rgb(255 255 255 / 0)');
  g.addColorStop(1, `rgb(20 10 5 / ${dark})`);
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  x.restore();
}

function sparkle(x: Ctx, px: number, py: number, s: number) {
  x.beginPath();
  x.moveTo(px, py - s);
  x.quadraticCurveTo(px + s * 0.12, py - s * 0.12, px + s, py);
  x.quadraticCurveTo(px + s * 0.12, py + s * 0.12, px, py + s);
  x.quadraticCurveTo(px - s * 0.12, py + s * 0.12, px - s, py);
  x.quadraticCurveTo(px - s * 0.12, py - s * 0.12, px, py - s);
  x.fill();
}

// ---------- fondos ----------

/** Transforma el fondo ya dibujado según el estilo. */
export function styleBackground(c: HTMLCanvasElement, style: Style, r: Rand) {
  const W = c.width;
  const H = c.height;
  const x = ctxOf(c);
  switch (style) {
    case 'anime': {
      refilter(c, 'saturate(1.35) contrast(1.06)');
      posterize(c, 9);
      // rayos de luz desde arriba
      x.save();
      x.globalCompositeOperation = 'screen';
      for (let i = 0; i < 6; i++) {
        const a = -0.35 + i * 0.16 + (r() - 0.5) * 0.08;
        x.save();
        x.translate(W * 0.15, -H * 0.05);
        x.rotate(a + Math.PI / 4);
        const g = x.createLinearGradient(0, 0, Math.hypot(W, H), 0);
        g.addColorStop(0, 'rgb(255 255 255 / 0.22)');
        g.addColorStop(1, 'rgb(255 255 255 / 0)');
        x.fillStyle = g;
        x.fillRect(0, -W * 0.02, Math.hypot(W, H), W * (0.03 + r() * 0.03));
        x.restore();
      }
      x.fillStyle = 'rgb(255 255 255 / 0.85)';
      for (let i = 0; i < 14; i++) sparkle(x, r() * W, r() * H, W * (0.006 + r() * 0.012));
      x.restore();
      break;
    }
    case 'acuarela': {
      refilter(c, `blur(${Math.round(W * 0.006)}px) saturate(0.85) brightness(1.06)`, W * 0.02);
      const ref = ctxOf(copyOf(c));
      x.save();
      // manchas de pigmento con el color de cada zona
      x.globalCompositeOperation = 'multiply';
      for (let i = 0; i < 46; i++) {
        const px = r() * W;
        const py = r() * H;
        const [cr, cg, cb] = ref.getImageData(Math.min(W - 1, px | 0), Math.min(H - 1, py | 0), 1, 1).data;
        const rad = W * (0.06 + r() * 0.16);
        const g = x.createRadialGradient(px, py, rad * 0.2, px, py, rad);
        g.addColorStop(0, `rgb(${cr} ${cg} ${cb} / 0.22)`);
        g.addColorStop(0.85, `rgb(${cr} ${cg} ${cb} / 0.12)`);
        g.addColorStop(1, `rgb(${cr} ${cg} ${cb} / 0)`);
        x.fillStyle = g;
        x.beginPath();
        x.arc(px, py, rad, 0, Math.PI * 2);
        x.fill();
      }
      // papel de acuarela: fibras y granulado
      x.globalCompositeOperation = 'source-over';
      for (let i = 0; i < (W * H) / 220; i++) {
        x.fillStyle = r() > 0.5 ? `rgb(255 255 255 / ${r() * 0.16})` : `rgb(60 40 20 / ${r() * 0.07})`;
        x.fillRect(r() * W, r() * H, 1 + r() * 2.5, 1 + r() * 2.5);
      }
      const v = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      v.addColorStop(0, 'rgb(255 250 240 / 0)');
      v.addColorStop(1, 'rgb(255 250 240 / 0.35)');
      x.fillStyle = v;
      x.fillRect(0, 0, W, H);
      x.restore();
      break;
    }
    case 'realista': {
      refilter(c, `blur(${Math.max(1, Math.round(W * 0.0025))}px) saturate(1.1)`, W * 0.01);
      x.save();
      // luces desenfocadas (bokeh)
      x.globalCompositeOperation = 'screen';
      for (let i = 0; i < 22; i++) {
        const px = r() * W;
        const py = r() * H;
        const rad = W * (0.015 + r() * 0.045);
        const col = ['255 214 140', '255 180 120', '255 245 220', '170 210 255'][Math.floor(r() * 4)]!;
        const g = x.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, `rgb(${col} / 0.38)`);
        g.addColorStop(0.75, `rgb(${col} / 0.25)`);
        g.addColorStop(1, `rgb(${col} / 0)`);
        x.fillStyle = g;
        x.beginPath();
        x.arc(px, py, rad, 0, Math.PI * 2);
        x.fill();
      }
      x.globalCompositeOperation = 'source-over';
      const v = x.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      v.addColorStop(0, 'rgb(0 0 0 / 0)');
      v.addColorStop(1, 'rgb(10 5 0 / 0.42)');
      x.fillStyle = v;
      x.fillRect(0, 0, W, H);
      x.restore();
      grain(c, 12, r);
      break;
    }
    case 'crayon': {
      posterize(c, 12);
      const ref = ctxOf(copyOf(c)).getImageData(0, 0, W, H).data;
      x.save();
      x.lineCap = 'round';
      // trazos de crayón con el color de cada zona
      for (let i = 0; i < (W * H) / 260; i++) {
        const px = r() * W;
        const py = r() * H;
        const k = ((py | 0) * W + (px | 0)) * 4;
        const lift = r() > 0.5 ? 28 : -28;
        x.strokeStyle = `rgb(${ref[k]! + lift} ${ref[k + 1]! + lift} ${ref[k + 2]! + lift} / 0.35)`;
        x.lineWidth = W * (0.002 + r() * 0.003);
        const len = W * (0.01 + r() * 0.02);
        x.beginPath();
        x.moveTo(px, py);
        x.lineTo(px + len * 0.75, py - len * 0.65);
        x.stroke();
      }
      // diente del papel
      for (let i = 0; i < (W * H) / 180; i++) {
        x.fillStyle = `rgb(255 252 240 / ${0.08 + r() * 0.22})`;
        x.fillRect(r() * W, r() * H, 1.5, 1.5);
      }
      x.restore();
      break;
    }
    default:
      break;
  }
}

// ---------- borde y nieve (capa transparente) ----------

export function styleOverlay(c: HTMLCanvasElement, style: Style, r: Rand) {
  const W = c.width;
  switch (style) {
    case 'anime':
      refilter(c, 'saturate(1.3)');
      outline(c, '#2b1d3a', Math.max(2, W * 0.0028));
      break;
    case 'acuarela':
      refilter(c, `blur(${Math.max(1, W * 0.0016)}px) saturate(0.9)`);
      pigmentEdges(c, 0.35, Math.max(1, W * 0.0015));
      crayonTooth(c, r, 0.12, W * 0.006);
      break;
    case 'realista': {
      shade(c, 0.35, 0.3);
      const src = copyOf(c);
      const x = ctxOf(c);
      x.clearRect(0, 0, c.width, c.height);
      x.save();
      x.shadowColor = 'rgb(0 0 0 / 0.45)';
      x.shadowBlur = W * 0.012;
      x.shadowOffsetY = W * 0.005;
      x.drawImage(src, 0, 0);
      x.restore();
      break;
    }
    case 'crayon':
      posterize(c, 6);
      crayonTooth(c, r, 0.55, W * 0.005);
      break;
    default:
      break;
  }
}

// ---------- stickers ----------

/** Lado del sticker ya estilizado (con margen para contornos y sombras). */
const STICKER_PX = 384;
const PAD = 0.08;
const stickerCache = new Map<string, HTMLCanvasElement>();

/** El sticker con el estilo aplicado (en caché). El margen queda incluido en la imagen. */
export function styledSticker(img: CanvasImageSource, id: string, style: Style, r: Rand): { image: CanvasImageSource; pad: number } {
  if (style === 'tradicional') return { image: img, pad: 0 };
  const key = `${style}|${id}`;
  let c = stickerCache.get(key);
  if (!c) {
    const S = STICKER_PX;
    const p = S * PAD;
    c = canvas(S, S);
    ctxOf(c).drawImage(img, p, p, S - 2 * p, S - 2 * p);
    switch (style) {
      case 'anime':
        refilter(c, 'saturate(1.35) contrast(1.05)');
        posterize(c, 6);
        outline(c, '#2b1d3a', S * 0.018);
        break;
      case 'acuarela':
        refilter(c, `blur(${S * 0.006}px) saturate(0.85) brightness(1.04)`);
        pigmentEdges(c, 0.4, S * 0.006);
        crayonTooth(c, r, 0.18, S * 0.02);
        ctxOf(c).globalAlpha = 1;
        break;
      case 'realista':
        shade(c, 0.5, 0.42);
        refilter(c, `blur(${S * 0.0016}px) contrast(1.08)`);
        break;
      case 'crayon':
        posterize(c, 5);
        crayonTooth(c, r, 0.7, S * 0.022);
        break;
    }
    stickerCache.set(key, c);
  }
  return { image: c, pad: PAD };
}

/** Sombra del sticker al pegarlo, según el estilo. */
export function stickerShadow(style: Style, W: number): { color: string; blur: number; y: number } {
  switch (style) {
    case 'anime':
      return { color: 'rgb(43 29 58 / 0.35)', blur: 0, y: W * 0.006 };
    case 'acuarela':
    case 'crayon':
      return { color: 'transparent', blur: 0, y: 0 };
    case 'realista':
      return { color: 'rgb(0 0 0 / 0.5)', blur: W * 0.02, y: W * 0.012 };
    default:
      return { color: 'rgb(0 0 0 / 0.3)', blur: W * 0.01, y: W * 0.005 };
  }
}

// ---------- textos ----------

export interface TextLook {
  color: string;
  halo: string;
  /** halo oscuro (fondos oscuros) o claro */
  darkHalo: boolean;
}

/**
 * Escribe una línea con el acabado del estilo. `size` es el tamaño de la fuente ya
 * puesta en `c.font`; `kind` distingue el título (más adornado) de la firma.
 */
export function drawStyledText(c: Ctx, style: Style, kind: 'title' | 'sign', s: string, x: number, y: number, size: number, look: TextLook, r: Rand) {
  c.save();
  c.lineJoin = 'round';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  switch (style) {
    case 'anime': {
      // contorno oscuro grueso con sombra, contorno blanco y relleno con brillo
      const ink = '#2b1d3a';
      c.strokeStyle = ink;
      c.lineWidth = size * 0.26;
      c.strokeText(s, x + size * 0.04, y + size * 0.07);
      c.strokeText(s, x, y);
      c.strokeStyle = '#ffffff';
      c.lineWidth = size * 0.13;
      c.strokeText(s, x, y);
      const g = c.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, look.darkHalo ? look.color : look.color);
      g.addColorStop(1, look.color);
      c.fillStyle = kind === 'title' ? g : look.color;
      c.fillText(s, x, y);
      break;
    }
    case 'acuarela': {
      // pintura que se corre: capas transparentes desplazadas y un halo suave
      c.shadowColor = look.halo;
      c.shadowBlur = size * 0.3;
      c.fillStyle = look.color;
      c.globalAlpha = 0.28;
      for (let i = 0; i < 3; i++) c.fillText(s, x + (r() - 0.5) * size * 0.06, y + (r() - 0.5) * size * 0.06);
      c.shadowColor = 'transparent';
      c.globalAlpha = 0.85;
      c.fillText(s, x, y);
      break;
    }
    case 'realista': {
      // letras doradas con relieve (título) o tinta con sombra (firma)
      c.shadowColor = 'rgb(0 0 0 / 0.55)';
      c.shadowBlur = size * 0.12;
      c.shadowOffsetY = size * 0.05;
      if (kind === 'title') {
        const g = c.createLinearGradient(0, y - size * 0.55, 0, y + size * 0.55);
        g.addColorStop(0, '#8a6420');
        g.addColorStop(0.3, '#f9e597');
        g.addColorStop(0.55, '#b8862b');
        g.addColorStop(0.75, '#fff1b0');
        g.addColorStop(1, '#7a5418');
        c.fillStyle = g;
      } else {
        c.fillStyle = look.color;
      }
      c.fillText(s, x, y);
      c.shadowColor = 'transparent';
      c.strokeStyle = kind === 'title' ? 'rgb(70 45 10 / 0.6)' : 'transparent';
      c.lineWidth = size * 0.018;
      c.strokeText(s, x, y);
      break;
    }
    case 'crayon': {
      // trazo de cera: varias pasadas un poco corridas y un contorno claro
      c.strokeStyle = look.halo;
      c.lineWidth = size * 0.12;
      c.globalAlpha = 0.8;
      c.strokeText(s, x, y);
      c.fillStyle = look.color;
      for (let i = 0; i < 4; i++) {
        c.globalAlpha = 0.45;
        c.fillText(s, x + (r() - 0.5) * size * 0.05, y + (r() - 0.5) * size * 0.05);
      }
      break;
    }
    default: {
      c.shadowColor = look.halo;
      c.shadowBlur = size * 0.15;
      c.shadowOffsetY = look.darkHalo ? size * 0.05 : 0;
      c.strokeStyle = look.halo;
      c.lineWidth = kind === 'title' ? size * 0.12 : size * 0.13;
      c.strokeText(s, x, y);
      c.fillStyle = look.color;
      c.fillText(s, x, y);
    }
  }
  c.restore();
}
