import type { Frame, Theme } from './render';

/** Fondos y bordes extra de la postal (los clásicos viven en render.ts). */

type Ctx = CanvasRenderingContext2D;
type Rand = () => number;

// ---------- figuras ----------

export function heart(c: Ctx, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x, y + s * 0.35);
  c.bezierCurveTo(x - s * 0.55, y - s * 0.05, x - s * 0.5, y - s * 0.55, x, y - s * 0.25);
  c.bezierCurveTo(x + s * 0.5, y - s * 0.55, x + s * 0.55, y - s * 0.05, x, y + s * 0.35);
  c.closePath();
}

/** Destello de cuatro puntas. */
export function sparkle(c: Ctx, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x, y - s);
  c.quadraticCurveTo(x + s * 0.12, y - s * 0.12, x + s, y);
  c.quadraticCurveTo(x + s * 0.12, y + s * 0.12, x, y + s);
  c.quadraticCurveTo(x - s * 0.12, y + s * 0.12, x - s, y);
  c.quadraticCurveTo(x - s * 0.12, y - s * 0.12, x, y - s);
  c.closePath();
}

export function snowflake(c: Ctx, x: number, y: number, s: number) {
  c.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    const ex = x + Math.cos(a) * s;
    const ey = y + Math.sin(a) * s;
    c.moveTo(x, y);
    c.lineTo(ex, ey);
    // ramitas
    const bx = x + Math.cos(a) * s * 0.6;
    const by = y + Math.sin(a) * s * 0.6;
    for (const d of [-0.6, 0.6]) {
      c.moveTo(bx, by);
      c.lineTo(bx + Math.cos(a + d) * s * 0.3, by + Math.sin(a + d) * s * 0.3);
    }
  }
}

function gradient(c: Ctx, W: number, H: number, stops: string[], diagonal = false) {
  const g = diagonal ? c.createLinearGradient(0, 0, W, H) : c.createLinearGradient(0, 0, 0, H);
  stops.forEach((col, i) => g.addColorStop(i / (stops.length - 1), col));
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}

/** Reparte figuras por toda la postal, sin amontonarlas (rejilla con desorden). */
function scatter(W: number, H: number, cell: number, r: Rand, fn: (x: number, y: number) => void) {
  for (let y = cell / 2; y < H + cell; y += cell) {
    for (let x = cell / 2; x < W + cell; x += cell) {
      fn(x + (r() - 0.5) * cell * 0.7, y + (r() - 0.5) * cell * 0.7);
    }
  }
}

// ---------- fondos ----------

