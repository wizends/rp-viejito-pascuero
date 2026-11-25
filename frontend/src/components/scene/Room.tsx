import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { GEO, PALETTE, toon } from './kit';
import { ReindeerShelf } from './Props';

/** Dimensiones de la sala (compartidas con otros objetos). */
export const ROOM = {
  width: 11,
  depth: 8,
  height: 5.2,
  backZ: -3.6,
  window: { x: -1.1, y: 2.75, w: 2.6, h: 2.1 },
  fireplace: { x: 3.0, z: -3.25 },
  stable: { x: -5.4, z: -0.6 },
};

/** Textura de tablones de madera generada en canvas (sin descargas). */
function usePlankTexture(): THREE.Texture {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d')!;
    const tones = ['#c08550', '#b67b48', '#c98d58', '#bb804c'];
    const plankH = 64;
    for (let y = 0; y < 512; y += plankH) {
      let x = (y / plankH) % 2 === 0 ? 0 : -128;
      while (x < 512) {
        const w = 200 + ((x * 13 + y * 7) % 120);
        g.fillStyle = tones[Math.abs((x + y) / 8) % tones.length | 0]!;
        g.fillRect(x, y, w, plankH);
        g.strokeStyle = 'rgba(70,38,18,0.5)';
        g.lineWidth = 3;
        g.strokeRect(x + 1.5, y + 1.5, w - 3, plankH - 3);
        // vetas
        g.strokeStyle = 'rgba(70,38,18,0.14)';
        g.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          const yy = y + 14 + k * 16;
          g.moveTo(x + 6, yy);
          g.bezierCurveTo(x + w * 0.3, yy - 4, x + w * 0.6, yy + 5, x + w - 6, yy);
          g.stroke();
        }
        x += w;
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 2);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
}

/**
 * Pared de tablas verticales color miel (boceto): vetas suaves, ranuras café y
 * manchas de acuarela para que no se vea como un color plano.
 */
function useWallpaper(): THREE.Texture {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d')!;
    const tones = ['#ecc28c', '#e5b984', '#f0c995', '#e8bd88'];
    const bw = 64;
    for (let x = 0; x < 512; x += bw) {
      g.fillStyle = tones[(x / bw) % tones.length]!;
      g.fillRect(x, 0, bw, 512);
      // vetas
      g.strokeStyle = 'rgba(120,70,35,0.13)';
      g.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        const xx = x + 10 + k * 13;
        g.moveTo(xx, 0);
        g.bezierCurveTo(xx + 5, 160, xx - 6, 330, xx + 3, 512);
        g.stroke();
      }
      // ranura entre tablas
      g.fillStyle = 'rgba(130,80,40,0.4)';
      g.fillRect(x, 0, 3, 512);
    }
    // manchas suaves de pigmento (acuarela)
    for (let i = 0; i < 26; i++) {
      const x = (i * 197) % 512;
      const y = (i * 311) % 512;
      const r = 40 + ((i * 53) % 70);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, i % 2 ? 'rgba(255,236,200,0.18)' : 'rgba(150,90,45,0.12)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1.4);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
}

