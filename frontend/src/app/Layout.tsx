import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Menu as MenuIcon, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useLights } from '@/stores/lights';
import { useSession } from '@/stores/session';
import { CssGarland } from '@/components/ui/CssGarland';
import { PlugSwitch } from '@/components/ui/PlugSwitch';
import { MusicControl, MusicQuickButton } from '@/components/ui/MusicControl';
import { MenuSheet } from './MenuSheet';
import { Toaster } from '@/components/ui/Toast';

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
      {audio ? <Volume2 size={20} strokeWidth={2.5} /> : <VolumeX size={20} strokeWidth={2.5} />}
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

export function Layout() {
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
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
      'rounded-full px-3 py-1.5 text-sm font-extrabold transition-all duration-200 ease-rebote hover:-translate-y-0.5',
      isActive ? 'bg-marino text-white' : 'text-marino hover:bg-cielo-claro',
    );

  return (
    <div className="relative min-h-dvh bg-[linear-gradient(180deg,var(--cielo)_0%,var(--cielo-claro)_55%,#ffffff_100%)] text-marino">
      <a href="#contenido" className="sr-only-focusable fixed left-3 top-3 z-50 rounded-lg bg-oro px-3 py-2 font-bold text-tinta">
        Saltar al contenido
      </a>
      <CssGarland />
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-3 pt-9 sm:px-6">
        <Logo />

        {/* celular y tablet: música a mano y todo lo demás en el menú */}
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
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
        </div>

        {/* escritorio: navegación y ambiente a la vista */}
        <nav aria-label="Principal" className="hidden items-center gap-1 rounded-full bg-white/90 p-1 shadow-[0_6px_16px_-8px_rgb(74_46_30/0.4)] lg:flex">
          <NavLink to="/" end className={navCls}>
            Escribir carta
          </NavLink>
          {user ? (
            <NavLink to="/panel" className={navCls}>
              Panel de ayudantes
            </NavLink>
          ) : (
            <NavLink to="/entrar" className={navCls}>
              Soy papá, mamá o tutor
            </NavLink>
          )}
          {user && (
            <button type="button" onClick={logout} className={navCls({ isActive: false }) + ' inline-flex items-center gap-1'}>
              <LogOut size={14} aria-hidden="true" /> Salir
            </button>
          )}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <div className="hidden xl:block">
            <PlugSwitch />
          </div>
          <div className="xl:hidden">
            <PlugSwitch compact />
          </div>
          <MusicControl />
          <AudioToggle />
        </div>
      </header>
      <MenuSheet open={menuOpen} onClose={closeMenu} user={!!user} onLogout={logout} />
      <main id="contenido" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <footer className="relative mt-20 bg-cielo-claro pt-8">
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
      </footer>
      <Toaster />
    </div>
  );
}
