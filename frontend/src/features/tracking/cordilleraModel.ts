import * as THREE from 'three';
import { rngFor } from '@/components/scene/debug';

/**
 * Contrato visual de la mini-escena 3D de la cordillera (no es un estado del backend:
 * la parada "Sobrevolando la Cordillera de los Andes" se identifica por `icono === 'montana'`).
 *
 * Coordenadas: +X avance del trineo, +Y arriba, +Z hacia la cámara. Unidad = unidad de escena.
 * Campo compartido: una sola serie de picos por capa alimenta el silhouette extrusionado
 * y las coronas de nieve, así que la nieve no puede quedar flotando ni desalineada.
 * Semilla: `rngFor(capa)` (derivada de `?seed=`), reproducible para capturas y tests.
 * Filtro: solo dos bandas (pico + hombro); ninguna frecuencia bajo el tamaño del pico.
 */
export const CORDILLERA = {
  /** ancho total de cada cordillera, en unidades de escena */
  width: 30,
  /** recorrido del trineo: más corto que la cordillera para que no se pierda de cuadro */
  flightWidth: 16,
  /** altura de la línea de base de los cerros */
  baseY: -3.6,
  /** altura mínima del trineo (por encima del pico más alto) */
  sleighBaseY: 4.6,
  /** vuelta completa del trineo, en segundos */
  flightSeconds: 9,
  /** pose fija cuando hay reduced motion o la etapa no está ocurriendo */
  stillCycle: 0.34,
} as const;

export interface RidgeLayer {
  /** profundidad de la capa (la cámara está en +Z) */
  z: number;
  /** grosor del recorte extrusionado */
  depth: number;
  peaks: number;
  minHeight: number;
  maxHeight: number;
  rock: string;
  snow: string;
}

/** Tres capas recortadas a distancias distintas: cerros lejanos, medios y cercanos. */
export const LAYERS: RidgeLayer[] = [
  { z: -10, depth: 0.8, peaks: 6, minHeight: 2.4, maxHeight: 3.8, rock: '#c2a68e', snow: '#f6ecdd' },
  { z: -5.5, depth: 0.9, peaks: 5, minHeight: 2.0, maxHeight: 3.3, rock: '#a98a72', snow: '#fbf3e6' },
  { z: -1.5, depth: 1.0, peaks: 4, minHeight: 1.6, maxHeight: 2.9, rock: '#806653', snow: '#fffaf0' },
];

export type Point2 = readonly [number, number];

export interface Peak {
  x: number;
  y: number;
  /** altura de la línea de nieve */
  capY: number;
  /** intersección izquierda/derecha del perfil con la línea de nieve */
  capLeft: number;
  capRight: number;
}

export interface Ridge {
  /** perfil de arriba, de izquierda a derecha */
  points: Point2[];
  peaks: Peak[];
}

/** Donde una recta del perfil corta una altura dada (para anclar la nieve al cerro). */
function crossX(a: Point2, b: Point2, y: number): number {
  const dy = b[1] - a[1];
  if (Math.abs(dy) < 1e-6) return a[0];
  const t = Math.min(1, Math.max(0, (y - a[1]) / dy));
  return a[0] + (b[0] - a[0]) * t;
}

/** Perfil determinista de una capa: picos estratificados + hombros bajos entre ellos. */
export function ridgeProfile(layerIndex: number): Ridge {
  const layer = LAYERS[layerIndex] ?? LAYERS[0]!;
  const rnd = rngFor(20 + layerIndex);
  const half = CORDILLERA.width / 2;
  const slot = CORDILLERA.width / layer.peaks;
  const centers: number[] = [];
  const heights: number[] = [];
  const capDrops: number[] = [];
  const shoulderFracs: number[] = [];
  for (let i = 0; i < layer.peaks; i++) {
    centers.push(-half + slot * (i + 0.28 + rnd() * 0.44));
    heights.push(layer.minHeight + rnd() * (layer.maxHeight - layer.minHeight));
    capDrops.push(0.34 + rnd() * 0.16);
    shoulderFracs.push(0.3 + rnd() * 0.14);
  }

  const points: Point2[] = [[-half, CORDILLERA.baseY]];
  const peaks: Peak[] = [];
  for (let i = 0; i < layer.peaks; i++) {
    const x = centers[i]!;
    const y = heights[i]!;
    // Cada hombro se queda dentro del tramo que comparte con su vecino: el perfil
    // nunca se cruza, así que el recorte extrusionado no se autointersecta.
    const leftBoundary = i === 0 ? -half : (centers[i - 1]! + x) / 2;
    const rightBoundary = i === layer.peaks - 1 ? half : (x + centers[i + 1]!) / 2;
    const leftX = leftBoundary + (x - leftBoundary) * (0.55 + rnd() * 0.25);
    const rightX = x + (rightBoundary - x) * (0.55 + rnd() * 0.25);
    const shoulderY = CORDILLERA.baseY + (y - CORDILLERA.baseY) * shoulderFracs[i]!;
    const shoulderR = shoulderY - rnd() * 0.18;

    points.push([leftX, shoulderY]);
    points.push([x, y]);
    points.push([rightX, shoulderR]);

    const capY = y - capDrops[i]!;
    peaks.push({ x, y, capY, capLeft: crossX(points[points.length - 3]!, [x, y], capY), capRight: crossX([x, y], [rightX, shoulderR], capY) });
  }
  points.push([half, CORDILLERA.baseY]);
  return { points, peaks };
}