/** Cuadro enmarcado con un monito de nieve pintado (como el de la pared del boceto). */
function usePainting(): THREE.Texture {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 160;
    const g = c.getContext('2d')!;
    g.fillStyle = '#e8eef0';
    g.fillRect(0, 0, 128, 160);
    g.fillStyle = '#9fb7a2';
    g.fillRect(0, 118, 128, 42);
    const ball = (x: number, y: number, r: number) => {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    };
    g.fillStyle = '#fbf8f2';
    ball(64, 112, 30);
    ball(64, 70, 22);
    g.fillStyle = '#b8352b';
    g.fillRect(44, 84, 40, 8);
    g.fillStyle = '#34231a';
    g.fillRect(48, 36, 32, 14);
    g.fillRect(42, 48, 44, 4);
    ball(57, 66, 2.5);
    ball(71, 66, 2.5);
    g.fillStyle = '#d9822f';
    g.beginPath();
    g.moveTo(64, 72);
    g.lineTo(78, 75);
    g.lineTo(64, 76);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

export function Room() {
  const planks = usePlankTexture();
  const paper = useWallpaper();
  const floorMat = useMemo(() => new THREE.MeshToonMaterial({ map: planks, color: '#ffffff' }), [planks]);
  const wallMat = useMemo(() => new THREE.MeshToonMaterial({ map: paper, color: '#ffffff' }), [paper]);
  const painting = usePainting();
  const paintingMat = useMemo(() => new THREE.MeshToonMaterial({ map: painting, color: '#ffffff' }), [painting]);
  const { width, height, backZ, window: win } = ROOM;

  // Pared trasera en 4 paneles alrededor del hueco de la ventana
  const left = win.x - win.w / 2 - -width / 2;
  const right = width / 2 - (win.x + win.w / 2);
  const bottom = win.y - win.h / 2;
  const top = height - (win.y + win.h / 2);

  return (
    <group>
      {/* Piso */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow material={floorMat}>
        <planeGeometry args={[width, ROOM.depth]} />
      </mesh>
      {/* Alfombra redonda tejida */}
      <mesh rotation-x={-Math.PI / 2} position={[0.2, 0.01, 0.6]} material={toon('#c8433a')}>
        <circleGeometry args={[2.6, 48]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0.2, 0.015, 0.6]} material={toon('#e9c25a')}>
        <ringGeometry args={[2.25, 2.4, 48]} />
      </mesh>

      {/* Pared trasera */}
      <mesh position={[-width / 2 + left / 2, height / 2, backZ]} material={wallMat}>
        <planeGeometry args={[left, height]} />
      </mesh>
      <mesh position={[width / 2 - right / 2, height / 2, backZ]} material={wallMat}>
        <planeGeometry args={[right, height]} />
      </mesh>
      <mesh position={[win.x, bottom / 2, backZ]} material={wallMat}>
        <planeGeometry args={[win.w, bottom]} />
      </mesh>
      <mesh position={[win.x, height - top / 2, backZ]} material={wallMat}>
        <planeGeometry args={[win.w, top]} />
      </mesh>
      {/* Zócalo de madera */}
      <mesh position={[0, 0.35, backZ + 0.03]} material={toon(PALETTE.maderaOscura)}>
        <boxGeometry args={[width, 0.7, 0.06]} />
      </mesh>
      {/* Paredes laterales */}
      <mesh position={[-width / 2, height / 2, 0.4]} rotation-y={Math.PI / 2} material={wallMat}>
        <planeGeometry args={[ROOM.depth, height]} />
      </mesh>
      <mesh position={[width / 2, height / 2, 0.4]} rotation-y={-Math.PI / 2} material={wallMat}>
        <planeGeometry args={[ROOM.depth, height]} />
      </mesh>
      {/* Vigas del techo */}
      {[-3.5, 0, 3.5].map((x) => (
        <mesh key={x} position={[x, height - 0.15, 0]} material={toon(PALETTE.maderaOscura)}>
          <boxGeometry args={[0.3, 0.3, ROOM.depth]} />
        </mesh>
      ))}

      <WindowFrame />
      <Shelves />
      {/* repisa de renos (lámina de utilería) */}
      <ReindeerShelf position={[-3.7, 3.15, backZ + 0.12]} />
      {/* cuadro enmarcado y campana dorada (boceto) */}
      <group position={[4.7, 2.8, backZ + 0.05]}>
        <mesh material={toon(PALETTE.maderaOscura)} geometry={GEO.box} scale={[0.86, 1.02, 0.07]} />
        <mesh position={[0, 0, 0.04]} material={paintingMat} geometry={GEO.plane} scale={[0.68, 0.84, 1]} />
      </group>
      <group position={[0.55, 4.05, backZ + 0.18]}>
        <mesh position={[0, 0.35, 0]} material={toon(PALETTE.maderaOscura)} geometry={GEO.box} scale={[0.04, 0.5, 0.04]} />
        <mesh material={toon(PALETTE.oro)} geometry={GEO.cone} scale={[0.17, 0.26, 0.17]} />
        <mesh position={[0, -0.12, 0]} material={toon(PALETTE.oro)} geometry={GEO.torus} rotation-x={Math.PI / 2} scale={[0.17, 0.17, 0.25]} />
        <mesh position={[0, -0.16, 0]} material={toon(PALETTE.maderaOscura)} geometry={GEO.sphereLow} scale={0.04} />
        <mesh position={[0, 0.12, 0.05]} material={toon(PALETTE.rojo)} geometry={GEO.sphereLow} scale={[0.1, 0.05, 0.03]} />
      </group>
    </group>
  );
}

function WindowFrame() {
  const { x, y, w, h } = ROOM.window;
  const z = ROOM.backZ + 0.05;
  const wood = toon(PALETTE.madera);
  const snow = toon(PALETTE.blanco);
  return (
    <group position={[x, y, z]}>
      {/* marco */}
      <mesh position={[0, h / 2 + 0.08, 0]} material={wood} geometry={GEO.box} scale={[w + 0.3, 0.16, 0.18]} />
      <mesh position={[0, -h / 2 - 0.08, 0.05]} material={wood} geometry={GEO.box} scale={[w + 0.5, 0.16, 0.34]} />
      <mesh position={[-w / 2 - 0.08, 0, 0]} material={wood} geometry={GEO.box} scale={[0.16, h, 0.18]} />
      <mesh position={[w / 2 + 0.08, 0, 0]} material={wood} geometry={GEO.box} scale={[0.16, h, 0.18]} />
      {/* parteluces: cuadrícula de 3 × 3 vidrios (lámina de utilería) */}
      {[-1 / 6, 1 / 6].map((k) => (
        <mesh key={`v${k}`} position={[k * w, 0, 0]} material={wood} geometry={GEO.box} scale={[0.07, h, 0.08]} />
      ))}
      {[-1 / 6, 1 / 6].map((k) => (
        <mesh key={`h${k}`} position={[0, k * h, 0]} material={wood} geometry={GEO.box} scale={[w, 0.07, 0.08]} />
      ))}
      {/* nieve sobre el marco con carámbanos */}
      <mesh position={[0, h / 2 + 0.2, 0.04]} material={snow} geometry={GEO.capsule} rotation-z={Math.PI / 2} scale={[0.2, w * 0.9, 0.26]} />
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-w / 2 + 0.2 + i * ((w - 0.4) / 8), h / 2 + 0.02 - (i % 3) * 0.02, 0.1]} rotation-x={Math.PI} material={toon('#e6eef0')} geometry={GEO.cone} scale={[0.03, 0.12 + ((i * 7) % 4) * 0.04, 0.03]} />
      ))}
      {/* nieve acumulada en el alféizar */}
      <mesh position={[0, -h / 2 + 0.02, 0.06]} material={snow} geometry={GEO.capsule} rotation-z={Math.PI / 2} scale={[0.22, w * 0.82, 0.25]} />
      {/* escarcha en las esquinas */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (w / 2 - 0.12), -h / 2 + 0.14, 0.02]} material={snow} geometry={GEO.sphereLow} scale={[0.22, 0.14, 0.05]} />
      ))}
    </group>
  );
}

