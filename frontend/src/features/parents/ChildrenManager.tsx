import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { AVATARS, type Avatar as AvatarId, type Child } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { MagicButton } from '@/components/ui/MagicButton';
import { toast } from '@/components/ui/Toast';

interface Props {
  children: Child[];
  selected: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}

export function ChildrenManager({ children, selected, onSelect, loading }: Props) {
  const [editing, setEditing] = useState<Child | 'new' | null>(null);
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: api.deleteChild,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['children'] });
      void qc.invalidateQueries({ queryKey: ['letters'] });
      toast('Perfil borrado junto con sus cartas.', 'info');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  return (
    <div className="papel-kraft rounded-galleta p-4 text-tinta shadow-papel">
      <h2 className="font-display text-xl">Mis duendecitos</h2>
      {loading && <p className="mt-2 text-sm">Cargando…</p>}
      <ul className="mt-3 space-y-2">
        {children.map((c) => (
          <li key={c.id}>
            <div
              className={clsx(
                'flex items-center gap-2 rounded-2xl border-2 bg-crema/80 p-1.5 transition-all duration-200 ease-rebote',
                selected === c.id ? 'border-rojo shadow-brillo' : 'border-transparent hover:border-marino/20',
              )}
            >
              <button type="button" onClick={() => onSelect(c.id)} aria-current={selected === c.id} className="flex flex-1 items-center gap-2 rounded-xl text-left font-extrabold">
                <Avatar id={c.avatar} size={40} />
                <span>
                  {c.nickname}
                  {c.age ? <span className="block text-xs font-semibold text-tinta-suave">{c.age} años</span> : null}
                </span>
              </button>
              <button type="button" onClick={() => setEditing(c)} aria-label={`Editar a ${c.nickname}`} className="rounded-full p-2 hover:bg-white">
                <Pencil size={16} />
              </button>
              <button
                type="button"
                aria-label={`Borrar a ${c.nickname}`}
                className="rounded-full p-2 text-rojo-baya hover:bg-white"
                onClick={() => {
                  if (window.confirm(`¿Borrar el perfil de ${c.nickname} y todas sus cartas? No se puede deshacer.`)) del.mutate(c.id);
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {editing ? (
        <ChildForm child={editing === 'new' ? null : editing} onDone={(id) => (setEditing(null), id && onSelect(id))} />
      ) : (
        <MagicButton size="sm" variant="pino" className="mt-3" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing('new')}>
          Agregar niño o niña
        </MagicButton>
      )}
    </div>
  );
}

function ChildForm({ child, onDone }: { child: Child | null; onDone: (id?: string) => void }) {
  const qc = useQueryClient();
  const [nickname, setNickname] = useState(child?.nickname ?? '');
  const [age, setAge] = useState<string>(child?.age ? String(child.age) : '');
  const [avatar, setAvatar] = useState<AvatarId>(child?.avatar ?? 'duende_rojo');
  const save = useMutation({
    mutationFn: () => {
      const body = { nickname: nickname.trim(), age: age ? Number(age) : null, avatar };
      return child ? api.updateChild(child.id, body) : api.createChild(body);
    },
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['children'] });
      onDone(c.id);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });
  return (
    <form
      className="mt-3 space-y-2 rounded-2xl bg-crema/90 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (nickname.trim()) save.mutate();
      }}
    >
      <label className="block text-sm font-extrabold">
        Nombre o apodo
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} required className="mt-1 w-full rounded-xl border-2 border-marino/20 px-3 py-1.5 font-normal focus:border-oro focus:outline-none" />
      </label>
      <label className="block text-sm font-extrabold">
        Edad aproximada (opcional)
        <input type="number" min={1} max={17} value={age} onChange={(e) => setAge(e.target.value)} className="mt-1 w-24 rounded-xl border-2 border-marino/20 px-3 py-1.5 font-normal focus:border-oro focus:outline-none" />
      </label>
      <p className="text-sm font-extrabold" id="cf-av">
        Avatar
      </p>
      <div role="radiogroup" aria-labelledby="cf-av" className="flex flex-wrap gap-1.5">
        {AVATARS.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={avatar === a} onClick={() => setAvatar(a)} className={clsx('rounded-full', avatar === a && 'ring-4 ring-oro')}>
            <Avatar id={a} size={36} />
          </button>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <MagicButton type="submit" size="sm" variant="rojo" disabled={save.isPending}>
          Guardar
        </MagicButton>
        <MagicButton type="button" size="sm" variant="fantasma" onClick={() => onDone()}>
          Cancelar
        </MagicButton>
      </div>
    </form>
  );
}