/** Recorte cerrado del cerro; el fondo baja más para no dejar rendijas con el cielo. */
export function ridgeShape(ridge: Ridge): THREE.Shape {
  const shape = new THREE.Shape();
  const first = ridge.points[0]!;
  shape.moveTo(first[0], first[1]);
  for (let i = 1; i < ridge.points.length; i++) {
    const p = ridge.points[i]!;
    shape.lineTo(p[0], p[1]);
  }
  shape.lineTo(CORDILLERA.width / 2, CORDILLERA.baseY - 2);
  shape.lineTo(-CORDILLERA.width / 2, CORDILLERA.baseY - 2);
  shape.closePath();
  return shape;
}

/** Coronas de nieve derivadas del mismo perfil (borde inferior con dientes de acuarela). */
export function snowShapes(ridge: Ridge): THREE.Shape[] {
  return ridge.peaks.map((peak) => {
    const width = Math.max(0.1, peak.capRight - peak.capLeft);
    const shape = new THREE.Shape();
    shape.moveTo(peak.capLeft, peak.capY);
    shape.lineTo(peak.x, peak.y);
    shape.lineTo(peak.capRight, peak.capY);
    shape.lineTo(peak.capRight - width * 0.28, peak.capY - 0.12);
    shape.lineTo(peak.x + width * 0.05, peak.capY - 0.2);
    shape.lineTo(peak.capLeft + width * 0.28, peak.capY - 0.12);
    shape.closePath();
    return shape;
  });
}

/** Perfil lateral del trineo: curva delantera alta, asiento hundido y respaldo. */
export function sleighBodyShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-1.2, 0.4);
  s.lineTo(0.85, 0.4);
  s.quadraticCurveTo(1.38, 0.52, 1.35, 1.3);
  s.quadraticCurveTo(1.06, 1.03, 0.9, 0.86);
  s.quadraticCurveTo(0.55, 0.72, -0.35, 0.72);
  s.lineTo(-0.95, 1.12);
  s.closePath();
  return s;
}

/** Patín delantero y trasero, en el plano XY (se duplica a cada lado del trineo). */
export const RUNNER_POINTS: Point2[] = [
  [-1.5, 0.06],
  [-1.0, -0.02],
  [0.6, -0.02],
  [1.25, 0.14],
  [1.6, 0.62],
];

export interface SleighPose {
  x: number;
  y: number;
  /** cabeceo: se deriva de la pendiente del vuelo */
  pitch: number;
  /** guiñada suave, independiente del cabeceo */
  yaw: number;
}

/**
 * Cinemática analítica del vuelo: el eje X avanza linealmente y el cabeceo sale de su
 * derivada. `still` congela en una pose legible (reduced motion o etapa no activa).
 */
export function sleighPose(t: number, still = false): SleighPose {
  const cycle = still ? CORDILLERA.stillCycle : (((t / CORDILLERA.flightSeconds) % 1) + 1) % 1;
  const wave = cycle * Math.PI * 4;
  return {
    x: -CORDILLERA.flightWidth / 2 + CORDILLERA.flightWidth * cycle,
    y: CORDILLERA.sleighBaseY + Math.sin(wave) * 0.16,
    pitch: -Math.cos(wave) * 0.035,
    yaw: Math.sin(cycle * Math.PI * 2) * 0.04,
  };
}

/** Pico más alto de todas las capas: se usa para verificar que el trineo vuela por encima. */
export function maxPeakHeight(): number {
  return Math.max(...LAYERS.map((layer) => layer.maxHeight));
}
