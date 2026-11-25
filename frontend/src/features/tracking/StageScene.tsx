import type { ReactNode } from 'react';
import type { StopIcon } from '@/lib/types';
import './stages.css';

/**
 * Escenas animadas de cada etapa del viaje del regalo (las paradas predefinidas
 * se identifican por su ícono). SVG + animaciones CSS (`.et-*` en index.css):
 * livianas, sin dependencias y quietas con `prefers-reduced-motion`.
 */

const C = {
  nieve: '#fffaf0',
  papel: '#f7eedd',
  rojo: '#b8352b',
  rojoOsc: '#8e2a20',
  pino: '#2f6b3d',
  muerdago: '#5f8c4a',
  oro: '#d9a441',
  oroSuave: '#efd59c',
  cafe: '#4a2e1e',
  madera: '#bc7f4e',
  maderaOsc: '#784a2c',
  piel: '#f4c9a6',
  hielo: '#c9d3d0',
};

type Sky = 'dia' | 'tarde' | 'noche';

/** Fondo común: cielo, nieve que cae y suelo nevado. */
function Backdrop({ sky = 'dia', children }: { sky?: Sky; children: ReactNode }) {
  const grad = {
    dia: ['#f6ead2', '#fbf6ec'],
    tarde: ['#f0c99a', '#f8e3c4'],
    noche: ['#3c3550', '#6b5470'],
  }[sky];
  const id = `cielo-${sky}`;
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={grad[0]} />
          <stop offset="1" stopColor={grad[1]} />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id})`} />
      {children}
      <path d="M0 172 Q80 160 160 170 T320 166 V200 H0 Z" fill={C.nieve} />
      {[18, 62, 110, 154, 205, 248, 292].map((x, i) => (
        <circle key={x} className="et-copo" style={{ animationDelay: `${(i * 0.7) % 4}s` }} cx={x} cy={-6} r={i % 2 ? 1.8 : 2.4} fill="#ffffff" opacity={0.9} />
      ))}
    </>
  );
}

function Star({ x, y, r = 6, fill = C.oro, className, delay = 0 }: { x: number; y: number; r?: number; fill?: string; className?: string; delay?: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`;
  }).join(' ');
  return <polygon points={pts} fill={fill} className={className} style={{ animationDelay: `${delay}s` }} />;
}

/** Trineo pequeño (de perfil) para cielos. */
function MiniSleigh({ fill = C.rojo }: { fill?: string }) {
  return (
    <g>
      <path d="M0 10 Q2 0 14 2 L30 2 Q34 2 34 8 L34 12 L4 12 Q0 12 0 10Z" fill={fill} />
      <path d="M-2 16 H32 Q38 16 38 11" stroke={C.oro} strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="22" cy="0" rx="8" ry="6" fill={C.maderaOsc} />
      {/* reno */}
      <path d="M40 9 Q48 4 56 8 L56 12 L42 12Z" fill={C.madera} />
      <circle cx="58" cy="6" r="3" fill={C.madera} />
      <circle cx="61" cy="6.5" r="1.3" fill={C.rojo} />
      <path d="M56 3 l-2 -5 M58 3 l2 -5" stroke={C.maderaOsc} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M38 9 L42 10" stroke={C.oro} strokeWidth="1.2" />
    </g>
  );
}

function Gift({ x, y, w, h, box, ribbon }: { x: number; y: number; w: number; h: number; box: string; ribbon: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill={box} />
      <rect x={x + w / 2 - 3} y={y} width="6" height={h} fill={ribbon} />
      <rect x={x} y={y + h / 3} width={w} height="5" fill={ribbon} />
      <ellipse cx={x + w / 2 - 6} cy={y - 3} rx="6" ry="4" fill="none" stroke={ribbon} strokeWidth="3" />
      <ellipse cx={x + w / 2 + 6} cy={y - 3} rx="6" ry="4" fill="none" stroke={ribbon} strokeWidth="3" />
    </g>
  );
}

// ---------- escenas ----------