export function drawThemeBackground(c: Ctx, theme: Theme, W: number, H: number, r: Rand) {
  switch (theme) {
    case 'rosa': {
      gradient(c, W, H, ['#ffe1ec', '#ffb6d0']);
      scatter(W, H, W / 7, r, (x, y) => {
        c.fillStyle = r() > 0.4 ? 'rgb(255 255 255 / 0.45)' : 'rgb(255 92 154 / 0.25)';
        heart(c, x, y, W * (0.025 + r() * 0.025));
        c.fill();
      });
      break;
    }
    case 'lavanda': {
      gradient(c, W, H, ['#f3eaff', '#c5aef0'], true);
      scatter(W, H, W / 8, r, (x, y) => {
        c.fillStyle = r() > 0.5 ? 'rgb(255 255 255 / 0.7)' : 'rgb(255 226 122 / 0.6)';
        sparkle(c, x, y, W * (0.008 + r() * 0.016));
        c.fill();
      });
      break;
    }
    case 'hielo': {
      gradient(c, W, H, ['#f2faff', '#acd5f2']);
      c.lineCap = 'round';
      scatter(W, H, W / 7, r, (x, y) => {
        c.strokeStyle = `rgb(255 255 255 / ${0.5 + r() * 0.4})`;
        c.lineWidth = W * 0.003;
        snowflake(c, x, y, W * (0.015 + r() * 0.02));
        c.stroke();
      });
      break;
    }
    case 'dorado': {
      const g = c.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.hypot(W, H) * 0.6);
      g.addColorStop(0, '#fff7e0');
      g.addColorStop(0.6, '#f0d394');
      g.addColorStop(1, '#d9a94e');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      // escarcha dorada
      for (let i = 0; i < (W * H) / 900; i++) {
        c.fillStyle = r() > 0.5 ? `rgb(255 255 255 / ${r() * 0.8})` : `rgb(184 130 40 / ${r() * 0.5})`;
        c.beginPath();
        c.arc(r() * W, r() * H, 0.6 + r() * 2.2, 0, Math.PI * 2);
        c.fill();
      }
      scatter(W, H, W / 5, r, (x, y) => {
        c.fillStyle = 'rgb(255 255 255 / 0.8)';
        sparkle(c, x, y, W * (0.008 + r() * 0.012));
        c.fill();
      });
      break;
    }
    case 'menta': {
      gradient(c, W, H, ['#e6faf1', '#9fdcc0']);
      const step = W / 10;
      for (let y = 0, row = 0; y < H + step; y += step, row++) {
        for (let x = row % 2 ? step / 2 : 0; x < W + step; x += step) {
          c.fillStyle = 'rgb(255 255 255 / 0.55)';
          c.beginPath();
          c.arc(x, y, step * 0.16, 0, Math.PI * 2);
          c.fill();
        }
      }
      break;
    }
    case 'baston': {
      c.fillStyle = '#fff6f2';
      c.fillRect(0, 0, W, H);
      c.save();
      c.translate(W / 2, H / 2);
      c.rotate(-Math.PI / 4);
      const d = Math.hypot(W, H);
      const band = W / 9;
      for (let x = -d; x < d; x += band * 2) {
        c.fillStyle = '#e0323b';
        c.fillRect(x, -d, band * 0.85, d * 2);
        c.fillStyle = 'rgb(47 125 74 / 0.55)';
        c.fillRect(x + band * 1.25, -d, band * 0.12, d * 2);
      }
      c.restore();
      // velo claro al centro para que la carta y los textos respiren
      const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgb(255 246 242 / 0.55)');
      g.addColorStop(1, 'rgb(255 246 242 / 0.1)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      break;
    }
    case 'arcoiris': {
      gradient(c, W, H, ['#ffd6e0', '#ffe9c7', '#fff6bf', '#d7f7d4', '#d4ecff', '#e6dcff']);
      // nubecitas y brillitos
      for (let i = 0; i < 7; i++) {
        const x = r() * W;
        const y = r() * H;
        const s = W * (0.03 + r() * 0.03);
        c.fillStyle = 'rgb(255 255 255 / 0.75)';
        for (const [dx, dy, k] of [[0, 0, 1], [s * 0.9, s * 0.15, 0.8], [-s * 0.9, s * 0.2, 0.75], [s * 0.4, -s * 0.5, 0.8]] as const) {
          c.beginPath();
          c.arc(x + dx, y + dy, s * k, 0, Math.PI * 2);
          c.fill();
        }
      }
      scatter(W, H, W / 6, r, (x, y) => {
        c.fillStyle = ['#ff8cc0', '#ffd34d', '#74c0fc', '#b197fc'][Math.floor(r() * 4)]!;
        sparkle(c, x, y, W * (0.008 + r() * 0.01));
        c.fill();
      });
      break;
    }
    default:
      break;
  }
}

// ---------- bordes ----------

/** Punto del recorrido del borde (t de 0 a 1) y su dirección hacia afuera. */
export function borderPoint(W: number, H: number, inset: number, t: number): [number, number, number] {
  const w = W - 2 * inset;
  const h = H - 2 * inset;
  let d = (((t % 1) + 1) % 1) * 2 * (w + h);
  if (d < w) return [inset + d, inset, -Math.PI / 2];
  d -= w;
  if (d < h) return [W - inset, inset + d, 0];
  d -= h;
  if (d < w) return [W - inset - d, H - inset, Math.PI / 2];
  d -= w;
  return [inset, H - inset - d, Math.PI];
}

