/** Stickers navideños originales (SVG 100×100) para decorar la postal. */
export const STICKERS = {
  estrella: {
    label: 'Estrella',
    svg: `<path d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36 Z" fill="#ffd34d" stroke="#d9a441" stroke-width="4" stroke-linejoin="round"/>
      <path d="M50 18 L57 38 L46 40 Z" fill="#fff6c8" opacity=".8"/>`,
  },
  copo: {
    label: 'Copo de nieve',
    svg: `<g stroke="#ffffff" stroke-width="7" stroke-linecap="round" fill="none">
      <path d="M50 8 V92 M14 29 L86 71 M14 71 L86 29"/>
      <path d="M38 14 L50 26 L62 14 M38 86 L50 74 L62 86 M14 45 L26 38 L22 22 M86 55 L74 62 L78 78 M14 55 L26 62 L22 78 M86 45 L74 38 L78 22"/></g>
      <g stroke="#9fd3f0" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".9"><path d="M50 8 V92 M14 29 L86 71 M14 71 L86 29"/></g>`,
  },
  baston: {
    label: 'Bastón de dulce',
    svg: `<path d="M38 92 V36 C38 18, 72 14, 74 34" stroke="#ffffff" stroke-width="16" stroke-linecap="round" fill="none"/>
      <path d="M38 92 V36 C38 18, 72 14, 74 34" stroke="#d6262f" stroke-width="16" stroke-linecap="round" fill="none" stroke-dasharray="9 9"/>
      <path d="M33 90 V38" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>`,
  },
  regalo: {
    label: 'Regalo',
    svg: `<rect x="14" y="40" width="72" height="52" rx="5" fill="#2f7d4a"/>
      <rect x="10" y="30" width="80" height="18" rx="4" fill="#3a9659"/>
      <rect x="44" y="30" width="12" height="62" fill="#ffd34d"/>
      <path d="M50 30 C 36 8, 18 16, 30 28 Z M50 30 C 64 8, 82 16, 70 28 Z" fill="#ffd34d" stroke="#d9a441" stroke-width="3"/>
      <rect x="14" y="48" width="72" height="5" fill="#1f5a33" opacity=".4"/>`,
  },
  bola: {
    label: 'Bola del árbol',
    svg: `<rect x="42" y="8" width="16" height="12" rx="3" fill="#d9a441"/>
      <circle cx="50" cy="8" r="5" fill="none" stroke="#d9a441" stroke-width="3"/>
      <circle cx="50" cy="56" r="38" fill="#c42630"/>
      <path d="M14 50 Q 50 66 86 50" stroke="#ffd34d" stroke-width="5" fill="none"/>
      <path d="M16 66 Q 50 80 84 66" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>
      <ellipse cx="36" cy="38" rx="9" ry="6" fill="#fff" opacity=".55" transform="rotate(-30 36 38)"/>`,
  },
  muerdago: {
    label: 'Muérdago',
    svg: `<path d="M50 52 C 30 30, 8 34, 6 52 C 24 60, 40 58, 50 52 Z" fill="#2f7d4a"/>
      <path d="M50 52 C 70 30, 92 34, 94 52 C 76 60, 60 58, 50 52 Z" fill="#3a9659"/>
      <path d="M50 52 C 40 72, 44 90, 54 96 C 62 82, 60 66, 50 52 Z" fill="#2a6e41"/>
      <path d="M10 52 Q 30 50 48 52 M90 52 Q 70 50 52 52" stroke="#1f5a33" stroke-width="2" fill="none"/>
      <circle cx="44" cy="50" r="8" fill="#d6262f"/><circle cx="56" cy="48" r="8" fill="#e23a3a"/><circle cx="50" cy="60" r="8" fill="#c42630"/>
      <circle cx="42" cy="47" r="2.5" fill="#fff" opacity=".7"/><circle cx="54" cy="45" r="2.5" fill="#fff" opacity=".7"/>`,
  },
  gorro: {
    label: 'Gorro',
    svg: `<path d="M18 74 C 22 36, 44 14, 66 18 C 82 22, 90 40, 88 58 C 82 50, 74 44, 66 46 C 70 56, 72 66, 72 74 Z" fill="#c42630"/>
      <rect x="10" y="68" width="72" height="20" rx="10" fill="#fbfaf6"/>
      <circle cx="88" cy="62" r="10" fill="#fbfaf6"/>`,
  },
  reno: {
    label: 'Reno',
    svg: `<g stroke="#7a4a2a" stroke-width="6" stroke-linecap="round" fill="none">
      <path d="M36 34 C 28 22, 26 12, 30 4 M32 20 L 20 14"/>
      <path d="M64 34 C 72 22, 74 12, 70 4 M68 20 L 80 14"/></g>
      <ellipse cx="22" cy="44" rx="10" ry="6" fill="#a86a3e" transform="rotate(-25 22 44)"/>
      <ellipse cx="78" cy="44" rx="10" ry="6" fill="#a86a3e" transform="rotate(25 78 44)"/>
      <ellipse cx="50" cy="58" rx="26" ry="30" fill="#a86a3e"/>
      <ellipse cx="50" cy="74" rx="17" ry="13" fill="#d9b48a"/>
      <circle cx="40" cy="50" r="4.5" fill="#2a1913"/><circle cx="60" cy="50" r="4.5" fill="#2a1913"/>
      <circle cx="41.5" cy="48.5" r="1.5" fill="#fff"/><circle cx="61.5" cy="48.5" r="1.5" fill="#fff"/>
      <circle cx="50" cy="68" r="9" fill="#e23a3a"/><circle cx="47" cy="65" r="3" fill="#fff" opacity=".6"/>
      <path d="M44 80 Q 50 85 56 80" stroke="#7a4a2a" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  },
  arbol: {
    label: 'Árbol',
    svg: `<path d="M50 10 L 74 42 H 62 L 82 66 H 66 L 88 86 H 12 L 34 66 H 18 L 38 42 H 26 Z" fill="#2f7d4a"/>
      <rect x="44" y="86" width="12" height="10" fill="#7a4a2a"/>
      <circle cx="42" cy="40" r="3.5" fill="#ffd34d"/><circle cx="60" cy="56" r="3.5" fill="#e23a3a"/>
      <circle cx="36" cy="72" r="3.5" fill="#7fd0ff"/><circle cx="64" cy="78" r="3.5" fill="#ffd34d"/><circle cx="48" cy="62" r="3.5" fill="#fff"/>
      <path d="M50 2 L53 9 L60 9 L54 13 L56 20 L50 16 L44 20 L46 13 L40 9 L47 9 Z" fill="#ffd34d"/>`,
  },
  campana: {
    label: 'Campana',
    svg: `<path d="M50 14 C 30 14, 26 34, 26 52 C 26 64, 18 72, 14 78 H 86 C 82 72, 74 64, 74 52 C 74 34, 70 14, 50 14 Z" fill="#e6b43c" stroke="#b98a24" stroke-width="3"/>
      <circle cx="50" cy="84" r="8" fill="#b98a24"/>
      <path d="M36 30 C 32 40, 32 52, 32 60" stroke="#fff3c4" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M38 12 C 44 2, 56 2, 62 12" stroke="#d6262f" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  },
  galleta: {
    label: 'Galleta de jengibre',
    svg: `<path d="M50 6 C 62 6, 68 16, 66 26 C 64 32, 62 34, 70 36 L 88 40 C 96 42, 96 54, 88 54 L 70 54 L 74 86 C 76 96, 64 98, 60 90 L 50 70 L 40 90 C 36 98, 24 96, 26 86 L 30 54 L 12 54 C 4 54, 4 42, 12 40 L 30 36 C 38 34, 36 32, 34 26 C 32 16, 38 6, 50 6 Z" fill="#c07a3e"/>
      <path d="M18 47 H 28 M72 47 H 82 M36 80 L 40 74 M64 80 L 60 74" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="44" cy="20" r="3" fill="#2a1913"/><circle cx="56" cy="20" r="3" fill="#2a1913"/>
      <path d="M43 28 Q 50 33 57 28" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="44" r="3.5" fill="#e23a3a"/><circle cx="50" cy="56" r="3.5" fill="#2f7d4a"/>`,
  },
  vela: {
    label: 'Vela',
    svg: `<path d="M50 6 C 60 20, 60 30, 50 36 C 40 30, 40 20, 50 6 Z" fill="#ffb43a"/>
      <path d="M50 16 C 55 24, 55 30, 50 34 C 45 30, 45 24, 50 16 Z" fill="#fff3a8"/>
      <rect x="36" y="38" width="28" height="50" rx="4" fill="#fbfaf6"/>
      <path d="M40 38 V 52 C 40 56, 46 56, 46 52 V 38 Z" fill="#e8e3da"/>
      <path d="M22 88 H 78 C 78 96, 22 96, 22 88 Z" fill="#2f7d4a"/>
      <circle cx="28" cy="86" r="5" fill="#d6262f"/><circle cx="72" cy="86" r="5" fill="#d6262f"/>`,
  },
  corazon: {
    label: 'Corazón',
    svg: `<path d="M50 88 C 20 66, 6 48, 8 30 C 10 14, 26 6, 38 10 C 44 12, 48 16, 50 22 C 52 16, 56 12, 62 10 C 74 6, 90 14, 92 30 C 94 48, 80 66, 50 88 Z" fill="#ff5c9a" stroke="#e23d7f" stroke-width="3"/>
      <path d="M24 24 C 28 18, 34 17, 38 19" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none" opacity=".75"/>
      <circle cx="22" cy="34" r="3.5" fill="#fff" opacity=".75"/>`,
  },
  corazones: {
    label: 'Lluvia de corazones',
    svg: `<g stroke-width="2">
      <path d="M34 62 C 16 50, 8 40, 10 30 C 12 20, 24 16, 30 22 C 32 24, 34 26, 34 28 C 35 25, 37 22, 40 21 C 48 18, 58 24, 57 34 C 56 44, 48 52, 34 62 Z" fill="#ff7eb3" stroke="#e8558f"/>
      <path d="M72 44 C 62 37, 58 31, 59 26 C 60 20, 67 18, 70 22 L 72 25 L 74 22 C 77 18, 84 20, 85 26 C 86 31, 82 37, 72 44 Z" fill="#ffb3d1" stroke="#ff7eb3"/>
      <path d="M66 92 C 52 82, 46 74, 47 66 C 48 58, 58 55, 62 60 L 66 64 L 70 60 C 74 55, 84 58, 85 66 C 86 74, 80 82, 66 92 Z" fill="#ff4f8f" stroke="#d93a78"/></g>
      <path d="M17 31 C 19 27, 23 26, 25 27" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none" opacity=".75"/>
      <path d="M53 65 C 55 61, 59 60, 61 61" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".75"/>`,
  },
  arcoiris: {
    label: 'Arcoíris',
    svg: `<g fill="none" stroke-width="7" stroke-linecap="round">
      <path d="M12 72 A 38 38 0 0 1 88 72" stroke="#ff5c7a"/>
      <path d="M19 72 A 31 31 0 0 1 81 72" stroke="#ffa94d"/>
      <path d="M26 72 A 24 24 0 0 1 74 72" stroke="#ffe066"/>
      <path d="M33 72 A 17 17 0 0 1 67 72" stroke="#69db7c"/>
      <path d="M40 72 A 10 10 0 0 1 60 72" stroke="#74c0fc"/></g>
      <g fill="#ffffff"><circle cx="14" cy="76" r="9"/><circle cx="24" cy="78" r="8"/><circle cx="6" cy="80" r="6"/><circle cx="18" cy="84" r="7"/>
      <circle cx="86" cy="76" r="9"/><circle cx="76" cy="78" r="8"/><circle cx="94" cy="80" r="6"/><circle cx="82" cy="84" r="7"/></g>`,
  },
  brillitos: {
    label: 'Brillitos',
    svg: `<path d="M44 10 C 47 34, 52 39, 76 42 C 52 45, 47 50, 44 74 C 41 50, 36 45, 12 42 C 36 39, 41 34, 44 10 Z" fill="#ffe27a" stroke="#f5b82e" stroke-width="2"/>
      <path d="M78 56 C 79 67, 82 70, 92 71 C 82 72, 79 75, 78 86 C 77 75, 74 72, 64 71 C 74 70, 77 67, 78 56 Z" fill="#ffc2e0" stroke="#ff8cc0" stroke-width="2"/>
      <path d="M22 70 C 23 77, 25 79, 32 80 C 25 81, 23 83, 22 90 C 21 83, 19 81, 12 80 C 19 79, 21 77, 22 70 Z" fill="#c8f0ff" stroke="#8fd3f5" stroke-width="2"/>
      <circle cx="80" cy="20" r="4" fill="#ffe27a"/><circle cx="88" cy="34" r="2.5" fill="#ffc2e0"/><circle cx="50" cy="90" r="3" fill="#ffe27a"/>`,
  },
  reno_rosa: {
    label: 'Reno con corazones',
    svg: `<g stroke="#c9708f" stroke-width="5.5" stroke-linecap="round" fill="none">
      <path d="M38 36 C 30 26, 28 16, 32 8 M33 22 L 22 17"/><path d="M62 36 C 70 26, 72 16, 68 8 M67 22 L 78 17"/></g>
      <ellipse cx="25" cy="46" rx="10" ry="6" fill="#f7b6cd" transform="rotate(-25 25 46)"/>
      <ellipse cx="75" cy="46" rx="10" ry="6" fill="#f7b6cd" transform="rotate(25 75 46)"/>
      <ellipse cx="25" cy="46" rx="5" ry="3" fill="#ff8cb5" transform="rotate(-25 25 46)"/>
      <ellipse cx="75" cy="46" rx="5" ry="3" fill="#ff8cb5" transform="rotate(25 75 46)"/>
      <ellipse cx="50" cy="60" rx="25" ry="28" fill="#f7b6cd"/>
      <ellipse cx="50" cy="75" rx="16" ry="12" fill="#ffe3ee"/>
      <path d="M42 49 Q 38 45 34 49" stroke="#5a2a3c" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M66 49 Q 62 45 58 49" stroke="#5a2a3c" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <circle cx="33" cy="60" r="5" fill="#ff7eb3" opacity=".55"/><circle cx="67" cy="60" r="5" fill="#ff7eb3" opacity=".55"/>
      <path d="M50 76 C 42 70, 40 66, 41 63 C 42 60, 46 59, 48 61 L 50 63 L 52 61 C 54 59, 58 60, 59 63 C 60 66, 58 70, 50 76 Z" fill="#ff3d84"/>
      <path d="M45 81 Q 50 85 55 81" stroke="#5a2a3c" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M86 26 C 80 22, 78 19, 79 16 C 80 13, 84 13, 85 15 L 86 16 L 87 15 C 88 13, 92 13, 93 16 C 94 19, 92 22, 86 26 Z" fill="#ff5c9a"/>
      <path d="M12 26 C 7 23, 6 20, 7 18 C 8 16, 11 16, 12 18 C 13 16, 16 16, 17 18 C 18 20, 17 23, 12 26 Z" fill="#ff9cc4"/>`,
  },
  lazo: {
    label: 'Lazo rosado',
    svg: `<path d="M46 52 L 32 88 L 42 84 L 46 94 L 52 56 Z" fill="#ff5c9a"/><path d="M54 52 L 68 88 L 58 84 L 54 94 L 48 56 Z" fill="#ff5c9a"/>
      <path d="M50 48 C 34 26, 10 24, 10 40 C 10 56, 34 56, 50 48 Z" fill="#ff7eb3" stroke="#e8558f" stroke-width="3"/>
      <path d="M50 48 C 66 26, 90 24, 90 40 C 90 56, 66 56, 50 48 Z" fill="#ff7eb3" stroke="#e8558f" stroke-width="3"/>
      <circle cx="50" cy="48" r="10" fill="#ff4f8f" stroke="#d93a78" stroke-width="3"/>
      <path d="M20 38 C 24 34, 30 34, 34 36" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none" opacity=".7"/>`,
  },
  regalo_rosa: {
    label: 'Regalo rosado',
    svg: `<rect x="14" y="40" width="72" height="52" rx="5" fill="#ff9cc4"/>
      <rect x="10" y="30" width="80" height="18" rx="4" fill="#ffb3d1"/>
      <rect x="44" y="30" width="12" height="62" fill="#ffffff"/>
      <path d="M50 30 C 36 8, 18 16, 30 28 Z M50 30 C 64 8, 82 16, 70 28 Z" fill="#ffffff" stroke="#ff7eb3" stroke-width="3"/>
      <g fill="#fff" opacity=".8"><circle cx="26" cy="62" r="3"/><circle cx="74" cy="70" r="3"/><circle cx="30" cy="82" r="2.5"/><circle cx="70" cy="56" r="2.5"/></g>`,
  },
  bola_rosa: {
    label: 'Bola rosada',
    svg: `<rect x="42" y="8" width="16" height="12" rx="3" fill="#d9a441"/>
      <circle cx="50" cy="8" r="5" fill="none" stroke="#d9a441" stroke-width="3"/>
      <circle cx="50" cy="56" r="38" fill="#ff7eb3"/>
      <path d="M50 72 C 38 64, 34 58, 36 52 C 38 46, 46 45, 50 50 C 54 45, 62 46, 64 52 C 66 58, 62 64, 50 72 Z" fill="#fff" opacity=".9"/>
      <path d="M16 46 Q 50 30 84 46" stroke="#ffe3ee" stroke-width="4" fill="none" stroke-dasharray="2 6" stroke-linecap="round"/>
      <ellipse cx="34" cy="36" rx="9" ry="6" fill="#fff" opacity=".55" transform="rotate(-30 34 36)"/>`,
  },
  gorro_rosa: {
    label: 'Gorro rosado',
    svg: `<path d="M18 74 C 22 36, 44 14, 66 18 C 82 22, 90 40, 88 58 C 82 50, 74 44, 66 46 C 70 56, 72 66, 72 74 Z" fill="#ff7eb3"/>
      <g fill="#fff" opacity=".85"><circle cx="40" cy="44" r="3"/><circle cx="56" cy="32" r="2.5"/><circle cx="58" cy="58" r="3"/></g>
      <rect x="10" y="68" width="72" height="20" rx="10" fill="#fbfaf6"/>
      <circle cx="88" cy="62" r="10" fill="#fbfaf6"/>`,
  },
  galleta_corazon: {
    label: 'Galleta de corazón',
    svg: `<path d="M50 90 C 18 68, 4 50, 6 30 C 8 12, 26 4, 38 8 C 44 10, 48 14, 50 20 C 52 14, 56 10, 62 8 C 74 4, 92 12, 94 30 C 96 50, 82 68, 50 90 Z" fill="#d79a5c"/>
      <path d="M50 80 C 24 62, 14 48, 15 33 C 16 20, 29 14, 38 17 C 44 19, 48 23, 50 28 C 52 23, 56 19, 62 17 C 71 14, 84 20, 85 33 C 86 48, 76 62, 50 80 Z" fill="#ffb3d1"/>
      <path d="M50 80 C 24 62, 14 48, 15 33 C 16 20, 29 14, 38 17 C 44 19, 48 23, 50 28 C 52 23, 56 19, 62 17 C 71 14, 84 20, 85 33 C 86 48, 76 62, 50 80 Z" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="1 6" stroke-linecap="round"/>
      <rect x="30" y="34" width="8" height="3" rx="1.5" fill="#ff4f8f" transform="rotate(30 34 35)"/>
      <rect x="60" y="30" width="8" height="3" rx="1.5" fill="#74c0fc" transform="rotate(-20 64 31)"/>
      <rect x="46" y="50" width="8" height="3" rx="1.5" fill="#ffe066"/>
      <rect x="62" y="50" width="8" height="3" rx="1.5" fill="#fff" transform="rotate(50 66 51)"/>
      <rect x="34" y="52" width="8" height="3" rx="1.5" fill="#69db7c" transform="rotate(-40 38 53)"/>`,
  },
  estrella_rosa: {
    label: 'Estrella rosada',
    svg: `<path d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36 Z" fill="#ffb3d1" stroke="#ff7eb3" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="40" cy="52" r="3.5" fill="#5a2a3c"/><circle cx="60" cy="52" r="3.5" fill="#5a2a3c"/>
      <path d="M44 60 Q 50 65 56 60" stroke="#5a2a3c" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="34" cy="60" r="4" fill="#ff5c9a" opacity=".5"/><circle cx="66" cy="60" r="4" fill="#ff5c9a" opacity=".5"/>`,
  },
} as const;

export type StickerId = keyof typeof STICKERS;
export const STICKER_IDS = Object.keys(STICKERS) as StickerId[];

/** Grupos de la paleta del editor. */
export const STICKER_GROUPS: { label: string; ids: StickerId[] }[] = [
  { label: 'Navidad clásica', ids: ['estrella', 'copo', 'baston', 'regalo', 'bola', 'muerdago', 'gorro', 'reno', 'arbol', 'campana', 'galleta', 'vela'] },
  {
    label: 'Rosado y brillante',
    ids: ['corazon', 'corazones', 'arcoiris', 'brillitos', 'reno_rosa', 'lazo', 'regalo_rosa', 'bola_rosa', 'gorro_rosa', 'galleta_corazon', 'estrella_rosa'],
  },
];

export function stickerSvg(id: StickerId): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${STICKERS[id].svg}</svg>`;
}
