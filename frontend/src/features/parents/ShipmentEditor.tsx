import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, GripVertical, Pencil, Plus, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { formatDateTime, fromLocalInput, toLocalInput } from '@/lib/time';
import { STOP_ICONS, type Child, type Shipment, type Stop, type StopInput } from '@/lib/types';
import { STOP_ICON_LABELS, StopGlyph } from '@/components/ui/Icons';
import { MagicButton } from '@/components/ui/MagicButton';
import { toast } from '@/components/ui/Toast';

const coord = (min: number, max: number) =>
  z.union([z.literal(''), z.coerce.number().min(min, 'Fuera de rango').max(max, 'Fuera de rango')]);

const stopSchema = z.object({
  nombre: z.string().trim().min(1, 'Ponle un nombre').max(80),
  icono: z.enum(STOP_ICONS),
  descripcion: z.string().max(280),
  lat: coord(-90, 90),
  lng: coord(-180, 180),
  eta: z.string(),
  auto_advance: z.boolean(),
});
type StopForm = z.infer<typeof stopSchema>;

function toInput(v: StopForm): StopInput {
  return {
    nombre: v.nombre.trim(),
    icono: v.icono,
    descripcion: v.descripcion,
    lat: v.lat === '' ? null : v.lat,
    lng: v.lng === '' ? null : v.lng,
    eta: fromLocalInput(v.eta),
    auto_advance: v.auto_advance,
  };
}

