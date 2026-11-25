import { clsx } from 'clsx';
import { Bell, BellOff, ChevronRight, KeyRound, LayoutDashboard, LogOut, Mail, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LIGHT_MODES, useLights } from '@/stores/lights';
import { useMusic } from '@/stores/music';
import { SONGS } from '@/lib/music';
import { PlugSwitch } from '@/components/ui/PlugSwitch';
import { MusicPanel } from '@/components/ui/MusicControl';
import { EASE_IN, EASE_OUT, cascade, fadeUp, lifecycle, pop } from '@/lib/motion';

/**
 * Menú del celular y la tablet: una hoja que sube desde abajo (al alcance del pulgar)
 * con la navegación y el ambiente navideño (luces, música y campanitas), todo con nombre.
 * Usa <dialog> nativo: atrapa el foco, cierra con Escape y deja el fondo inerte.
 */
export function MenuSheet({ open, onClose, user, onLogout }: { open: boolean; onClose: () => void; user: boolean; onLogout: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();
  const controls = useAnimationControls();
  const reduced = useReducedMotion();

  // abrir: la hoja sube (o baja, en tablet) y su contenido entra en cascada;
  // cerrar: primero se despide la hoja y el fondo se aclara, recién entonces se cierra el <dialog>
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const sheet = !window.matchMedia('(min-width: 640px)').matches;
    const off = reduced ? { opacity: 0 } : sheet ? { y: '100%', opacity: 1 } : { y: -16, scale: 0.97, opacity: 0 };
    let cancelled = false;
    if (open && !d.open) {
      controls.set(off);
      d.removeAttribute('data-cerrando');
      d.showModal();
      document.documentElement.style.overflow = 'hidden';
      void controls.start({ y: 0, scale: 1, opacity: 1, transition: { duration: sheet ? 0.42 : 0.3, ease: EASE_OUT } });
    } else if (!open && d.open) {
      d.setAttribute('data-cerrando', '');
      void controls.start({ ...off, transition: { duration: 0.22, ease: EASE_IN } }).then(() => {
        if (cancelled) return;
        d.close();
        d.removeAttribute('data-cerrando');
      });
      document.documentElement.style.overflow = '';
    }
    return () => {
      cancelled = true;
    };
  }, [open, controls, reduced]);

  // al navegar, el menú se cierra
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    // el clic en el fondo es un atajo de mouse/dedo: con teclado, Escape cierra (nativo de <dialog>)
    <motion.dialog
      ref={ref}
      animate={controls}
      aria-labelledby="menu-titulo"
      onClose={onClose}
      onCancel={(e) => {
        // Escape: se anima la salida en vez de cerrar de golpe
        e.preventDefault();
        onClose();
      }}
      // tocar el fondo oscuro cierra
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="menu-hoja m-0 mt-auto border-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[1.75rem] bg-[#fbf6ec] p-0 text-tinta shadow-[0_-18px_40px_-12px_rgb(15_27_61/0.45)] backdrop:bg-[rgb(15_27_61/0.45)] sm:ml-auto sm:mr-4 sm:mt-24 sm:max-h-[calc(100dvh-7rem)] sm:w-[380px] sm:rounded-[1.75rem]"
    >
      <motion.div
        key={open ? 'abierto' : 'cerrado'}
        initial="hidden"
        animate={open ? 'shown' : 'hidden'}
        variants={cascade(0.045, 0.08)}
        className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
      >
        <span aria-hidden="true" className="mx-auto mb-2 block h-1.5 w-12 rounded-full bg-[#d8c3a0] sm:hidden" />
        <motion.div variants={fadeUp} className="flex items-center justify-between">
          <h2 id="menu-titulo" className="font-cuento text-3xl text-rojo">
            Menú
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="grid h-11 w-11 place-items-center rounded-full bg-white text-marino shadow-papel transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oro"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </motion.div>

        <motion.nav variants={fadeUp} aria-label="Principal" className="mt-3">
          <motion.ul layout className="overflow-hidden rounded-2xl bg-white shadow-[0_6px_16px_-10px_rgb(74_46_30/0.5)]">
            <MenuLink to="/" end icon={<Mail size={20} aria-hidden="true" />} label="Escribir carta" hint="Para el Viejito Pascuero" />
            <AnimatePresence initial={false} mode="wait">
              {user ? (
                <MenuLink key="panel" to="/panel" icon={<LayoutDashboard size={20} aria-hidden="true" />} label="Panel de ayudantes" hint="Cartas, regalos y trayecto" />
              ) : (
                <MenuLink key="entrar" to="/entrar" icon={<KeyRound size={20} aria-hidden="true" />} label="Soy papá, mamá o tutor" hint="Entrar o crear tu credencial" />
              )}
            </AnimatePresence>
            <MenuLink to="/privacidad" icon={<ShieldCheck size={20} aria-hidden="true" />} label="Privacidad" hint="Cómo cuidamos las cartas" />
            <AnimatePresence initial={false}>
            {user && (
              <motion.li key="salir" {...lifecycle} variants={pop} layout>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex min-h-[56px] w-full items-center gap-3 border-t border-[#efe4cf] px-4 py-2 text-left font-extrabold text-rojo-baya transition-colors hover:bg-[#fdf1ee] focus-visible:bg-[#fdf1ee] focus-visible:outline-none"
                >
                  <LogOut size={20} aria-hidden="true" />
                  Salir
                </button>
              </motion.li>
            )}
            </AnimatePresence>
          </motion.ul>
        </motion.nav>

        <motion.h3 variants={fadeUp} className="mb-2 mt-6 font-display text-lg font-extrabold text-marino">
          Ambiente navideño
        </motion.h3>
        <div className="space-y-3">
          <motion.div variants={fadeUp}>
            <Lights />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MusicSection />
          </motion.div>
          <motion.div variants={fadeUp}>
            <BellsRow />
          </motion.div>
        </div>
      </motion.div>
    </motion.dialog>
  );
}

