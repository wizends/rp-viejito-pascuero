import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { GEO, PALETTE, blink, toon } from '../kit';

const black = toon(PALETTE.negro);
const white = toon('#ffffff');
const cheek = toon(PALETTE.mejilla);

interface Props {
  /** separación entre ojos */
  spread: number;
  eyeY: number;
  /** z de la superficie de la cara */
  z: number;
  eyeSize: number;
  seed: number;
  mouthY?: number;
  cheekY?: number;
  cheekSpread?: number;
  smile?: number;
  /** ojos cerrados (dormido) */
  sleeping?: boolean;
  /** cierre de ojos animable desde afuera (0 abiertos → 1 cerrados de risa) */
  closed?: { current: number };
}

/** Ojos brillantes con parpadeo aleatorio, mejillas sonrojadas y sonrisa. */
export function Face({
  spread,
  eyeY,
  z,
  eyeSize,
  seed,
  mouthY,
  cheekY,
  cheekSpread,
  smile = 1,
  sleeping = false,
  closed,
}: Props) {
  const eyes = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (!eyes.current) return;
    const c = closed ? closed.current : 0;
    eyes.current.scale.y = sleeping ? 0.12 : Math.min(blink(s.clock.elapsedTime, seed), 1 - c * 0.9);
  });
  return (
    <group>
      <group ref={eyes} position={[0, eyeY, z]}>
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * spread, 0, 0]}>
            <mesh geometry={GEO.sphere} material={black} scale={[eyeSize, eyeSize * 1.15, eyeSize * 0.6]} />
            {!sleeping && (
              <>
                <mesh geometry={GEO.sphereLow} material={white} position={[eyeSize * 0.35, eyeSize * 0.4, eyeSize * 0.5]} scale={eyeSize * 0.34} />
                <mesh geometry={GEO.sphereLow} material={white} position={[-eyeSize * 0.3, -eyeSize * 0.35, eyeSize * 0.5]} scale={eyeSize * 0.15} />
              </>
            )}
          </group>
        ))}
      </group>
      {cheekY !== undefined && (
        <>
          {[-1, 1].map((sx) => (
            <mesh
              key={sx}
              geometry={GEO.sphereLow}
              material={cheek}
              position={[sx * (cheekSpread ?? spread * 1.6), cheekY, z - eyeSize * 0.4]}
              scale={[eyeSize * 1.3, eyeSize * 0.8, eyeSize * 0.5]}
            />
          ))}
        </>
      )}
      {mouthY !== undefined && (
        <mesh
          geometry={GEO.smile}
          material={toon('#7a1f2b')}
          position={[0, mouthY, z]}
          rotation={[0, 0, Math.PI]}
          scale={[eyeSize * 1.1 * smile, eyeSize * 0.9 * smile, eyeSize]}
        />
      )}
    </group>
  );
}