export function ShipmentEditor({ child }: { child: Child }) {
  const qc = useQueryClient();
  const key = ['shipment', child.id];
  const q = useQuery({ queryKey: key, queryFn: () => api.shipment(child.id) });
  const [stops, setStops] = useState<Stop[]>([]);
  const [editing, setEditing] = useState<Stop | 'new' | null>(null);
  useEffect(() => setStops(q.data?.stops ?? []), [q.data]);

  const onShipment = (s: Shipment) => qc.setQueryData(key, s);
  const onErr = (e: Error) => toast(e.message, 'error');
  const reorder = useMutation({ mutationFn: (ids: string[]) => api.reorderStops(q.data!.id, ids), onSuccess: onShipment, onError: onErr });
  const templates = useMutation({ mutationFn: () => api.addTemplates(q.data!.id), onSuccess: (s) => (onShipment(s), toast('¡Paradas mágicas agregadas!')), onError: onErr });
  const update = useMutation({ mutationFn: (v: { id: string; patch: Parameters<typeof api.updateStop>[1] }) => api.updateStop(v.id, v.patch), onSuccess: onShipment, onError: onErr });
  const remove = useMutation({ mutationFn: api.deleteStop, onSuccess: onShipment, onError: onErr });
  const arrival = useMutation({ mutationFn: (iso: string) => api.setArrival(q.data!.id, iso), onSuccess: (s) => (onShipment(s), toast('Hora de llegada actualizada.')), onError: onErr });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (q.isLoading || !q.data) return <p className="font-bold text-marino">Preparando el trineo…</p>;
  const sh = q.data;
  const shareUrl = `${window.location.origin}/seguimiento/${sh.share_code}`;

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = stops.findIndex((s) => s.id === e.active.id);
    const to = stops.findIndex((s) => s.id === e.over!.id);
    const next = arrayMove(stops, from, to);
    setStops(next);
    reorder.mutate(next.map((s) => s.id));
  };

  return (
    <div className="space-y-5">
      {/* Llegada + enlace del niño */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="papel-crema rounded-[1.4rem] p-4 text-tinta shadow-papel">
          <label htmlFor="arrival" className="font-display font-extrabold">
            Llegada del Viejito (Nochebuena, hora de Chile)
          </label>
          <input
            id="arrival"
            type="datetime-local"
            defaultValue={toLocalInput(sh.arrival_at)}
            key={sh.arrival_at}
            onBlur={(e) => {
              const iso = fromLocalInput(e.target.value);
              if (iso && iso !== sh.arrival_at) arrival.mutate(iso);
            }}
            className="mt-2 w-full rounded-xl border-2 border-marino/20 px-3 py-2 focus:border-oro focus:outline-none"
          />
          <p className="mt-1 text-xs text-tinta-suave">Por defecto: medianoche del 24 al 25 de diciembre.</p>
        </div>
        <div className="rounded-[1.4rem] bg-noche-700 p-4 text-hielo ring-1 ring-hielo/15">
          <p className="font-display font-extrabold text-crema">Vista para {child.nickname}</p>
          <p className="mt-1 text-xs">Un enlace solo de lectura con el timeline, el mapa y la cuenta regresiva. No muestra cartas ni datos tuyos.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <MagicButton
              size="sm"
              variant="oro"
              icon={<Copy size={14} aria-hidden="true" />}
              onClick={() => navigator.clipboard?.writeText(shareUrl).then(() => toast('Enlace copiado.'), () => toast(shareUrl, 'info'))}
            >
              Copiar enlace
            </MagicButton>
            <a
              href={`/seguimiento/${sh.share_code}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-extrabold text-hielo ring-2 ring-hielo/40 transition-all duration-200 ease-rebote hover:ring-oro"
            >
              <ExternalLink size={14} aria-hidden="true" /> Abrir vista
            </a>
          </div>
        </div>
      </div>

      {/* Paradas */}
      <div className="papel-kraft rounded-galleta p-4 text-tinta shadow-papel sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-2xl">Paradas del regalo</h3>
          <div className="ml-auto flex flex-wrap gap-2">
            <MagicButton size="sm" variant="crema" icon={<Wand2 size={14} aria-hidden="true" />} onClick={() => templates.mutate()} disabled={templates.isPending}>
              Usar plantilla sugerida
            </MagicButton>
            <MagicButton size="sm" variant="rojo" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setEditing('new')}>
              Nueva parada
            </MagicButton>
          </div>
        </div>
        <p className="mt-1 text-sm text-tinta-suave">
          Arrastra para ordenar (o usa espacio + flechas). Las paradas con avance automático se completan solas a su hora.
        </p>

        {editing === 'new' && (
          <StopEditor
            onCancel={() => setEditing(null)}
            onSave={async (v) => {
              const s = await api.addStop(sh.id, v);
              onShipment(s);
              setEditing(null);
            }}
          />
        )}

        {stops.length === 0 && editing !== 'new' && <p className="mt-6 text-center font-bold">Aún no hay paradas. ¡Prueba la plantilla sugerida!</p>}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol className="mt-4 space-y-2">
              {stops.map((s, i) =>
                editing !== 'new' && editing?.id === s.id ? (
                  <li key={s.id}>
                    <StopEditor
                      stop={s}
                      onCancel={() => setEditing(null)}
                      onSave={async (v) => {
                        await update.mutateAsync({ id: s.id, patch: v });
                        setEditing(null);
                      }}
                    />
                  </li>
                ) : (
                  <SortableStop
                    key={s.id}
                    stop={s}
                    index={i}
                    onEdit={() => setEditing(s)}
                    onToggle={() => update.mutate({ id: s.id, patch: { completed: !s.completed_at } })}
                    onDelete={() => window.confirm(`¿Borrar la parada "${s.nombre}"?`) && remove.mutate(s.id)}
                  />
                ),
              )}
            </ol>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

function SortableStop({ stop, index, onEdit, onToggle, onDelete }: { stop: Stop; index: number; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });
  const done = !!stop.completed_at;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(
        'flex items-center gap-2 rounded-2xl bg-crema/90 p-2 pr-3 shadow-[0_2px_0_var(--kraft-oscuro),0_10px_18px_-8px_rgb(15_27_61/0.5)]',
        isDragging && 'z-10 scale-[1.02] shadow-brillo',
      )}
    >
      <button type="button" {...attributes} {...listeners} aria-label={`Mover parada ${index + 1}: ${stop.nombre}`} className="cursor-grab rounded-lg p-1.5 text-tinta-suave hover:bg-kraft/40 active:cursor-grabbing">
        <GripVertical size={18} />
      </button>
      <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-full', done ? 'bg-muerdago text-white' : 'bg-noche text-oro-suave')}>
        <StopGlyph icon={stop.icono} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={clsx('truncate font-extrabold', done && 'text-pino')}>{stop.nombre}</p>
        <p className="truncate text-xs text-tinta-suave">
          {formatDateTime(stop.eta)}
          {stop.auto_advance ? ' · avance automático' : ''}
          {stop.lat != null ? ' · en el mapa' : ''}
        </p>
      </div>
      <label className="flex items-center gap-1.5 text-xs font-extrabold">
        <input type="checkbox" checked={done} onChange={onToggle} className="h-5 w-5 accent-[var(--verde-muerdago)]" />
        <span className="hidden sm:inline">Completada</span>
        <span className="sr-only sm:hidden">Completada</span>
      </label>
      <button type="button" onClick={onEdit} aria-label={`Editar ${stop.nombre}`} className="rounded-full p-2 hover:bg-kraft/40">
        <Pencil size={16} />
      </button>
      <button type="button" onClick={onDelete} aria-label={`Borrar ${stop.nombre}`} className="rounded-full p-2 text-rojo-baya hover:bg-kraft/40">
        <Trash2 size={16} />
      </button>
    </li>
  );
}

function StopEditor({ stop, onSave, onCancel }: { stop?: Stop; onSave: (v: StopInput) => Promise<void>; onCancel: () => void }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StopForm>({
    resolver: zodResolver(stopSchema) as never,
    defaultValues: {
      nombre: stop?.nombre ?? '',
      icono: stop?.icono ?? 'estrella',
      descripcion: stop?.descripcion ?? '',
      lat: stop?.lat ?? '',
      lng: stop?.lng ?? '',
      eta: toLocalInput(stop?.eta ?? null),
      auto_advance: stop?.auto_advance ?? false,
    },
  });
  const icon = watch('icono');
  const inputCls = 'mt-1 w-full rounded-xl border-2 border-marino/20 bg-white px-3 py-1.5 text-sm font-normal focus:border-oro focus:outline-none';
  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (v) => {
        try {
          await onSave(toInput(v));
        } catch (e) {
          toast((e as Error).message, 'error');
        }
      })}
      className="mt-3 grid gap-3 rounded-2xl border-2 border-oro bg-crema p-4 sm:grid-cols-2"
    >
      <label className="text-sm font-extrabold sm:col-span-2">
        Nombre de la parada
        <input {...register('nombre')} className={inputCls} aria-invalid={!!errors.nombre} />
        {errors.nombre && <span className="text-xs text-rojo-baya">{errors.nombre.message}</span>}
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-extrabold">Ícono</legend>
        <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup">
          {STOP_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              role="radio"
              aria-checked={icon === ic}
              aria-label={STOP_ICON_LABELS[ic]}
              title={STOP_ICON_LABELS[ic]}
              onClick={() => setValue('icono', ic)}
              className={clsx('grid h-10 w-10 place-items-center rounded-full transition-all duration-200 ease-rebote', icon === ic ? 'scale-110 bg-rojo text-white shadow-brillo' : 'bg-white text-tinta hover:bg-oro-suave')}
            >
              <StopGlyph icon={ic} size={18} />
            </button>
          ))}
        </div>
      </fieldset>
      <label className="text-sm font-extrabold sm:col-span-2">
        Descripción
        <input {...register('descripcion')} maxLength={280} className={inputCls} />
      </label>
      <label className="text-sm font-extrabold">
        Fecha y hora (Chile)
        <input type="datetime-local" {...register('eta')} className={inputCls} />
      </label>
      <label className="flex items-end gap-2 pb-2 text-sm font-extrabold">
        <input type="checkbox" {...register('auto_advance')} className="h-5 w-5 accent-[var(--verde-muerdago)]" />
        Avanzar automáticamente a esa hora
      </label>
      <label className="text-sm font-extrabold">
        Latitud (opcional, para el mapa)
        <input inputMode="decimal" {...register('lat')} placeholder="-33.45" className={inputCls} aria-invalid={!!errors.lat} />
        {errors.lat && <span className="text-xs text-rojo-baya">{errors.lat.message}</span>}
      </label>
      <label className="text-sm font-extrabold">
        Longitud (opcional)
        <input inputMode="decimal" {...register('lng')} placeholder="-70.66" className={inputCls} aria-invalid={!!errors.lng} />
        {errors.lng && <span className="text-xs text-rojo-baya">{errors.lng.message}</span>}
      </label>
      <p className="text-xs text-tinta-suave sm:col-span-2">
        Consejo: usa la ciudad, no la dirección de tu casa. Basta con coordenadas aproximadas.
      </p>
      <div className="flex gap-2 sm:col-span-2">
        <MagicButton type="submit" size="sm" variant="pino" disabled={isSubmitting}>
          Guardar parada
        </MagicButton>
        <MagicButton type="button" size="sm" variant="fantasma" onClick={onCancel}>
          Cancelar
        </MagicButton>
      </div>
    </form>
  );
}
