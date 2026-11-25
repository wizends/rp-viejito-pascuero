import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { LIGHT_MODES, useLights } from '@/stores/lights';

/**
 * Interruptor de luces: palanca de bastón de caramelo con pomo de bolita roja.
 * Se inclina a la derecha al encender y la ranura se ilumina con ampolletas.
 * Estilos en `styles/index.css` (`.palanca*`).
 */
export function PlugSwitch({ compact = false, leverOnly = false }: { compact?: boolean; leverOnly?: boolean }) {
  const mode = useLights((s) => s.mode);
  const lastOnMode = useLights((s) => s.lastOnMode);
  const toggle = useLights((s) => s.toggle);
  const setMode = useLights((s) => s.setMode);
  const on = mode !== 'off';

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? 'Apagar las luces navideñas' : 'Encender las luces navideñas'}
        onClick={toggle}
        className="palanca shrink-0"
      >
        {/* palanca de bastón de caramelo con pomo de bolita roja, sobre una ranura de pino */}
        <span className="palanca-mango-marco" aria-hidden="true">
          <span className="palanca-mango">
            <span className="palanca-pomo" />
            <span className="palanca-barra-marco">
              <span className="palanca-barra" />
            </span>
          </span>
        </span>
        <span className="palanca-base" aria-hidden="true">
          <span className="palanca-ranura" />
        </span>
      </button>
      {compact && !leverOnly && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.85, rotate: 120 }}
          onClick={() => {
            const i = LIGHT_MODES.findIndex((m) => m.id === lastOnMode);
            setMode(LIGHT_MODES[(i + 1) % LIGHT_MODES.length]!.id);
          }}
          aria-label={`Modo de luces: ${LIGHT_MODES.find((m) => m.id === lastOnMode)?.label}. Cambiar modo`}
          title="Cambiar modo de luces"
          className="grid h-11 w-11 place-items-center rounded-full bg-oro text-marino shadow-[0_6px_14px_-4px_rgb(224_165_58/0.8)]"
        >
          <motion.span key={lastOnMode} initial={{ rotate: -90, scale: 0.5 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 14 }} className="grid place-items-center">
            <Sparkles size={18} aria-hidden="true" />
          </motion.span>
        </motion.button>
      )}
      {!compact && !leverOnly && (
        <div role="radiogroup" aria-label="Modo de las luces" className="flex gap-1">
          {LIGHT_MODES.map((m) => {
            const selected = on ? mode === m.id : lastOnMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(m.id)}
                title={m.label}
                className={clsx(
                  'relative rounded-full bg-white px-2.5 py-1 text-xs font-bold shadow-[0_3px_8px_-4px_rgb(74_46_30/0.4)] transition-colors duration-200',
                  selected ? 'text-tinta' : 'text-marino hover:bg-cielo-claro',
                )}
              >
                {selected && <motion.span layoutId="modo-luces" className="absolute inset-0 rounded-full bg-oro shadow-brillo" transition={{ type: 'spring', stiffness: 420, damping: 32 }} aria-hidden="true" />}
                <span className="relative">{m.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
