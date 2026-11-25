import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Gift, Plus, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { SealButton } from '@/components/ui/SealButton';
import { looksSensitive, writeLetterSchema, type WriteLetterValues } from './schemas';

interface Props {
  disabled: boolean;
  busy: boolean;
  onSubmit: (v: { deseos: string[]; mensaje: string }) => Promise<void>;
}

/** Editor con estilo de papel de carta y letra manuscrita. */
export function WriteLetterForm({ disabled, busy, onSubmit }: Props) {
  const [wish, setWish] = useState('');
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<WriteLetterValues>({
    resolver: zodResolver(writeLetterSchema),
    defaultValues: { deseos: [], mensaje: '' },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'deseos' });
  const mensaje = watch('mensaje');
  const sensitive = looksSensitive(mensaje + ' ' + fields.map((f) => f.value).join(' '));

  const addWish = () => {
    const v = wish.trim();
    if (!v || fields.length >= 20) return;
    append({ value: v.slice(0, 120) });
    setWish('');
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (v) => {
        await onSubmit({ deseos: v.deseos.map((d) => d.value.trim()).filter(Boolean), mensaje: v.mensaje });
        reset();
      })}
      className="space-y-4"
    >
      <Privacy />
      <div className="papel-carta relative rounded-xl border border-marino/20 px-4 pb-6 pl-14 pt-5 shadow-papel">
        <label htmlFor="mensaje" className="font-mano text-3xl font-bold text-rojo-baya">
          Mi carta
        </label>
        <textarea
          id="mensaje"
          rows={7}
          {...register('mensaje')}
          aria-invalid={!!errors.mensaje}
          aria-describedby={errors.mensaje ? 'mensaje-err' : undefined}
          placeholder="Querido Viejito Pascuero: este año me porté…"
          className="mt-1 block w-full resize-y bg-transparent font-mano text-2xl leading-[2.25rem] text-noche placeholder:text-noche/35 focus:outline-none"
        />
        {errors.mensaje && (
          <p id="mensaje-err" className="text-sm font-bold text-rojo-baya">
            {errors.mensaje.message}
          </p>
        )}

        <p className="mt-4 font-mano text-3xl font-bold text-pino" id="deseos-label">
          Mi lista de deseos
        </p>
        <ul aria-labelledby="deseos-label" className="mt-1 flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {fields.map((f, i) => (
              <motion.li
                key={f.id}
                layout
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                className="flex items-center gap-1 rounded-full bg-oro-suave py-1 pl-3 pr-1 font-mano text-xl text-tinta shadow-[0_2px_0_var(--canela),0_10px_18px_-8px_rgb(15_27_61/0.5)]"
              >
                <Gift size={16} className="text-rojo-baya" aria-hidden="true" /> {f.value}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Quitar ${f.value}`}
                  className="rounded-full p-1 hover:bg-white/60"
                >
                  <X size={14} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <div className="mt-2 flex gap-2">
          <label htmlFor="nuevo-deseo" className="sr-only">
            Nuevo deseo
          </label>
          <input
            id="nuevo-deseo"
            value={wish}
            maxLength={120}
            onChange={(e) => setWish(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addWish();
              }
            }}
            placeholder="Una bicicleta roja…"
            className="min-w-0 flex-1 border-b-2 border-dashed border-pino/50 bg-transparent font-mano text-2xl text-noche placeholder:text-noche/35 focus:border-oro focus:outline-none"
          />
          <button
            type="button"
            onClick={addWish}
            disabled={!wish.trim() || fields.length >= 20}
            className="inline-flex items-center gap-1 rounded-full bg-pino px-3 py-1 text-sm font-extrabold text-crema transition-transform duration-200 ease-rebote hover:scale-105 disabled:opacity-50"
          >
            <Plus size={16} aria-hidden="true" /> Agregar
          </button>
        </div>
      </div>

      {sensitive && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-rojo/10 p-3 text-sm font-bold text-rojo-baya">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          Parece que escribiste un teléfono, RUT, dirección o colegio. ¡El Viejito no lo necesita! Los duendes lo
          van a tapar igual, pero mejor bórralo.
        </p>
      )}

      <div className="flex flex-col items-center pb-8 pt-2">
        <SealButton label="Enviar al Polo Norte" busy={busy} disabled={disabled} />
      </div>
    </form>
  );
}

export function Privacy() {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-hielo/60 p-3 text-sm font-semibold text-noche">
      <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        <strong>Truco de duende:</strong> no escribas apellidos, dirección, teléfono ni el nombre de tu colegio. Al
        Viejito Pascuero le basta con tu nombre o apodo.
      </span>
    </p>
  );
}
