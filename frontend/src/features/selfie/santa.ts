/**
 * Viejito Pascuero sacándose una selfie (ilustración original, de busto).
 * Mira a cámara guiñando un ojo, con el pulgar arriba; el brazo derecho sale
 * por el borde derecho porque sostiene el teléfono. Se espeja cuando va a la izquierda.
 */
export const SANTA_W = 600;
export const SANTA_H = 720;
/** Centro aproximado de la cara (fracción del dibujo), para el flash de la cámara. */
export const SANTA_FACE = { x: 0.5, y: 0.4 };

export const SANTA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SANTA_W} ${SANTA_H}">
<defs>
  <radialGradient id="piel" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color="#ffdcc4"/><stop offset=".7" stop-color="#f4b994"/><stop offset="1" stop-color="#e09a78"/></radialGradient>
  <linearGradient id="abrigo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2403f"/><stop offset=".55" stop-color="#c42630"/><stop offset="1" stop-color="#8e1220"/></linearGradient>
  <linearGradient id="manga" x1="0" y1="0" x2="1" y2=".4"><stop offset="0" stop-color="#b91f2a"/><stop offset="1" stop-color="#e5463f"/></linearGradient>
  <linearGradient id="gorro" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#d63235"/><stop offset="1" stop-color="#9c1420"/></linearGradient>
  <radialGradient id="barba" cx="50%" cy="25%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#f3f1ec"/><stop offset="1" stop-color="#d9d4cb"/></radialGradient>
  <radialGradient id="piel-sombra" cx="50%" cy="50%" r="50%"><stop offset=".6" stop-color="#b56b4f" stop-opacity="0"/><stop offset="1" stop-color="#b56b4f" stop-opacity=".35"/></radialGradient>
  <radialGradient id="mejilla"><stop offset="0" stop-color="#ff6f73" stop-opacity=".7"/><stop offset="1" stop-color="#ff6f73" stop-opacity="0"/></radialGradient>
  <radialGradient id="pompon" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#ddd8cf"/></radialGradient>
  <linearGradient id="piel-mano" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c7048"/><stop offset="1" stop-color="#1c4d31"/></linearGradient>
</defs>

<!-- brazo que sostiene el teléfono: sube hacia la cámara y sale por el borde -->
<path d="M400 600 C 460 540, 530 470, 620 410 L 620 610 C 560 630, 500 670, 450 720 Z" fill="url(#manga)"/>
<path d="M586 432 C 600 490, 608 560, 606 618 L 620 610 L 620 410 Z" fill="#fbfaf6"/>

<!-- cuerpo -->
<path d="M24 720 C 30 600, 130 512, 300 500 C 470 512, 570 600, 576 720 Z" fill="url(#abrigo)"/>
<path d="M300 500 C 250 505, 205 514, 170 530 C 210 560, 260 572, 300 572 C 340 572, 390 560, 430 530 C 395 514, 350 505, 300 500 Z" fill="#fbfaf6"/>

<!-- orejas -->
<ellipse cx="176" cy="298" rx="22" ry="32" fill="#eaa784"/>
<ellipse cx="424" cy="298" rx="22" ry="32" fill="#eaa784"/>

<!-- cara -->
<ellipse cx="300" cy="288" rx="122" ry="128" fill="url(#piel)"/>
<ellipse cx="300" cy="288" rx="122" ry="128" fill="url(#piel-sombra)"/>

<!-- barba esponjosa -->
<g fill="url(#barba)">
  <path d="M170 292 C 156 380, 166 466, 206 538 C 228 588, 260 626, 300 642 C 340 626, 372 588, 394 538 C 434 466, 444 380, 430 292 C 414 346, 380 382, 300 386 C 220 382, 186 346, 170 292 Z"/>
  <circle cx="176" cy="372" r="26"/><circle cx="424" cy="372" r="26"/>
  <circle cx="180" cy="438" r="30"/><circle cx="420" cy="438" r="30"/>
  <circle cx="204" cy="502" r="32"/><circle cx="396" cy="502" r="32"/>
  <circle cx="236" cy="564" r="34"/><circle cx="364" cy="564" r="34"/>
  <circle cx="270" cy="608" r="32"/><circle cx="330" cy="608" r="32"/>
  <circle cx="300" cy="626" r="30"/>
</g>
<g fill="none" stroke="#d6d1c7" stroke-width="5" stroke-linecap="round" opacity=".8">
  <path d="M230 450 Q 240 500 262 540"/><path d="M370 450 Q 360 500 338 540"/>
  <path d="M300 470 Q 296 530 300 590"/><path d="M200 400 Q 206 440 222 470"/><path d="M400 400 Q 394 440 378 470"/>
</g>