/** Carta recibida: el sobre vuela y entra al buzón; se levanta la banderita. */
function Carta() {
  return (
    <Backdrop>
      <rect x="236" y="104" width="10" height="70" fill={C.maderaOsc} />
      <path d="M200 112 V88 Q200 70 230 70 Q260 70 260 88 V112 Z" fill={C.rojo} />
      <rect x="214" y="86" width="32" height="5" rx="2.5" fill={C.cafe} />
      <g className="et-bandera">
        <rect x="262" y="72" width="4" height="30" fill={C.cafe} />
        <rect x="266" y="72" width="16" height="10" fill={C.oro} />
      </g>
      <g className="et-carta">
        <rect x="40" y="40" width="40" height="26" rx="3" fill={C.papel} stroke={C.madera} strokeWidth="1.5" />
        <path d="M40 41 L60 56 L80 41" fill="none" stroke={C.madera} strokeWidth="1.5" />
        <circle cx="60" cy="56" r="4" fill={C.rojo} />
      </g>
      {[0, 1, 2].map((i) => (
        <path key={i} className="et-sube" style={{ animationDelay: `${1.6 + i * 0.35}s` }} d={`M${222 + i * 10} 66 c-3 -4 -8 0 0 6 c8 -6 3 -10 0 -6`} fill={C.rojo} />
      ))}
    </Backdrop>
  );
}

/** Duendes fabricando: el martillo golpea el trencito y saltan chispas. */
function Taller() {
  return (
    <Backdrop>
      <rect x="40" y="132" width="240" height="12" rx="4" fill={C.madera} />
      <rect x="56" y="144" width="10" height="26" fill={C.maderaOsc} />
      <rect x="254" y="144" width="10" height="26" fill={C.maderaOsc} />
      <g className="et-sacude">
        <rect x="96" y="104" width="44" height="26" rx="4" fill={C.rojo} />
        <rect x="140" y="112" width="30" height="18" rx="3" fill={C.pino} />
        <rect x="104" y="92" width="12" height="14" fill={C.cafe} />
        {[108, 130, 156].map((x) => (
          <circle key={x} cx={x} cy="132" r="6" fill={C.cafe} stroke={C.oro} strokeWidth="2" />
        ))}
      </g>
      <g className="et-martillo">
        <rect x="196" y="58" width="7" height="62" rx="3" fill={C.madera} />
        <rect x="182" y="50" width="36" height="16" rx="4" fill={C.hielo} stroke={C.cafe} strokeWidth="1.5" />
      </g>
      {[0, 1, 2].map((i) => (
        <Star key={i} className="et-chispa" x={172 + i * 10} y={92 - i * 8} r={5 - i} delay={i * 0.05} />
      ))}
      {/* gorro de duende que se asoma */}
      <g className="et-asoma">
        <path d="M266 132 L280 98 L294 132 Z" fill={C.pino} />
        <circle cx="280" cy="98" r="4" fill={C.nieve} />
      </g>
    </Backdrop>
  );
}

/** Control de calidad: la lupa revisa el regalo y aparecen los vistos buenos. */
function Lupa() {
  return (
    <Backdrop>
      <Gift x={126} y={96} w={68} h={60} box={C.rojo} ribbon={C.oro} />
      <g className="et-revisa">
        <circle cx="160" cy="98" r="24" fill="rgb(255 255 255 / 0.35)" stroke={C.cafe} strokeWidth="5" />
        <path d="M150 88 q6 -6 14 -4" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="176" y="114" width="9" height="34" rx="4" fill={C.madera} transform="rotate(-40 180 118)" />
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i} className="et-visto" style={{ animationDelay: `${0.6 + i * 0.7}s` }}>
          <circle cx={92 + i * 68} cy="40" r="13" fill={C.muerdago} />
          <path d={`M${85 + i * 68} 40 l5 5 l9 -10`} stroke="#ffffff" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
    </Backdrop>
  );
}

/** Envuelto con cinta dorada: la cinta recorre la caja y aparece el moño. */
function Regalo() {
  return (
    <Backdrop>
      <rect x="112" y="92" width="96" height="74" rx="4" fill={C.pino} />
      {[124, 150, 176, 196].map((x, i) => (
        <circle key={x} cx={x} cy={i % 2 ? 150 : 110} r="3" fill={C.oroSuave} opacity="0.6" />
      ))}
      <rect className="et-cinta-v" x="153" y="92" width="14" height="74" fill={C.oro} />
      <rect className="et-cinta-h" x="112" y="122" width="96" height="12" fill={C.oro} />
      <g className="et-mono">
        <ellipse cx="148" cy="84" rx="14" ry="9" fill="none" stroke={C.oro} strokeWidth="6" />
        <ellipse cx="172" cy="84" rx="14" ry="9" fill="none" stroke={C.oro} strokeWidth="6" />
        <circle cx="160" cy="88" r="6" fill={C.oro} />
      </g>
      {[0, 1, 2, 3].map((i) => (
        <Star key={i} className="et-brilla" x={[96, 228, 104, 222][i]!} y={[80, 72, 150, 146][i]!} r={6} delay={2 + i * 0.25} />
      ))}
    </Backdrop>
  );
}

