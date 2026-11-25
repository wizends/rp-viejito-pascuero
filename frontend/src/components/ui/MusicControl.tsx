import { clsx } from 'clsx';
import { ChevronDown, Music, Pause, Play, SkipForward } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { SONGS } from '@/lib/music';
import { useMusic } from '@/stores/music';

const pinoShadow = 'shadow-[0_6px_14px_-4px_rgb(18_50_34/0.6)]';

/** Play/pausa de la música, solo el botón redondo (encabezado compacto). */
export function MusicQuickButton({ className }: { className?: string }) {
  const { playing, index, toggle } = useMusic();
  const song = SONGS[index]!;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={playing}
      aria-label={playing ? `Pausar música: ${song.title}` : 'Poner música navideña'}
      title={playing ? song.title : 'Música navideña'}
      className={clsx(
        'grid h-11 w-11 place-items-center rounded-full bg-pino text-crema transition-transform duration-300 ease-rebote hover:scale-105 active:scale-95',
        pinoShadow,
        className,
      )}
    >
      {playing ? <Equalizer /> : <Music size={19} strokeWidth={2.5} aria-hidden="true" />}
    </button>
  );
}

/** Lista de villancicos, siguiente y volumen. Va en el desplegable y en el menú del celular. */
export function MusicPanel({ compact = false }: { compact?: boolean }) {
  const { playing, index, volume, toggle, playSong, next, setVolume } = useMusic();
  return (
    <div>
      <ol className="space-y-1">
        {SONGS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => (i === index && playing ? toggle() : playSong(i))}
              aria-current={i === index ? 'true' : undefined}
              className={clsx(
                'flex w-full items-center gap-2.5 rounded-xl px-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oro',
                compact ? 'py-1.5' : 'min-h-[48px] py-2',
                i === index ? 'bg-oro-suave' : 'hover:bg-cielo-claro',
              )}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pino text-crema">
                {i === index && playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold text-tinta">{s.title}</span>
                <span className="block truncate text-xs font-semibold text-tinta-suave">{s.origin}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={next}
          aria-label="Siguiente villancico"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-crema text-marino shadow-papel transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oro"
        >
          <SkipForward size={17} aria-hidden="true" />
        </button>
        <label className="flex flex-1 items-center gap-2 text-xs font-extrabold text-tinta">
          Volumen
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-2 flex-1 accent-[var(--verde-muerdago)]"
          />
        </label>
      </div>
      <p className="mt-2 text-xs font-semibold leading-snug text-tinta-suave">
        Villancicos tradicionales de dominio público, tocados por tu navegador como una caja musical.
      </p>
    </div>
  );
}

/** Escritorio: play/pausa con un desplegable para elegir villancico y volumen. */
export function MusicControl() {
  const { playing, index, toggle } = useMusic();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const song = SONGS[index]!;

  return (
    <div ref={box} className="relative flex items-center">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? `Pausar música: ${song.title}` : 'Poner música navideña'}
        title={playing ? song.title : 'Música navideña'}
        className={clsx(
          'grid h-11 w-11 place-items-center rounded-l-full bg-pino pl-1 text-crema transition-transform duration-300 ease-rebote hover:scale-105 active:scale-95',
          pinoShadow,
        )}
      >
        {playing ? <Equalizer /> : <Music size={19} strokeWidth={2.5} aria-hidden="true" />}
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Elegir villancico y volumen"
        className={clsx('grid h-11 w-7 place-items-center rounded-r-full border-l border-crema/25 bg-pino pr-1 text-crema transition-colors hover:bg-[#245c36]', pinoShadow)}
      >
        <ChevronDown size={16} strokeWidth={2.5} aria-hidden="true" className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div id={panelId} className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl bg-white p-3 text-tinta shadow-papel ring-1 ring-black/5">
          <p className="mb-2 font-display text-base font-extrabold">Música navideña</p>
          <MusicPanel compact />
        </div>
      )}
    </div>
  );
}

/** Barritas que bailan mientras suena la música. */
export function Equalizer() {
  return (
    <span className="flex h-5 items-end gap-[3px]" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[4px] origin-bottom rounded-full bg-crema motion-safe:animate-[ecualizador_0.9s_ease-in-out_infinite]"
          style={{ height: `${[60, 100, 75][i]}%`, animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}
