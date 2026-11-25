import { SANTA_FACE, SANTA_H, SANTA_SVG, SANTA_W } from './santa';

/** Lado mayor de la selfie final. */
export const SELFIE_MAX_SIDE = 1600;

export type Side = 'izq' | 'der';

export interface PhotoStats {
  /** color medio (0..255) */
  r: number;
  g: number;
  b: number;
  /** luminancia media (0..1) */
  luma: number;
  /** cuánto "pasa" en cada mitad (bordes + luces): el árbol suele estar donde hay más */
  busyLeft: number;
  busyRight: number;
}

/** El Viejito se pone en la mitad más tranquila, para no tapar el árbol. */
export function pickSide(s: Pick<PhotoStats, 'busyLeft' | 'busyRight'>): Side {
  return s.busyLeft < s.busyRight * 0.92 ? 'izq' : 'der';
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Tamaño y lugar del Viejito: grande, en primer plano y cortado abajo, como en una selfie. */
export function santaBox(W: number, H: number, side: Side): Box {
  let h = H * 0.84;
  let w = (h * SANTA_W) / SANTA_H;
  const maxW = W * (W >= H ? 0.5 : 0.66);
  if (w > maxW) {
    w = maxW;
    h = (w * SANTA_H) / SANTA_W;
  }
  const y = H - h * 0.97; // el busto se sale un poco por abajo
  const x = side === 'der' ? W - w * 0.93 : -w * 0.07; // y el brazo, por el costado
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

/** Escala la foto para que su lado mayor no pase de max. */
export function fitSize(w: number, h: number, max = SELFIE_MAX_SIDE) {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

/** Pseudoaleatorio con semilla: la misma foto da siempre la misma selfie. */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mide color, luz y en qué lado está el árbol, sobre una miniatura. */
export function measure(data: Uint8ClampedArray, w: number, h: number): PhotoStats {
  let r = 0, g = 0, b = 0, luma = 0, busyLeft = 0, busyRight = 0;
  const L = (i: number) => (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      const l = L(i);
      luma += l;
      // bordes (detalle) + luces navideñas (brillo y color fuerte)
      const dx = x + 1 < w ? Math.abs(l - L(i + 4)) : 0;
      const dy = y + 1 < h ? Math.abs(l - L(i + w * 4)) : 0;
      const max = Math.max(data[i]!, data[i + 1]!, data[i + 2]!);
      const min = Math.min(data[i]!, data[i + 1]!, data[i + 2]!);
      const busy = dx + dy + (l > 0.75 ? 0.25 : 0) + ((max - min) / 255) * 0.15;
      if (x < w / 2) busyLeft += busy;
      else busyRight += busy;
    }
  }
  const n = w * h;
  return { r: r / n, g: g / n, b: b / n, luma: luma / n, busyLeft, busyRight };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctx2d(c: HTMLCanvasElement) {
  const x = c.getContext('2d');
  if (!x) throw new Error('Este navegador no puede dibujar la selfie.');
  return x;
}

let santaImg: Promise<HTMLImageElement> | null = null;
function loadSanta() {
  santaImg ??= new Promise((res, rej) => {
    const url = URL.createObjectURL(new Blob([SANTA_SVG], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => {
      santaImg = null;
      rej(new Error('No se pudo dibujar al Viejito.'));
    };
    img.src = url;
  });
  return santaImg;
}

async function loadPhoto(photo: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if ('createImageBitmap' in window) return createImageBitmap(photo);
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('No se pudo abrir la foto del árbol.'));
    img.src = URL.createObjectURL(photo);
  });
}

export interface SelfieOptions {
  /** cuándo pasó el Viejito (va escrito en la foto) */
  when?: Date | null;
  timeZone?: string;
}

/**
 * "Filtro" que integra al Viejito Pascuero en la foto del árbol, como si se hubiera
 * sacado una selfie al dejar el regalo:
 *  1. fondo con un leve desenfoque (el Viejito está cerca de la cámara);
 *  2. el Viejito toma el color y la luz de la foto (tinte, exposición y luz cálida
 *     del lado del árbol) y proyecta sombra;
 *  3. flash de teléfono en la cara, polvo mágico, tono cálido, viñeta y grano parejo
 *     sobre todo, para que parezca una sola foto;
 *  4. sello con la hora y la firma.
 */
export async function composeSelfie(photo: Blob, opts: SelfieOptions = {}): Promise<Blob> {
  const [src, santa] = await Promise.all([loadPhoto(photo), loadSanta()]);
  const { w: W, h: H } = fitSize(src.width, src.height);

  // 0. medir sobre una miniatura
  const tw = 64;
  const th = Math.max(1, Math.round((tw * H) / W));
  const thumb = canvas(tw, th);
  const tctx = ctx2d(thumb);
  tctx.drawImage(src, 0, 0, tw, th);
  const stats = measure(tctx.getImageData(0, 0, tw, th).data, tw, th);
  const side = pickSide(stats);
  const toward = side === 'der' ? -1 : 1; // hacia dónde queda el árbol
  const rand = rng(Math.round(stats.r * 7 + stats.g * 131 + stats.b * 977 + W * 3 + H));

  const out = canvas(W, H);
  const c = ctx2d(out);

  // 1. fondo: la foto con un desenfoque suave de profundidad de campo
  const blur = Math.max(1, Math.round(W / 650));
  if ('filter' in c) c.filter = `blur(${blur}px)`;
  c.drawImage(src, -blur * 2, -blur * 2, W + blur * 4, H + blur * 4);
  c.filter = 'none';

  // 2. el Viejito, con la luz de la foto
  const box = santaBox(W, H, side);
  const layer = canvas(box.w, box.h);
  const l = ctx2d(layer);
  l.save();
  if (side === 'izq') {
    l.translate(box.w, 0);
    l.scale(-1, 1);
  }
  l.drawImage(santa, 0, 0, box.w, box.h);
  l.restore();
  const shape = canvas(box.w, box.h);
  ctx2d(shape).drawImage(layer, 0, 0);

  // tinte del ambiente (multiplica por el color medio) y vuelta a la silueta
  l.globalCompositeOperation = 'multiply';
  l.fillStyle = `rgb(${stats.r | 0} ${stats.g | 0} ${stats.b | 0} / 0.32)`;
  l.fillRect(0, 0, box.w, box.h);
  l.globalCompositeOperation = 'destination-in';
  l.drawImage(shape, 0, 0);

  l.globalCompositeOperation = 'source-atop';
  // exposición: en fotos de noche el Viejito también queda en penumbra
  const dark = Math.min(0.38, Math.max(0, (0.5 - stats.luma) * 0.75));
  if (dark > 0) {
    l.fillStyle = `rgb(12 10 28 / ${dark})`;
    l.fillRect(0, 0, box.w, box.h);
  }
  // luz cálida de las luces del árbol, del lado que mira al árbol
  const rimX = toward > 0 ? box.w : 0;
  const rim = l.createLinearGradient(rimX, 0, box.w / 2, 0);
  rim.addColorStop(0, 'rgb(255 196 110 / 0.42)');
  rim.addColorStop(1, 'rgb(255 196 110 / 0)');
  l.fillStyle = rim;
  l.fillRect(0, 0, box.w, box.h);
  // flash del teléfono en la cara
  const fx = box.w * SANTA_FACE.x;
  const fy = box.h * SANTA_FACE.y;
  const flash = l.createRadialGradient(fx, fy, 0, fx, fy, box.w * 0.42);
  flash.addColorStop(0, `rgb(255 250 240 / ${0.12 + dark * 0.5})`);
  flash.addColorStop(1, 'rgb(255 250 240 / 0)');
  l.fillStyle = flash;
  l.fillRect(0, 0, box.w, box.h);
  l.globalCompositeOperation = 'source-over';

  // sombra suave sobre la escena y el Viejito encima
  c.save();
  c.shadowColor = 'rgb(0 0 0 / 0.5)';
  c.shadowBlur = W / 30;
  c.shadowOffsetX = (toward * W) / 80;
  c.shadowOffsetY = H / 120;
  c.drawImage(layer, box.x, box.y);
  c.restore();

  // 3a. polvo mágico alrededor del gorro
  c.save();
  c.globalCompositeOperation = 'screen';
  const hatX = box.x + box.w * (side === 'der' ? 0.78 : 0.22);
  const hatY = box.y + box.h * 0.3;
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const d = (0.08 + rand() * 0.42) * box.w;
    const px = hatX + Math.cos(a) * d;
    const py = hatY + Math.sin(a) * d * 0.8;
    const r = (0.004 + rand() * 0.01) * W;
    const g = c.createRadialGradient(px, py, 0, px, py, r * 2.4);
    g.addColorStop(0, 'rgb(255 244 200 / 0.95)');
    g.addColorStop(0.35, 'rgb(255 214 120 / 0.55)');
    g.addColorStop(1, 'rgb(255 214 120 / 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(px, py, r * 2.4, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();

  // 3b. tono cálido de Nochebuena + viñeta
  c.save();
  c.globalCompositeOperation = 'soft-light';
  c.fillStyle = 'rgb(255 168 88 / 0.35)';
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'source-over';
  const vig = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.58);
  vig.addColorStop(0, 'rgb(20 10 5 / 0)');
  vig.addColorStop(1, 'rgb(20 10 5 / 0.45)');
  c.fillStyle = vig;
  c.fillRect(0, 0, W, H);
  c.restore();

  // 3c. grano parejo: une la foto y el dibujo
  const img = c.getImageData(0, 0, W, H);
  const px = img.data;
  const amp = 14;
  for (let i = 0; i < px.length; i += 4) {
    const n = (rand() - 0.5) * amp;
    px[i] = px[i]! + n;
    px[i + 1] = px[i + 1]! + n;
    px[i + 2] = px[i + 2]! + n;
  }
  c.putImageData(img, 0, 0);

  // 4. sello: la hora y la firma, del lado del árbol (arriba, sin tapar)
  await Promise.all(
    ['700 40px Caveat', '500 40px Caveat', '800 20px Nunito'].map((f) => document.fonts?.load(f).catch(() => undefined)),
  );
  drawStamp(c, W, H, side, opts);

  return new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo guardar la selfie.'))), 'image/jpeg', 0.9));
}

function drawStamp(c: CanvasRenderingContext2D, W: number, H: number, side: Side, opts: SelfieOptions) {
  const pad = Math.round(Math.min(W, H) * 0.04);
  const s = Math.max(W, H) / 1000;
  const right = side === 'izq'; // el sello va al lado contrario del Viejito
  c.save();
  c.textAlign = right ? 'right' : 'left';
  c.textBaseline = 'top';
  const x = right ? W - pad : pad;

  const when = opts.when
    ? new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: opts.timeZone ?? 'America/Santiago' }).format(opts.when)
    : null;

  // etiqueta de cámara: punto rojo + "¡Misión cumplida!"
  c.font = `800 ${Math.round(22 * s)}px Nunito, system-ui, sans-serif`;
  const label = '¡Misión cumplida!';
  const tw = c.measureText(label).width;
  const dot = 9 * s;
  const bw = tw + dot * 2 + 34 * s;
  const bh = 40 * s;
  const bx = right ? x - bw : x;
  c.fillStyle = 'rgb(15 20 40 / 0.55)';
  c.beginPath();
  c.roundRect(bx, pad, bw, bh, bh / 2);
  c.fill();
  c.fillStyle = '#ff4d4d';
  c.beginPath();
  c.arc(bx + 14 * s + dot, pad + bh / 2, dot, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff';
  c.textAlign = 'left';
  c.fillText(label, bx + 20 * s + dot * 2, pad + bh / 2 - 13 * s);

  // firma a mano
  c.textAlign = right ? 'right' : 'left';
  c.shadowColor = 'rgb(0 0 0 / 0.55)';
  c.shadowBlur = 8 * s;
  c.fillStyle = '#fff7e0';
  c.font = `700 ${Math.round(54 * s)}px Caveat, "Comic Sans MS", cursive`;
  c.fillText('¡Jo, jo, jo! Pasé por aquí', x, pad + bh + 12 * s);
  c.font = `500 ${Math.round(36 * s)}px Caveat, "Comic Sans MS", cursive`;
  c.fillText(when ? `— Viejito Pascuero · ${when}` : '— Viejito Pascuero', x, pad + bh + 72 * s);
  c.restore();
}
