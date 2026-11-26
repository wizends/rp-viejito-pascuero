import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useScene } from '@/stores/scene';
import { CAMERA, READ_POS, SANTA } from './layout';
import { damp, Spring } from './anim';
import { DELIVERY, SWIRL } from './cinematic';
import { SCENE_DEBUG, clampDt } from './debug';

/** Vistas fijas de inspección (validación visual): [posición local al Viejito, mirada local]. */
const SHOTS: Record<string, [THREE.Vector3, THREE.Vector3]> = {
  santa: [new THREE.Vector3(0, 1.55, 2.6), new THREE.Vector3(0, 1.3, 0.2)],
  santa34: [new THREE.Vector3(1.7, 1.7, 2.0), new THREE.Vector3(0, 1.3, 0.2)],
  santaside: [new THREE.Vector3(2.7, 1.4, 0.3), new THREE.Vector3(0, 1.2, 0.3)],
};

/**
 * Cámara cinematográfica (skill threejs-camera-direction):
 * - Un riel entre dos planos autorizados: general del taller ↔ cercano del Viejito leyendo.
 * - UNA sola etapa de interpolación por transición: un resorte críticamente
 *   amortiguado sobre el parámetro del riel (arranca y frena suave, sin rebote).
 *   La posición y la mirada se derivan directo del riel; no se vuelven a suavizar.
 * - Bloqueo exacto al llegar (sin residuo de resorte).
 * - Parallax de mouse/giroscopio como desplazamiento acotado y separado del riel.
 */
// Registro de libro ilustrado: acercamientos lentos (~2,4 s), como pasar la vista
// por una página, y una deriva tipo "Ken Burns" muy leve mientras nada ocurre.
const RAIL_STIFFNESS = 3.5;
export function CameraRig({ reduced, mobile }: { reduced: boolean; mobile: boolean }) {
  const { camera, gl } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  const s = useMemo(
    () => ({
      rail: new Spring(0, RAIL_STIFFNESS, 2 * Math.sqrt(RAIL_STIFFNESS)),
      px: 0,
      py: 0,
    }),
    [],
  );
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const closePos = useMemo(() => new THREE.Vector3(READ_POS.x - 1.4, READ_POS.y + 0.55, READ_POS.z + 3.6), []);
  const closeLook = useMemo(() => READ_POS.clone().add(new THREE.Vector3(-0.35, 0.05, 0)), []);

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      // solo sigue al mouse sobre la escena: al ir al menú o a otra parte, la cámara se queda quieta
      const r = gl.domElement.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.current.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      pointer.current.x = THREE.MathUtils.clamp(e.gamma / 30, -1, 1);
      pointer.current.y = THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('deviceorientation', onTilt, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, [reduced, gl]);

  useFrame((_, rawDt) => {
    const dt = clampDt(rawDt);
    const shot = SCENE_DEBUG.shot ? SHOTS[SCENE_DEBUG.shot] : undefined;
    if (shot) {
      const toWorld = (v: THREE.Vector3) => v.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), SANTA.rotY).add(SANTA.pos);
      camera.position.copy(toWorld(shot[0]));
      camera.lookAt(toWorld(shot[1]));
      return;
    }
    const { phase, phaseStart } = useScene.getState();
    const pt = (performance.now() - phaseStart) / 1000;
    // al volverse magia la carta, la cámara se aleja para ver el remolino envolver el taller
    // en `caught` queda abierta para ver al duende rodear el sillón; se acerca cuando entrega la carta
    const cpt = reduced ? pt * 4 : pt;
    const want =
      phase === 'reading' ||
      phase === 'help' ||
      (phase === 'caught' && cpt > DELIVERY.give[0] - 1.1) ||
      (phase === 'celebrate' && pt < SWIRL.start - 0.2)
        ? 1
        : 0;

    // Riel: con movimiento reducido, corte directo al plano (sin desplazamiento).
    let f: number;
    if (reduced) {
      s.rail.value = want;
      s.rail.velocity = 0;
      f = want;
    } else {
      // el riel sigue la línea de tiempo de la cinemática (reloj real): usa un dt
      // más amplio que el de la física decorativa; el resorte lo integra en subpasos.
      f = s.rail.update(want, clampDt(rawDt, 1));
      // bloqueo terminal: copia exacta del destino y velocidad cero
      if (Math.abs(want - f) < 1e-4 && Math.abs(s.rail.velocity) < 1e-3) {
        s.rail.value = want;
        s.rail.velocity = 0;
        f = want;
      }
    }
    const k = f * (mobile ? 0.55 : 0.8);

    // Parallax: parámetro perceptual, suavizado exponencial e independiente del riel.
    const par = reduced ? 0 : 1 - k * 0.6; // más quieto en el plano cercano
    s.px = damp(s.px, pointer.current.x * par, 4, dt);
    s.py = damp(s.py, pointer.current.y * par, 4, dt);

    const base = mobile ? CAMERA.mobilePos : CAMERA.pos;
    pos.copy(base).lerp(closePos, k);
    pos.x += s.px * 0.35;
    pos.y += -s.py * 0.18;
    if (!reduced) {
      // deriva lenta de cuento (se apaga en el plano cercano)
      const t = performance.now() / 1000;
      const drift = 1 - k;
      pos.x += Math.sin(t * 0.07) * 0.22 * drift;
      pos.y += Math.sin(t * 0.05 + 1) * 0.06 * drift;
      pos.z += Math.sin(t * 0.045) * 0.25 * drift;
    }
    look.copy(CAMERA.target).lerp(closeLook, k);
    camera.position.copy(pos);
    camera.lookAt(look);
  });
  return null;
}
