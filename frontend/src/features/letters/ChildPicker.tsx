import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { AVATARS, type Avatar as AvatarId, type Child } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { MagicButton } from '@/components/ui/MagicButton';
import { toast } from '@/components/ui/Toast';

interface Props {
  children: Child[];
  value: string | null;
  onChange: (id: string) => void;
  loading?: boolean;
}

/** "¿Quién escribe?" — tarjetas con avatar de duende o reno. */
export function ChildPicker({ children, value, onChange, loading }: Props) {
  const [adding, setAdding] = useState(false);
  const empty = !loading && children.length === 0;
  return (
    <fieldset>
      <legend className="font-display text-lg font-extrabold">¿Quién escribe la carta?</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {children.map((c) => (
          <label
            key={c.id}
            className={clsx(
              'flex cursor-pointer items-center gap-2 rounded-2xl border-2 bg-white/80 py-1 pl-1 pr-4 font-bold transition-all duration-200 ease-rebote has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-oro',
              value === c.id ? 'scale-105 border-rojo shadow-brillo' : 'border-marino/20 hover:-translate-y-0.5',
            )}
          >
            <input type="radio" name="child" value={c.id} checked={value === c.id} onChange={() => onChange(c.id)} className="sr-only" />
            <Avatar id={c.avatar} size={40} />
            {c.nickname}
          </label>
        ))}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-2xl border-2 border-dashed border-kraft-oscuro px-3 py-2 text-sm font-extrabold text-tinta-suave transition-colors hover:border-rojo hover:text-rojo"
          >
            <Plus size={16} aria-hidden="true" /> {empty ? 'Agregar al primer niño o niña' : 'Agregar otro'}
          </button>
        )}
      </div>
      {adding && <QuickChild onDone={(id) => (setAdding(false), id && onChange(id))} />}
    </fieldset>
  );
}

function QuickChild({ onDone }: { onDone: (id?: string) => void }) {
  const qc = useQueryClient();
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>('duende_rojo');
  const create = useMutation({
    mutationFn: () => api.createChild({ nickname: nickname.trim(), avatar }),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['children'] });
      toast(`¡${c.nickname} ya es parte del taller!`);
      onDone(c.id);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });
  return (
    <div className="mt-3 rounded-2xl border-2 border-marino/20 bg-white/80 p-3">
      <label className="block text-sm font-extrabold" htmlFor="quick-nick">
        Nombre o apodo (sin apellidos)
      </label>
      <input
        id="quick-nick"
        value={nickname}
        maxLength={40}
        onChange={(e) => setNickname(e.target.value)}
        className="mt-1 w-full rounded-xl border-2 border-marino/20 px-3 py-2 focus:border-oro focus:outline-none focus:ring-4 focus:ring-oro-suave/60"
        placeholder="Ej: Sofi, Benja, Tomi"
      />
      <p className="mt-3 text-sm font-extrabold" id="avatar-label">
        Elige su avatar
      </p>
      <div role="radiogroup" aria-labelledby="avatar-label" className="mt-1 flex flex-wrap gap-2">
        {AVATARS.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={avatar === a}
            onClick={() => setAvatar(a)}
            className={clsx('rounded-full p-0.5 transition-transform duration-200 ease-rebote', avatar === a ? 'scale-110 ring-4 ring-oro' : 'hover:scale-105')}
          >
            <Avatar id={a} size={44} />
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <MagicButton size="sm" variant="pino" disabled={!nickname.trim() || create.isPending} onClick={() => create.mutate()}>
          Guardar
        </MagicButton>
        <MagicButton size="sm" variant="fantasma" className="text-tinta" onClick={() => onDone()}>
          Cancelar
        </MagicButton>
      </div>
    </div>
  );
}