/** Cargado en el trineo: el regalo cae al saco y el trineo rebota. */
function Trineo() {
  return (
    <Backdrop>
      <g className="et-rebota">
        <ellipse cx="190" cy="112" rx="30" ry="24" fill={C.maderaOsc} />
        <path d="M172 92 Q190 80 208 92" stroke={C.cafe} strokeWidth="3" fill="none" />
        <path d="M90 140 Q92 112 120 112 L200 112 Q222 112 222 132 L222 146 L102 146 Q90 146 90 140Z" fill={C.rojo} />
        <path d="M100 124 H214" stroke={C.oro} strokeWidth="4" />
        <path d="M84 160 H218 Q236 160 236 146" stroke={C.oro} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M120 146 v14 M200 146 v14" stroke={C.oro} strokeWidth="4" />
      </g>
      <g className="et-cae">
        <Gift x={176} y={24} w={30} h={24} box={C.oroSuave} ribbon={C.rojo} />
      </g>
    </Backdrop>
  );
}

/** Los renos calientan motores: estiran, respiran vapor y la nariz brilla. */
function Reno() {
  return (
    <Backdrop sky="tarde">
      <g className="et-estira">
        <ellipse cx="150" cy="122" rx="46" ry="24" fill="#9f633f" />
        {[118, 134, 166, 182].map((x, i) => (
          <rect key={x} className="et-pata" style={{ animationDelay: `${(i % 2) * 0.4}s` }} x={x} y="136" width="8" height="34" rx="3" fill={C.maderaOsc} />
        ))}
        <path d="M186 110 Q196 92 206 86" stroke="#9f633f" strokeWidth="16" strokeLinecap="round" fill="none" />
        <ellipse cx="214" cy="80" rx="16" ry="13" fill="#9f633f" />
        <ellipse cx="226" cy="84" rx="9" ry="7" fill="#e3c39a" />
        <circle className="et-nariz" cx="234" cy="82" r="5.5" fill={C.rojo} />
        <circle cx="212" cy="74" r="2.4" fill={C.cafe} />
        <path d="M206 68 l-6 -16 m3 8 l-8 -4 M218 66 l2 -18 m-1 9 l8 -5" stroke="#d6b585" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <path d="M104 116 q-10 -4 -12 6" stroke="#9f633f" strokeWidth="6" strokeLinecap="round" fill="none" />
      </g>
      {[0, 1, 2].map((i) => (
        <circle key={i} className="et-vapor" style={{ animationDelay: `${i * 0.6}s` }} cx="244" cy="80" r="6" fill="#ffffff" />
      ))}
      <ellipse cx="72" cy="164" rx="24" ry="7" fill={C.madera} />
      <path d="M50 160 Q72 172 94 160 L92 156 L52 156Z" fill={C.maderaOsc} />
      <Star className="et-brilla" x={64} y={146} r={5} delay={0.2} />
      <Star className="et-brilla" x={82} y={140} r={4} delay={0.9} />
    </Backdrop>
  );
}

/** Sobrevolando la cordillera: el trineo cruza los Andes entre nubes. */
function Montana() {
  return (
    <Backdrop sky="tarde">
      <g className="et-nube" style={{ animationDuration: '14s' }}>
        <ellipse cx="60" cy="44" rx="26" ry="9" fill="#ffffff" opacity="0.8" />
        <ellipse cx="250" cy="30" rx="20" ry="7" fill="#ffffff" opacity="0.7" />
      </g>
      <path d="M0 172 L46 96 L82 140 L130 70 L176 136 L214 92 L262 150 L300 104 L320 126 V200 H0Z" fill="#a98a72" />
      <path d="M130 70 L118 90 L126 86 L132 94 L140 84 L146 92Z M46 96 L38 110 L46 106 L52 112Z M214 92 L204 108 L212 104 L218 110 L224 104Z M300 104 L292 116 L300 112 L306 118Z" fill="#ffffff" />
      <path d="M0 182 L60 128 L104 160 L156 118 L206 164 L252 132 L320 170 V200 H0Z" fill="#7c6553" />
      <g className="et-vuela">
        <MiniSleigh />
      </g>
      <g className="et-nube" style={{ animationDuration: '9s' }}>
        <ellipse cx="180" cy="60" rx="30" ry="10" fill="#ffffff" opacity="0.9" />
      </g>
    </Backdrop>
  );
}