/** Repite algo a lo largo del borde cada `gap` píxeles. */
function along(W: number, H: number, inset: number, gap: number, fn: (x: number, y: number, ang: number, i: number) => void) {
  const per = 2 * (W + H - 4 * inset);
  const n = Math.max(4, Math.round(per / gap));
  for (let i = 0; i < n; i++) {
    const [x, y, a] = borderPoint(W, H, inset, (i + 0.5) / n);
    fn(x, y, a, i);
  }
}

/** Recorta al anillo del borde (todo menos el centro). */
function ringClip(c: Ctx, W: number, H: number, band: number) {
  c.beginPath();
  c.rect(0, 0, W, H);
  c.rect(band, band, W - 2 * band, H - 2 * band);
  c.clip('evenodd');
}

export function drawFrame(c: Ctx, frame: Frame, W: number, H: number, r: Rand) {
  switch (frame) {
    case 'baston': {
      const band = W * 0.04;
      c.save();
      ringClip(c, W, H, band);
      c.fillStyle = '#fffaf7';
      c.fillRect(0, 0, W, H);
      c.translate(W / 2, H / 2);
      c.rotate(Math.PI / 4);
      const d = Math.hypot(W, H);
      const s = band * 0.9;
      for (let x = -d; x < d; x += s * 2) {
        c.fillStyle = '#d6262f';
        c.fillRect(x, -d, s, d * 2);
      }
      c.restore();
      c.strokeStyle = 'rgb(120 20 30 / 0.35)';
      c.lineWidth = W * 0.003;
      c.strokeRect(band, band, W - 2 * band, H - 2 * band);
      break;
    }
    case 'guirnalda': {
      const inset = W * 0.028;
      // ramitas de pino
      c.lineCap = 'round';
      along(W, H, inset, W * 0.006, (x, y) => {
        for (let k = 0; k < 3; k++) {
          const a = r() * Math.PI * 2;
          const len = W * (0.016 + r() * 0.018);
          c.strokeStyle = ['#1d5a34', '#2a7445', '#174a2b'][Math.floor(r() * 3)]!;
          c.lineWidth = W * 0.0035;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
          c.stroke();
        }
      });
      // adornos
      along(W, H, inset, W * 0.09, (x, y, _a, i) => {
        const col = ['#d6262f', '#e6b43c', '#ff7eb3', '#5ab8ff'][i % 4]!;
        const rad = W * 0.014;
        c.fillStyle = col;
        c.beginPath();
        c.arc(x, y, rad, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgb(255 255 255 / 0.6)';
        c.beginPath();
        c.arc(x - rad * 0.35, y - rad * 0.35, rad * 0.3, 0, Math.PI * 2);
        c.fill();
      });
      break;
    }
    case 'copos': {
      const inset = W * 0.035;
      c.strokeStyle = 'rgb(255 255 255 / 0.9)';
      c.lineWidth = W * 0.003;
      c.strokeRect(inset * 1.9, inset * 1.9, W - inset * 3.8, H - inset * 3.8);
      c.lineCap = 'round';
      along(W, H, inset, W * 0.075, (x, y, _a, i) => {
        const s = W * (i % 2 ? 0.014 : 0.022);
        c.strokeStyle = 'rgb(120 170 220 / 0.6)';
        c.lineWidth = W * 0.007;
        snowflake(c, x, y, s);
        c.stroke();
        c.strokeStyle = '#ffffff';
        c.lineWidth = W * 0.004;
        snowflake(c, x, y, s);
        c.stroke();
      });
      break;
    }
    case 'corazones': {
      const inset = W * 0.035;
      c.strokeStyle = 'rgb(255 126 179 / 0.7)';
      c.lineWidth = W * 0.003;
      c.setLineDash([W * 0.01, W * 0.008]);
      c.strokeRect(inset * 1.9, inset * 1.9, W - inset * 3.8, H - inset * 3.8);
      c.setLineDash([]);
      along(W, H, inset, W * 0.06, (x, y, _a, i) => {
        const s = W * (i % 2 ? 0.03 : 0.04);
        c.save();
        c.translate(x, y);
        c.rotate((i % 3) * 0.15 - 0.15);
        c.shadowColor = 'rgb(120 20 60 / 0.3)';
        c.shadowBlur = W * 0.005;
        c.fillStyle = ['#ff4f8f', '#ff8cc0', '#ffb3d1'][i % 3]!;
        heart(c, 0, 0, s);
        c.fill();
        c.restore();
      });
      break;
    }
    case 'encaje': {
      const band = W * 0.035;
      c.save();
      ringClip(c, W, H, band);
      c.fillStyle = '#fffdf8';
      c.fillRect(0, 0, W, H);
      c.restore();
      // festón hacia adentro y agujeritos del encaje
      const sr = W * 0.014;
      c.save();
      // sombra suave: el encaje se nota también sobre fondos claros
      c.shadowColor = 'rgb(90 60 40 / 0.35)';
      c.shadowBlur = W * 0.008;
      c.fillStyle = '#fffdf8';
      along(W, H, band, sr * 2, (x, y) => {
        c.beginPath();
        c.arc(x, y, sr, 0, Math.PI * 2);
        c.fill();
      });
      c.restore();
      c.fillStyle = '#fffdf8';
      c.fillRect(0, 0, W, band);
      c.fillRect(0, H - band, W, band);
      c.fillRect(0, 0, band, H);
      c.fillRect(W - band, 0, band, H);
      c.fillStyle = 'rgb(205 180 150 / 0.55)';
      along(W, H, band * 0.5, W * 0.03, (x, y) => {
        c.beginPath();
        c.arc(x, y, W * 0.0045, 0, Math.PI * 2);
        c.fill();
      });
      along(W, H, band + sr * 0.2, sr * 2, (x, y) => {
        c.beginPath();
        c.arc(x, y, W * 0.0028, 0, Math.PI * 2);
        c.fill();
      });
      break;
    }
    case 'cinta': {
      const bw = W * 0.06;
      const ribbon = (x0: number, y0: number, x1: number, y1: number) => {
        c.save();
        c.lineCap = 'butt';
        c.strokeStyle = '#c42630';
        c.lineWidth = bw;
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x1, y1);
        c.stroke();
        c.strokeStyle = '#ffd34d';
        c.lineWidth = bw * 0.12;
        for (const off of [-0.32, 0.32]) {
          const nx = (-(y1 - y0) / Math.hypot(x1 - x0, y1 - y0)) * bw * off;
          const ny = ((x1 - x0) / Math.hypot(x1 - x0, y1 - y0)) * bw * off;
          c.beginPath();
          c.moveTo(x0 + nx, y0 + ny);
          c.lineTo(x1 + nx, y1 + ny);
          c.stroke();
        }
        c.restore();
      };
      const k = Math.min(W, H) * 0.3;
      c.shadowColor = 'rgb(0 0 0 / 0.3)';
      c.shadowBlur = W * 0.01;
      ribbon(-bw, k + bw, k + bw, -bw);
      ribbon(W - k - bw, H + bw, W + bw, H - k - bw);
      // moño en la esquina superior izquierda
      const bx = k * 0.5;
      const by = k * 0.5;
      const s = W * 0.07;
      c.fillStyle = '#d6262f';
      for (const sgn of [-1, 1]) {
        c.beginPath();
        c.ellipse(bx + sgn * s * 0.7, by - s * 0.1, s * 0.75, s * 0.42, sgn * -0.5, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(bx, by);
        c.lineTo(bx + sgn * s * 0.6, by + s * 1.2);
        c.lineTo(bx + sgn * s * 0.25, by + s * 1.05);
        c.lineTo(bx + sgn * s * 0.05, by + s * 1.3);
        c.closePath();
        c.fill();
      }
      c.shadowColor = 'transparent';
      c.fillStyle = '#a5161f';
      c.beginPath();
      c.arc(bx, by - s * 0.05, s * 0.28, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgb(255 255 255 / 0.35)';
      for (const sgn of [-1, 1]) {
        c.beginPath();
        c.ellipse(bx + sgn * s * 0.75, by - s * 0.22, s * 0.3, s * 0.1, sgn * -0.5, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    default:
      break;
  }
}
