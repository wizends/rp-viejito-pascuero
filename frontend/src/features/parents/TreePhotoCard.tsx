import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, ShieldCheck, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { api } from '@/lib/api';
import type { Child, Shipment } from '@/lib/types';
import { MagicButton } from '@/components/ui/MagicButton';
import { toast } from '@/components/ui/Toast';
import { validateFile } from '@/features/letters/schemas';
import { SantaSelfie } from '@/features/selfie/SantaSelfie';

/** Lado mayor de la foto que se envía (el servidor tampoco guarda más). */
const MAX_SIDE = 2400;

/** Achica la foto en el navegador y la pasa a JPEG: sube rápido y sin metadatos. */
async function toJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo preparar la foto.'))), 'image/jpeg', 0.9));
}

/**
 * Foto del árbol de Pascua: al llegar, el Viejito "se saca una selfie" con él
 * como prueba de que dejó el regalo. El niño la ve solo después de la entrega.
 */
export function TreePhotoCard({ child, shipment }: { child: Child; shipment: Shipment }) {
  const qc = useQueryClient();
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const key = ['tree', shipment.id];
  const tree = useQuery({ queryKey: key, queryFn: () => api.treePhoto(shipment.id), enabled: shipment.has_tree_photo, staleTime: Infinity });

  const done = (s: Shipment) => {
    qc.setQueryData(['shipment', child.id], s);
    qc.removeQueries({ queryKey: key });
  };
  const remove = useMutation({
    mutationFn: () => api.deleteTreePhoto(shipment.id),
    onSuccess: (s) => (done(s), toast('Foto del árbol borrada.')),
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateFile(file);
    if (problem) return toast(problem, 'error');
    setBusy(true);
    try {
      done(await api.uploadTreePhoto(shipment.id, await toJpeg(file)));
      toast('¡Listo! El Viejito ya sabe dónde está el árbol.');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`${inputId}-t`} className="papel-crema rounded-galleta p-4 text-tinta shadow-papel sm:p-6">
      <div className="grid gap-5 md:grid-cols-[1fr_1.15fr] md:items-center">
        <div>
          <h3 id={`${inputId}-t`} className="font-display text-2xl">
            Selfie del Viejito con tu árbol
          </h3>
          <p className="mt-1 text-sm font-semibold text-tinta-suave">
            Sube una foto de tu árbol de Pascua. Cuando el Viejito Pascuero deje el regalo, {child.nickname} verá en su enlace la
            selfie que se sacó junto al árbol como prueba de que pasó por la casa.
          </p>
          <ul className="mt-3 space-y-1.5 text-xs font-semibold text-tinta-suave">
            <li className="flex gap-1.5">
              <ShieldCheck size={15} className="mt-px shrink-0 text-pino" aria-hidden="true" />
              Le quitamos la ubicación y los datos de la cámara. {child.nickname} no la ve hasta la entrega.
            </li>
            <li className="flex gap-1.5">
              <ShieldCheck size={15} className="mt-px shrink-0 text-pino" aria-hidden="true" />
              Mejor sin personas ni ventanas que muestren la calle. Se borra sola pasados los días de retención.
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <MagicButton
              size="sm"
              variant="rojo"
              icon={<Camera size={14} aria-hidden="true" />}
              disabled={busy}
              onClick={() => document.getElementById(inputId)?.click()}
            >
              {busy ? 'Subiendo…' : shipment.has_tree_photo ? 'Cambiar foto' : 'Subir foto del árbol'}
            </MagicButton>
            {shipment.has_tree_photo && (
              <MagicButton
                size="sm"
                variant="fantasma"
                icon={<Trash2 size={14} aria-hidden="true" />}
                disabled={remove.isPending}
                onClick={() => window.confirm('¿Borrar la foto del árbol? No habrá selfie del Viejito.') && remove.mutate()}
              >
                Borrar
              </MagicButton>
            )}
          </div>
        </div>

        {shipment.has_tree_photo ? (
          <div>
            <p className="mb-2 text-center text-xs font-extrabold uppercase tracking-wide text-tinta-suave">Así la verá {child.nickname}</p>
            <SantaSelfie photo={tree.data} when={shipment.arrival_at} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => document.getElementById(inputId)?.click()}
            className="grid aspect-[4/3] place-items-center rounded-2xl border-[3px] border-dashed border-[#d8c3a0] bg-white/60 p-6 text-center font-bold text-tinta-suave transition-colors hover:border-oro"
          >
            <span>
              <Camera size={34} className="mx-auto mb-2 text-rojo" aria-hidden="true" />
              Toca para elegir la foto del árbol
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
