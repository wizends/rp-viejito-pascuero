import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Menu as MenuIcon, Volume2, VolumeX } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, useCallback, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useLights } from '@/stores/lights';
import { useSession } from '@/stores/session';
import { CssGarland } from '@/components/ui/CssGarland';
import { PlugSwitch } from '@/components/ui/PlugSwitch';
import { MusicControl, MusicQuickButton } from '@/components/ui/MusicControl';
import { MenuSheet } from './MenuSheet';
import { Toaster } from '@/components/ui/Toast';
import { SleighLoader } from '@/components/ui/SleighLoader';
import { RouteErrorBoundary } from '@/components/ui/RouteErrorBoundary';
import { cascade, fadeUp, lifecycle, pop, springy } from '@/lib/motion';

function AudioToggle() {
  const audio = useLights((s) => s.audio);
  const setAudio = useLights((s) => s.setAudio);
  return (
    <button
      type="button"
      onClick={() => setAudio(!audio)}
      aria-pressed={audio}
      aria-label={audio ? 'Silenciar sonidos' : 'Activar sonidos de campanitas'}
      className="grid h-11 w-11 place-items-center rounded-full bg-rojo text-white shadow-[0_6px_14px_-4px_rgb(168_18_31/0.6)] transition-transform duration-300 ease-rebote hover:scale-110 active:scale-90"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={audio ? 'on' : 'off'}
          initial={{ opacity: 0, rotate: -40, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1, transition: springy }}
          exit={{ opacity: 0, rotate: 40, scale: 0.6, transition: { duration: 0.12 } }}
          className="grid place-items-center"
        >
          {audio ? <Volume2 size={20} strokeWidth={2.5} /> : <VolumeX size={20} strokeWidth={2.5} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5 rounded-xl" aria-label="Buzón del Viejito Pascuero, inicio">
      <span className="grid h-10 w-10 shrink-0 rotate-[-6deg] place-items-center rounded-2xl bg-white sm:h-12 sm:w-12 shadow-[0_6px_14px_-6px_rgb(74_46_30/0.45)] transition-transform duration-300 ease-rebote group-hover:rotate-[6deg] group-hover:scale-110">
        <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden="true">
          <rect x="6" y="14" width="52" height="36" rx="6" fill="#fffdf7" stroke="#a8121f" strokeWidth="4" />
          <path d="M8 17 32 35 56 17" fill="none" stroke="#a8121f" strokeWidth="4" strokeLinejoin="round" />
          <circle cx="32" cy="36" r="9" fill="#e3242f" />
        </svg>
      </span>
      <span className="leading-none">
        <span className="block font-cuento text-base font-extrabold text-rojo sm:text-xl">Buzón del</span>
        <span className="block whitespace-nowrap font-display text-base font-extrabold text-marino sm:text-xl">Viejito Pascuero</span>
      </span>
    </Link>
  );
}

/** Texto del enlace con la pastilla de la opción activa, que se desliza al cambiar de página. */
function NavLabel({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <>
      {active && <motion.span layoutId="nav-activo" transition={springy} className="absolute inset-0 rounded-full bg-marino" aria-hidden="true" />}
      <span className="relative">{children}</span>
    </>
  );
}

/**
 * La página que se va sigue mostrando su propio contenido mientras se despide
 * (si leyera la ruta nueva, la animación de salida mostraría la página equivocada).
 */
function FrozenOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}

function PageFallback() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.15 } }} className="grid min-h-[60vh] place-items-center px-6">
      <SleighLoader progress={66} label="Abriendo la página" />
    </motion.div>
  );
}