/** Llegando a tu ciudad: se encienden las ventanas y pasa el trineo. */
function Ciudad() {
  const houses = [
    { x: 34, w: 50, h: 54, roof: C.rojo },
    { x: 96, w: 40, h: 74, roof: C.pino },
    { x: 150, w: 56, h: 50, roof: C.rojoOsc },
    { x: 218, w: 44, h: 66, roof: C.maderaOsc },
    { x: 272, w: 36, h: 48, roof: C.rojo },
  ];
  return (
    <Backdrop sky="noche">
      <circle cx="268" cy="36" r="14" fill={C.oroSuave} />
      <circle cx="274" cy="32" r="12" fill="#3c3550" />
      {[30, 80, 140, 200, 120].map((x, i) => (
        <Star key={x} className="et-titila" x={x} y={[24, 44, 20, 50, 60][i]!} r={3} fill="#ffffff" delay={i * 0.4} />
      ))}
      <g className="et-vuela-lento">
        <MiniSleigh />
      </g>
      {houses.map((h, i) => (
        <g key={h.x}>
          <rect x={h.x} y={172 - h.h} width={h.w} height={h.h} fill="#e8d9c0" />
          <path d={`M${h.x - 4} ${172 - h.h} L${h.x + h.w / 2} ${150 - h.h} L${h.x + h.w + 4} ${172 - h.h}Z`} fill={h.roof} />
          {[0, 1].map((k) => (
            <rect
              key={k}
              className="et-luz"
              style={{ animationDelay: `${0.4 + i * 0.35 + k * 0.2}s` }}
              x={h.x + 8 + k * (h.w - 26)}
              y={182 - h.h}
              width="10"
              height="12"
              rx="2"
              fill={C.oro}
            />
          ))}
        </g>
      ))}
    </Backdrop>
  );
}

/** ¡Bajo el árbol!: la estrella brilla y van apareciendo los regalos. */
function Arbol() {
  return (
    <Backdrop sky="noche">
      <rect x="152" y="146" width="16" height="22" fill={C.maderaOsc} />
      <path d="M160 40 L204 104 L116 104Z M160 66 L216 132 L104 132Z M160 92 L226 158 L94 158Z" fill={C.pino} />
      <Star className="et-titila" x={160} y={38} r={11} delay={0} />
      {[
        [140, 96, C.rojo],
        [178, 112, C.oro],
        [128, 140, '#5b7fc4'],
        [190, 146, C.rojo],
        [160, 124, '#5b7fc4'],
      ].map(([x, y, f], i) => (
        <circle key={i} className="et-titila" style={{ animationDelay: `${i * 0.3}s` }} cx={x as number} cy={y as number} r="5" fill={f as string} />
      ))}
      {[
        { x: 92, w: 30, h: 24, box: C.rojo, ribbon: C.oro },
        { x: 196, w: 34, h: 28, box: C.oroSuave, ribbon: C.rojo },
        { x: 126, w: 24, h: 18, box: '#5b7fc4', ribbon: C.oro },
      ].map((g, i) => (
        <g key={i} className="et-aparece" style={{ animationDelay: `${0.5 + i * 0.6}s` }}>
          <Gift x={g.x} y={170 - g.h} w={g.w} h={g.h} box={g.box} ribbon={g.ribbon} />
        </g>
      ))}
    </Backdrop>
  );
}

/** Parada personalizada: una estrella que late. */
function Estrella() {
  return (
    <Backdrop sky="tarde">
      <Star className="et-late" x={160} y={92} r={46} />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return <Star key={i} className="et-brilla" x={160 + Math.cos(a) * 80} y={92 + Math.sin(a) * 52} r={6} delay={i * 0.3} />;
      })}
    </Backdrop>
  );
}

const SCENES: Record<StopIcon, () => ReactNode> = {
  carta: Carta,
  taller: Taller,
  lupa: Lupa,
  regalo: Regalo,
  trineo: Trineo,
  reno: Reno,
  montana: Montana,
  ciudad: Ciudad,
  arbol: Arbol,
  estrella: Estrella,
};

/** Escena animada de una etapa, según su ícono. */
export function StageScene({ icon, label }: { icon: StopIcon; label: string }) {
  const Scene = SCENES[icon] ?? Estrella;
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label={label} className="etapa block h-full w-full">
      <Scene />
    </svg>
  );
}