function MenuLink({ to, end, icon, label, hint }: { to: string; end?: boolean; icon: ReactNode; label: string; hint: string }) {
  return (
    <motion.li layout {...lifecycle} variants={pop} className="border-t border-[#efe4cf] first:border-t-0">
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          clsx(
            'flex min-h-[56px] items-center gap-3 px-4 py-2 transition-colors focus-visible:outline-none',
            isActive ? 'bg-marino text-white' : 'text-marino hover:bg-cielo-claro focus-visible:bg-cielo-claro',
          )
        }
      >
        {({ isActive }) => (
          <>
            <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-full', isActive ? 'bg-white/15' : 'bg-cielo-claro')}>{icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold leading-tight">{label}</span>
              <span className={clsx('block text-xs font-semibold', isActive ? 'text-white/80' : 'text-tinta-suave')}>{hint}</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" className={isActive ? 'text-white/70' : 'text-[#c7b08b]'} />
          </>
        )}
      </NavLink>
    </motion.li>
  );
}

function Lights() {
  const mode = useLights((s) => s.mode);
  const lastOnMode = useLights((s) => s.lastOnMode);
  const setMode = useLights((s) => s.setMode);
  const on = mode !== 'off';
  return (
    <section aria-labelledby="menu-luces" className="rounded-2xl bg-white p-4 shadow-[0_6px_16px_-10px_rgb(74_46_30/0.5)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p id="menu-luces" className="font-extrabold text-marino">
            Luces del taller
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={on ? 'on' : 'off'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
              className="text-xs font-semibold text-tinta-suave"
            >
              {on ? 'Encendidas' : 'Apagadas: mueve la palanca'}
            </motion.p>
          </AnimatePresence>
        </div>
        <PlugSwitch leverOnly />
      </div>
      <div role="radiogroup" aria-label="Cómo brillan las luces" className="mt-3 grid grid-cols-3 gap-1.5">
        {LIGHT_MODES.map((m) => {
          const selected = on ? mode === m.id : lastOnMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMode(m.id)}
              className={clsx(
                'relative min-h-[44px] rounded-xl bg-[#f6efe2] px-2 py-1.5 text-xs font-extrabold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oro',
                selected ? 'text-tinta' : 'text-marino hover:bg-cielo-claro',
              )}
            >
              {selected && <motion.span layoutId="menu-luz-activa" className="absolute inset-0 rounded-xl bg-oro" transition={{ type: 'spring', stiffness: 420, damping: 32 }} aria-hidden="true" />}
              <span className="relative">{m.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MusicSection() {
  const playing = useMusic((s) => s.playing);
  const index = useMusic((s) => s.index);
  return (
    <section aria-labelledby="menu-musica" className="rounded-2xl bg-white p-4 shadow-[0_6px_16px_-10px_rgb(74_46_30/0.5)]">
      <p id="menu-musica" className="font-extrabold text-marino">
        Música
      </p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={playing ? `s${index}` : 'pausa'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className="mb-2 text-xs font-semibold text-tinta-suave"
        >
          {playing ? `Sonando: ${SONGS[index]!.title}` : 'Toca un villancico para escucharlo'}
        </motion.p>
      </AnimatePresence>
      <MusicPanel />
    </section>
  );
}

function BellsRow() {
  const audio = useLights((s) => s.audio);
  const setAudio = useLights((s) => s.setAudio);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={audio}
      onClick={() => setAudio(!audio)}
      className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-[0_6px_16px_-10px_rgb(74_46_30/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oro"
    >
      <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-full', audio ? 'bg-rojo text-white' : 'bg-[#f6efe2] text-marino')}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={audio ? 'on' : 'off'}
            initial={{ rotate: -30, scale: 0.6, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 30, scale: 0.6, opacity: 0, transition: { duration: 0.1 } }}
            className="grid place-items-center"
          >
            {audio ? <Bell size={18} aria-hidden="true" /> : <BellOff size={18} aria-hidden="true" />}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold text-marino">Sonidos de campanitas</span>
        <span className="block text-xs font-semibold text-tinta-suave">Al encender las luces y en cada parada del trineo</span>
      </span>
      <span aria-hidden="true" className={clsx('relative h-7 w-12 shrink-0 rounded-full transition-colors', audio ? 'bg-muerdago' : 'bg-[#d8c3a0]')}>
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
          className={clsx('absolute top-1 h-5 w-5 rounded-full bg-white shadow', audio ? 'left-6' : 'left-1')}
        />
      </span>
    </button>
  );
}