export function Layout() {
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const logout = async () => {
    setMenuOpen(false);
    await api.logout().catch(() => undefined);
    setUser(null);
    qc.clear();
    navigate('/');
  };

  const navCls = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'relative rounded-full px-3 py-1.5 text-sm font-extrabold transition-[color,transform] duration-200 ease-rebote hover:-translate-y-0.5',
      isActive ? 'text-white' : 'text-marino hover:bg-cielo-claro',
    );

  return (
    <div className="relative min-h-dvh bg-[linear-gradient(180deg,var(--cielo)_0%,var(--cielo-claro)_55%,#ffffff_100%)] text-marino">
      <a href="#contenido" className="sr-only-focusable fixed left-3 top-3 z-50 rounded-lg bg-oro px-3 py-2 font-bold text-tinta">
        Saltar al contenido
      </a>
      <CssGarland />
      <motion.header
        initial="hidden"
        animate="shown"
        variants={cascade(0.07, 0.05)}
        className="relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-3 pt-9 sm:px-6"
      >
        <motion.div variants={fadeUp}>
          <Logo />
        </motion.div>

        {/* celular y tablet: música a mano y todo lo demás en el menú */}
        <motion.div variants={fadeUp} className="flex shrink-0 items-center gap-2 lg:hidden">
          <MusicQuickButton />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 font-extrabold text-marino shadow-[0_6px_16px_-8px_rgb(74_46_30/0.45)] transition-transform duration-200 ease-rebote active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oro"
          >
            <MenuIcon size={20} strokeWidth={2.5} aria-hidden="true" />
            <span className="max-[359px]:sr-only">Menú</span>
          </button>
        </motion.div>

        {/* escritorio: navegación y ambiente a la vista */}
        <motion.nav variants={fadeUp} layout aria-label="Principal" className="hidden items-center gap-1 rounded-full bg-white/90 p-1 shadow-[0_6px_16px_-8px_rgb(74_46_30/0.4)] lg:flex">
          <NavLink to="/" end className={navCls}>
            {({ isActive }) => <NavLabel active={isActive}>Escribir carta</NavLabel>}
          </NavLink>
          {/* al entrar o salir de la sesión, las opciones cambian con un pequeño salto */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={user ? 'panel' : 'entrar'} {...lifecycle} variants={pop} layout className="flex">
              <NavLink to={user ? '/panel' : '/entrar'} className={navCls}>
                {({ isActive }) => <NavLabel active={isActive}>{user ? 'Panel de ayudantes' : 'Soy papá, mamá o tutor'}</NavLabel>}
              </NavLink>
            </motion.span>
            {user && (
              <motion.span key="salir" {...lifecycle} variants={pop} layout className="flex">
                <button type="button" onClick={logout} className={navCls({ isActive: false }) + ' inline-flex items-center gap-1'}>
                  <LogOut size={14} aria-hidden="true" /> Salir
                </button>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.nav>
        <motion.div variants={fadeUp} className="hidden items-center gap-2 lg:flex">
          <div className="hidden xl:block">
            <PlugSwitch />
          </div>
          <div className="xl:hidden">
            <PlugSwitch compact />
          </div>
          <MusicControl />
          <AudioToggle />
        </motion.div>
      </motion.header>
      <MenuSheet open={menuOpen} onClose={closeMenu} user={!!user} onLogout={logout} />
      <main id="contenido" tabIndex={-1} className="outline-none">
        <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo({ top: 0 })}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
          >
            <RouteErrorBoundary>
              <Suspense fallback={<PageFallback />}>
                <FrozenOutlet />
              </Suspense>
            </RouteErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>
      <motion.footer
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
        viewport={{ once: true, margin: '-40px' }}
        className="relative mt-20 bg-cielo-claro pt-8"
      >
        {/* separador: guirnalda de ampolletas colgando del borde, en sincronía con las luces del taller */}
        <CssGarland count={36} swags={9} sag={7} className="absolute inset-x-0 -top-[3px] z-10" />
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm font-bold text-marino sm:flex-row">
          <p>
            Hecho con cariño en el Polo Norte para los niños y niñas de Chile.
          </p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link className="text-turquesa-oscuro underline-offset-4 hover:underline" to="/privacidad">
              Privacidad y cuidado de datos
            </Link>
          </nav>
        </div>
      </motion.footer>
      <Toaster />
    </div>
  );
}
