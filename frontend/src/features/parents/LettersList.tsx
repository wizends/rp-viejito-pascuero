import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Gift, Image as ImageIcon, Lock, Pencil, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Collapse, Swap, cascade, fade, fadeUp, lifecycle, listItem, pop } from '@/lib/motion';
import { api } from '@/lib/api';
import type { GiftInput, Letter, LetterStatus } from '@/lib/types';
import { MagicButton } from '@/components/ui/MagicButton';
import { toast } from '@/components/ui/Toast';

const STATUS: Record<LetterStatus, { label: string; cls: string }> = {
  recibida: { label: 'Recibida', cls: 'bg-hielo text-noche' },
  leyendo: { label: 'Leyendo…', cls: 'bg-oro-suave text-tinta animate-latido' },
  leida: { label: '¡Leída!', cls: 'bg-muerdago text-white' },
  necesita_ayuda: { label: 'Necesita ayuda de un duende', cls: 'bg-rojo text-white' },
};

const METODO: Record<string, string> = {
  ia: 'Transcrita con IA',
  manual: 'Transcrita a mano',
  escrita: 'Escrita en la web',
};

export function LettersList({ childId }: { childId: string }) {
  const q = useQuery({ queryKey: ['letters', childId], queryFn: () => api.letters(childId) });
  const state = q.isLoading ? 'cargando' : q.data?.length ? 'lista' : 'vacio';
  return (
    <Swap id={state} variants={state === 'cargando' ? fade : fadeUp}>
      {state === 'cargando' ? (
        <p className="font-bold text-marino">Buscando cartas en el buzón…</p>
      ) : state === 'vacio' ? (
        <div className="papel-crema rounded-galleta p-8 text-center text-tinta shadow-papel">
          <p className="font-cuento text-3xl text-rojo-baya">El buzón está vacío</p>
          <p className="mt-2 font-semibold">Cuando llegue una carta, aparecerá aquí con su transcripción.</p>
        </div>
      ) : (
        <motion.ul initial="hidden" animate="shown" variants={cascade(0.07)} className="space-y-4">
          <AnimatePresence>
            {q.data!.map((l) => (
              <LetterCard key={`${l.id}-${l.status}`} letter={l} />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </Swap>
  );
}

function LetterCard({ letter }: { letter: Letter }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(letter.status === 'necesita_ayuda');
  const [texto, setTexto] = useState(letter.texto_normalizado || letter.texto_original);
  const [gifts, setGifts] = useState<GiftInput[]>(letter.gifts.map(({ nombre, prioridad, marcado }) => ({ nombre, prioridad, marcado })));
  const [newGift, setNewGift] = useState('');
  const st = STATUS[letter.status];

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof api.updateLetter>[1]) => api.updateLetter(letter.id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['letters'] });
      toast('Carta actualizada.');
      setEditing(false);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });
  const del = useMutation({
    mutationFn: () => api.deleteLetter(letter.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['letters'] }),
  });

  const toggleGift = (i: number) => {
    const next = gifts.map((g, k) => (k === i ? { ...g, marcado: !g.marcado } : g));
    setGifts(next);
    save.mutate({ gifts: next });
  };

  return (
    <motion.li layout variants={listItem} exit="gone" className="papel-crema overflow-hidden rounded-[1.4rem] text-tinta shadow-papel">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-dashed border-marino/20 px-4 py-3">
        {/* el estado salta al cambiar (recibida → leyendo → ¡leída!) */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={letter.status} {...lifecycle} variants={pop} className={clsx('rounded-full px-3 py-0.5 text-xs font-extrabold', st.cls)}>
            {st.label}
          </motion.span>
        </AnimatePresence>
        <span className="text-xs font-bold text-tinta-suave">
          {new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' }).format(new Date(letter.created_at))}
          {letter.metodo ? ` · ${METODO[letter.metodo] ?? letter.metodo}` : ''}
          {letter.confianza != null && letter.metodo !== 'escrita' ? ` · confianza ${Math.round(letter.confianza * 100)}%` : ''}
        </span>
        {letter.pii_masked && (
          <span className="rounded-full bg-hielo px-2 py-0.5 text-xs font-bold text-noche" title="Se taparon datos sensibles">
            <Lock size={12} className="mr-1 inline" aria-hidden="true" />Datos protegidos
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {(letter.has_image || letter.texto_original || letter.texto_normalizado || letter.mensaje) && (
            <Link
              to={`/postal/${letter.id}`}
              className="mr-1 inline-flex items-center gap-1.5 rounded-full bg-oro px-3 py-1 text-xs font-extrabold text-tinta shadow-[0_3px_0_var(--canela)] transition-transform hover:scale-105"
            >
              <ImageIcon size={14} aria-hidden="true" /> Crear postal
            </Link>
          )}
          <button type="button" onClick={() => setEditing((e) => !e)} className="rounded-full p-2 hover:bg-kraft/40" aria-label="Editar transcripción">
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-rojo-baya hover:bg-kraft/40"
            aria-label="Borrar carta"
            onClick={() => window.confirm('¿Borrar esta carta? No se puede deshacer.') && del.mutate()}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[1fr_240px]">
        <div>
          <Collapse show={letter.status === 'necesita_ayuda'}>
            <p className="mb-3 flex items-start gap-2 rounded-xl bg-rojo/10 p-3 text-sm font-bold text-rojo-baya">
              <TriangleAlert size={18} className="shrink-0" aria-hidden="true" />
              Los duendes no lograron leer esta letra. ¿Nos ayudas a transcribirla?
            </p>
          </Collapse>
          <Collapse show={letter.source === 'foto' && !letter.texto_original && letter.status !== 'necesita_ayuda'}>
            <p className="mb-3 rounded-xl bg-hielo/60 p-3 text-sm font-bold text-noche">
              Llegó como foto. Si quieres, transcríbela con el lápiz para armar la lista de regalos.
            </p>
          </Collapse>
          {letter.has_image && <LetterPhoto id={letter.id} />}
          <Swap id={editing ? 'editando' : 'leyendo'} variants={fadeUp}>
          {editing ? (
            <div>
              <label htmlFor={`t-${letter.id}`} className="text-sm font-extrabold">
                Transcripción
              </label>
              <textarea
                id={`t-${letter.id}`}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={6}
                className="papel-carta mt-1 w-full rounded-xl border-2 border-marino/20 p-3 pl-12 font-mano text-xl leading-[2.25rem] focus:border-oro focus:outline-none"
              />
              <div className="mt-2 flex gap-2">
                <MagicButton size="sm" variant="pino" icon={<Check size={16} />} disabled={save.isPending} onClick={() => save.mutate({ texto_original: letter.texto_original || texto, texto_normalizado: texto, gifts })}>
                  Guardar transcripción
                </MagicButton>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap font-mano text-2xl leading-snug text-noche">
              {letter.texto_normalizado || letter.texto_original || <span className="text-tinta-suave">(sin texto aún)</span>}
            </p>
          )}
          </Swap>
          <Collapse show={!!letter.texto_original && letter.texto_original !== letter.texto_normalizado && !editing}>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-bold text-tinta-suave">Ver ortografía original</summary>
              <p className="mt-1 whitespace-pre-wrap font-mano text-xl">{letter.texto_original}</p>
            </details>
          </Collapse>
        </div>

        <div>
          <p className="flex items-center gap-1 font-display font-extrabold">
            <Sparkles size={16} className="text-canela" aria-hidden="true" /> Lista de regalos
          </p>
          <p className="text-xs text-tinta-suave">Marca los que el Viejito va a traer.</p>
          <motion.ul layout className="mt-2 space-y-1.5">
            <AnimatePresence initial={false}>
            {gifts.map((g, i) => (
              <motion.li key={`${g.nombre}-${i}`} layout {...lifecycle} variants={listItem}>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-white/70 px-2 py-1.5 text-sm font-bold">
                  <input type="checkbox" checked={g.marcado} onChange={() => toggleGift(i)} className="h-4 w-4 accent-[var(--rojo-pascuero)]" />
                  <span className={clsx('transition-colors', g.marcado && 'text-pino')}>{g.nombre}</span>
                  <AnimatePresence initial={false}>
                    {g.marcado && (
                      <motion.span key="regalo" {...lifecycle} variants={pop} className="grid place-items-center">
                        <Gift size={14} className="text-rojo" aria-hidden="true" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </label>
              </motion.li>
            ))}
            </AnimatePresence>
          </motion.ul>
          <form
            className="mt-2 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const v = newGift.trim();
              if (!v) return;
              const next = [...gifts, { nombre: v, prioridad: null, marcado: false }];
              setGifts(next);
              setNewGift('');
              save.mutate({ gifts: next });
            }}
          >
            <label className="sr-only" htmlFor={`g-${letter.id}`}>
              Agregar regalo
            </label>
            <input id={`g-${letter.id}`} value={newGift} maxLength={120} onChange={(e) => setNewGift(e.target.value)} placeholder="Agregar regalo" className="min-w-0 flex-1 rounded-lg border-2 border-marino/20 px-2 py-1 text-sm focus:border-oro focus:outline-none" />
            <button type="submit" className="rounded-lg bg-pino px-2 text-sm font-extrabold text-crema">
              +
            </button>
          </form>
        </div>
      </div>
    </motion.li>
  );
}

/** La foto de la carta aparece con un fundido cuando terminó de cargar (no a medio dibujar). */
function LetterPhoto({ id }: { id: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <motion.img
      src={`/api/letters/${id}/image`}
      alt="Foto de la carta enviada"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={loaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onLoad={() => setLoaded(true)}
      className="mb-3 max-h-80 w-full rounded-xl object-contain ring-1 ring-marino/20"
      loading="lazy"
    />
  );
}