/** Estantería con casilleros de cartas a la izquierda de la chimenea. */
function Shelves() {
  const wood = toon(PALETTE.maderaClara);
  const dark = toon(PALETTE.maderaOscura);
  const env = toon(PALETTE.crema);
  const seal = toon(PALETTE.rojo);
  const x0 = 1.28;
  const cols = 4;
  const rows = 3;
  const cw = 0.42;
  const rh = 0.4;
  return (
    <group position={[x0, 2.6, ROOM.backZ + 0.25]}>
      <RoundedBox args={[cols * cw + 0.12, rows * rh + 0.12, 0.42]} radius={0.04} material={dark} />
      {Array.from({ length: cols * rows }, (_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const px = (c - (cols - 1) / 2) * cw;
        const py = (r - (rows - 1) / 2) * rh;
        const filled = (i * 7) % 5 !== 0;
        return (
          <group key={i} position={[px, py, 0.05]}>
            <mesh material={wood} geometry={GEO.box} scale={[cw - 0.05, rh - 0.05, 0.34]} />
            {filled && (
              <>
                <mesh position={[0, -0.05, 0.12]} rotation-z={((i % 3) - 1) * 0.08} material={env} geometry={GEO.box} scale={[0.28, 0.18, 0.04]} />
                <mesh position={[0.06, -0.05, 0.145]} material={seal} geometry={GEO.cylinder} rotation-x={Math.PI / 2} scale={[0.03, 0.01, 0.03]} />
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}
