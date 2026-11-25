import type { Config } from 'tailwindcss';

/**
 * Tokens del Buzón. Se reemplaza la paleta por defecto de Tailwind para
 * evitar el "look plantilla": solo existen los colores de la marca.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      rojo: { DEFAULT: 'var(--rojo-pascuero)', baya: 'var(--rojo-baya)' },
      pino: 'var(--verde-pino)',
      muerdago: 'var(--verde-muerdago)',
      oro: { DEFAULT: 'var(--dorado-estrella)', suave: 'var(--dorado-suave)' },
      crema: 'var(--crema-nieve)',
      noche: { DEFAULT: 'var(--azul-noche)', 700: 'var(--azul-noche-700)', 600: 'var(--azul-noche-600)' },
      hielo: 'var(--azul-hielo)',
      canela: 'var(--canela)',
      tinta: { DEFAULT: 'var(--tinta)', suave: 'var(--tinta-suave)' },
      kraft: { DEFAULT: 'var(--kraft)', oscuro: 'var(--kraft-oscuro)' },
      cielo: { DEFAULT: 'var(--cielo)', claro: 'var(--cielo-claro)' },
      turquesa: { DEFAULT: 'var(--turquesa)', oscuro: 'var(--turquesa-oscuro)' },
      frambuesa: 'var(--frambuesa)',
      marino: 'var(--marino)',
    },
    fontFamily: {
      display: ['"Baloo 2"', 'Nunito', 'system-ui', 'sans-serif'],
      // títulos de cuento: letras de libro navideño ilustrado (como el título del boceto)
      cuento: ['"Mountains of Christmas"', '"Baloo 2"', 'Georgia', 'serif'],
      body: ['Nunito', 'system-ui', 'sans-serif'],
      mano: ['Caveat', '"Comic Sans MS"', 'cursive'],
    },
    extend: {
      borderRadius: { galleta: '1.75rem', sello: '0.35rem' },
      boxShadow: {
        papel: '0 2px 0 rgb(74 46 30 / 0.06), 0 14px 30px -14px rgb(74 46 30 / 0.35)',
        brillo: '0 0 0 3px var(--dorado-suave), 0 0 24px 4px rgb(232 185 49 / 0.55)',
        hundido: 'inset 0 2px 6px rgb(15 27 61 / 0.25)',
      },
      transitionTimingFunction: {
        rebote: 'cubic-bezier(.34,1.56,.64,1)',
        suave: 'cubic-bezier(.22,1,.36,1)',
      },
      keyframes: {
        latido: { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.08)' } },
        destello: {
          '0%': { opacity: '0', transform: 'scale(.4) rotate(0deg)' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'scale(1.2) rotate(90deg)' },
        },
      },
      animation: {
        latido: 'latido 1.8s ease-in-out infinite',
        destello: 'destello .9s ease-out forwards',
      },
    },
  },
  plugins: [],
} satisfies Config;