<!-- boca riendo -->
<path d="M258 370 Q 300 430 342 370 Z" fill="#6e1826"/>
<path d="M276 394 Q 300 414 324 394 Q 300 384 276 394 Z" fill="#ff8590"/>

<!-- bigote -->
<path d="M300 352 C 268 326, 222 330, 196 360 C 186 372, 196 384, 214 382 C 236 380, 252 372, 268 368 C 284 364, 294 362, 300 362 Z" fill="#ffffff"/>
<path d="M300 352 C 332 326, 378 330, 404 360 C 414 372, 404 384, 386 382 C 364 380, 348 372, 332 368 C 316 364, 306 362, 300 362 Z" fill="#ffffff"/>
<path d="M300 356 C 270 340, 236 342, 214 362" stroke="#dcd7ce" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M300 356 C 330 340, 364 342, 386 362" stroke="#dcd7ce" stroke-width="4" fill="none" stroke-linecap="round"/>

<!-- nariz -->
<ellipse cx="300" cy="326" rx="30" ry="25" fill="#ec8a76"/>
<ellipse cx="290" cy="316" rx="10" ry="7" fill="#fff" opacity=".55"/>

<!-- mejillas -->
<circle cx="222" cy="318" r="36" fill="url(#mejilla)"/>
<circle cx="378" cy="318" r="36" fill="url(#mejilla)"/>

<!-- ojos: uno abierto y un guiño -->
<ellipse cx="252" cy="268" rx="12" ry="15" fill="#2a1913"/>
<circle cx="256" cy="262" r="4.5" fill="#fff"/>
<path d="M328 272 Q 348 254 368 272" stroke="#2a1913" stroke-width="8" fill="none" stroke-linecap="round"/>
<path d="M366 276 L 378 282" stroke="#2a1913" stroke-width="5" stroke-linecap="round"/>

<!-- anteojos dorados -->
<g fill="#cfe8ff" fill-opacity=".16" stroke="#c4962f" stroke-width="5">
  <circle cx="252" cy="270" r="31"/><circle cx="348" cy="270" r="31"/>
</g>
<path d="M283 268 Q 300 258 317 268" stroke="#c4962f" stroke-width="5" fill="none"/>
<path d="M238 252 Q 246 246 256 247" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>

<!-- cejas -->
<path d="M218 232 Q 248 208 282 228" stroke="#ffffff" stroke-width="16" stroke-linecap="round" fill="none"/>
<path d="M318 226 Q 352 204 384 230" stroke="#ffffff" stroke-width="16" stroke-linecap="round" fill="none"/>

<!-- gorro con pompón caído -->
<path d="M168 214 C 176 114, 258 60, 344 68 C 436 78, 494 150, 512 238 C 498 244, 482 244, 468 238 C 458 186, 432 156, 404 144 C 420 170, 430 194, 432 214 Z" fill="url(#gorro)"/>
<path d="M404 144 C 432 156, 458 186, 468 238 C 476 240, 482 240, 488 238 C 476 182, 446 150, 404 144 Z" fill="#7d0f1a" opacity=".45"/>
<g fill="#fbfaf6">
  <rect x="152" y="186" width="296" height="58" rx="29"/>
  <circle cx="170" cy="200" r="18"/><circle cx="214" cy="190" r="16"/><circle cx="262" cy="186" r="16"/><circle cx="310" cy="185" r="16"/>
  <circle cx="358" cy="187" r="16"/><circle cx="404" cy="192" r="16"/><circle cx="436" cy="204" r="16"/>
</g>
<rect x="152" y="226" width="296" height="18" rx="9" fill="#ddd8cf" opacity=".7"/>
<circle cx="492" cy="252" r="40" fill="url(#pompon)"/>

<!-- pulgar arriba con mitón verde -->
<g transform="translate(96 590) rotate(-8)">
  <path d="M-62 140 L -50 40 L 50 40 L 62 140 Z" fill="url(#manga)"/>
  <rect x="-60" y="22" width="120" height="40" rx="19" fill="#fbfaf6"/>
  <path d="M-52 -40 C -52 -64, -32 -72, -8 -70 L 34 -68 C 54 -66, 58 -40, 54 -16 L 50 18 C 48 32, 36 36, 22 36 L -32 36 C -48 36, -54 24, -54 8 Z" fill="url(#piel-mano)"/>
  <path d="M-46 -48 C -50 -86, -40 -124, -18 -128 C 2 -130, 8 -110, 2 -88 L -2 -66 Z" fill="url(#piel-mano)"/>
  <g stroke="#123a24" stroke-width="5" stroke-linecap="round" fill="none" opacity=".55">
    <path d="M-2 -40 L 50 -40"/><path d="M-6 -14 L 50 -14"/><path d="M-10 10 L 46 10"/>
  </g>
  <path d="M-30 -112 Q -22 -122 -12 -118" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".35"/>
</g>
</svg>`;
