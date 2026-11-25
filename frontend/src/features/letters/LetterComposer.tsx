import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Feather, Lock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import type { Letter } from '@/lib/types';
import { useScene } from '@/stores/scene';
import { useSession } from '@/stores/session';
import { toast } from '@/components/ui/Toast';
import { ChildPicker } from './ChildPicker';
import { WriteLetterForm } from './WriteLetterForm';
import { UploadLetterForm } from './UploadLetterForm';

type Tab = 'escribir' | 'foto';

/** Tarjeta principal para escribir o subir la carta. */
export function LetterComposer({ reduced }: { reduced: boolean }) {
  const [tab, setTab] = useState<Tab>('escribir');
  const user = useSession((s) => s.user);
  const checked = useSession((s) => s.checked);
  const [childId, setChildId] = useState<string | null>(null);
  const qc = useQueryClient();
  const sendLetter = useScene((s) => s.sendLetter);

  const children = useQuery({ queryKey: ['children'], queryFn: api.children, enabled: !!user });
  const effectiveChild = childId ?? children.data?.[0]?.id ?? null;

  const onSent = (letter: Letter) => {
    sendLetter(letter.id);
    void qc.invalidateQueries({ queryKey: ['letters'] });
    toast('¡Carta lacrada y enviada! Mira cómo vuela al Polo Norte.');
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  };

  const write = useMutation({
    mutationFn: (v: { deseos: string[]; mensaje: string }) => api.writeLetter(effectiveChild!, v.deseos, v.mensaje),
    onSuccess: onSent,
    onError: (e: Error) => toast(e.message, 'error'),
  });
  const upload = useMutation({
    mutationFn: (v: { file: Blob; mensaje: string }) => api.uploadLetter(effectiveChild!, v.file, v.mensaje),
    onSuccess: onSent,
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const locked = checked && !user;

  return (
    <div className="papel-kraft relative rounded-galleta p-4 text-tinta shadow-papel sm:p-8">
      {/* sellos decorativos */}
      <div aria-hidden="true" className="sello-postal absolute -right-2 -top-4 hidden rotate-6 sm:block">
        <div className="grid h-20 w-16 place-items-center bg-rojo text-center font-cuento text-sm leading-tight text-crema">
          Polo
          <br />
          Norte
        </div>
      </div>
      <h2 id="carta-titulo" className="font-cuento text-4xl text-rojo-baya sm:text-5xl">
        Querido Viejito Pascuero…
      </h2>
      <p className="mt-1 font-bold text-tinta-suave">Elige cómo quieres mandar tu carta:</p>

      <div role="tablist" aria-label="Forma de enviar la carta" className="mt-4 flex gap-2">
        {(
          [
            ['escribir', 'Escribirla aquí', <Feather key="f" size={18} aria-hidden="true" />],
            ['foto', 'Subir una foto', <Camera key="c" size={18} aria-hidden="true" />],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            role="tab"
            type="button"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-t-2xl border-2 border-b-0 px-4 py-2 font-display font-extrabold transition-all duration-200 ease-rebote',
              tab === id
                ? 'translate-y-0 border-kraft-oscuro bg-crema text-rojo-baya'
                : 'translate-y-1 border-transparent bg-kraft-oscuro/30 text-tinta hover:-translate-y-0',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-b-2xl rounded-tr-2xl border-2 border-kraft-oscuro bg-crema/60 p-3 sm:p-5">
        {locked ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border-2 border-dashed border-rojo/50 bg-white/70 p-4 sm:flex-row sm:items-center">
            <Lock className="shrink-0 text-rojo" aria-hidden="true" />
            <p className="flex-1 text-sm font-bold">
              Para enviar la carta, pídele a tu papá, mamá o tutor que abra su{' '}
              <strong>credencial de ayudante del Viejito</strong>. Así tu carta queda guardada solo para tu familia.
            </p>
            <div className="flex gap-2">
              <Link to="/entrar" className="rounded-full bg-rojo px-4 py-1.5 font-display text-sm font-extrabold text-white shadow-[0_4px_0_var(--rojo-baya),0_10px_18px_-8px_rgb(15_27_61/0.5)] transition-all duration-200 ease-rebote hover:-translate-y-0.5 hover:shadow-[0_4px_0_var(--rojo-baya),0_10px_18px_-8px_rgb(15_27_61/0.5),0_0_22px_4px_rgb(232_185_49/0.55)]">
                Entrar
              </Link>
              <Link to="/registro" className="rounded-full bg-crema px-4 py-1.5 font-display text-sm font-extrabold text-tinta shadow-[0_4px_0_var(--kraft-oscuro),0_10px_18px_-8px_rgb(15_27_61/0.5)] transition-all duration-200 ease-rebote hover:-translate-y-0.5 hover:shadow-[0_4px_0_var(--kraft-oscuro),0_10px_18px_-8px_rgb(15_27_61/0.5),0_0_20px_3px_rgb(232_185_49/0.55)]">
                Crear credencial
              </Link>
            </div>
          </div>
        ) : user ? (
          <ChildPicker children={children.data ?? []} value={effectiveChild} onChange={setChildId} loading={children.isLoading} />
        ) : null}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            id={`panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            initial={reduced ? false : { opacity: 0, x: tab === 'foto' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? undefined : { opacity: 0, x: tab === 'foto' ? -20 : 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="mt-4"
          >
            {tab === 'escribir' ? (
              <WriteLetterForm
                disabled={!user || !effectiveChild}
                busy={write.isPending}
                onSubmit={(v) => write.mutateAsync(v).then(() => undefined)}
              />
            ) : (
              <UploadLetterForm
                disabled={!user || !effectiveChild}
                busy={upload.isPending}
                externalAi={!!user?.allow_external_ai}
                onSubmit={(v) => upload.mutateAsync(v).then(() => undefined)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
