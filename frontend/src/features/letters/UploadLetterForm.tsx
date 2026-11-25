import { FileText, ImagePlus, RotateCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Link } from 'react-router-dom';
import { SealButton } from '@/components/ui/SealButton';
import { toast } from '@/components/ui/Toast';
import { Privacy } from './WriteLetterForm';
import { validateFile } from './schemas';

interface Props {
  disabled: boolean;
  busy: boolean;
  externalAi: boolean;
  onSubmit: (v: { file: Blob; mensaje: string }) => Promise<void>;
}

/** Lado mayor de la foto que se envía (el servidor tampoco guarda más). */
const MAX_SIDE = 2400;

/** Recorta, rota y achica en un canvas; devuelve JPEG (liviano para subir). */
async function cropImage(src: string, area: Area, rotation: number): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const bw = img.width * cos + img.height * sin;
  const bh = img.width * sin + img.height * cos;
  const stage = document.createElement('canvas');
  stage.width = bw;
  stage.height = bh;
  const sctx = stage.getContext('2d')!;
  sctx.translate(bw / 2, bh / 2);
  sctx.rotate(rad);
  sctx.drawImage(img, -img.width / 2, -img.height / 2);
  const scale = Math.min(1, MAX_SIDE / Math.max(area.width, area.height));
  const out = document.createElement('canvas');
  out.width = Math.round(area.width * scale);
  out.height = Math.round(area.height * scale);
  const octx = out.getContext('2d')!;
  octx.fillStyle = '#ffffff'; // fondo blanco para PNG transparentes
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(stage, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height);
  return new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('crop'))), 'image/jpeg', 0.9));
}

/** Subir foto o escaneo con vista previa, recorte y rotación. */
export function UploadLetterForm({ disabled, busy, externalAi, onSubmit }: Props) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState<Area | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const canPreview = !!file && /^image\/(jpeg|png|webp)$/.test(file.type);

  const pick = (f: File | undefined) => {
    if (!f) return;
    const err = validateFile(f);
    setError(err);
    if (err) return;
    setFile(f);
    setRotation(0);
    setZoom(1);
    setPreview(/^image\/(jpeg|png|webp)$/.test(f.type) ? URL.createObjectURL(f) : null);
  };

  const onCropComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Primero elige la foto de tu carta.');
      return;
    }
    try {
      const blob = canPreview && preview && area ? await cropImage(preview, area, rotation) : file;
      await onSubmit({ file: blob, mensaje });
      setFile(null);
      setPreview(null);
      setMensaje('');
    } catch (err) {
      if (err instanceof Error && err.message === 'crop') toast('No pudimos recortar la imagen.', 'error');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Privacy />
      <label
        htmlFor={inputId}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files[0]);
        }}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-4 border-dashed border-marino/20 bg-white/70 p-6 text-center transition-colors hover:border-rojo has-[:focus-visible]:border-oro"
      >
        <ImagePlus size={36} className="text-rojo" aria-hidden="true" />
        <span className="font-display text-lg font-extrabold">
          {file ? `Elegiste: ${file.name}` : 'Toca aquí o arrastra la foto de tu carta'}
        </span>
        <span className="text-sm text-tinta-suave">Foto JPG, PNG o WebP · máximo 10 MB</span>
        <input
          id={inputId}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
          aria-describedby={error ? `${inputId}-err` : undefined}
        />
      </label>
      {error && (
        <p id={`${inputId}-err`} role="alert" className="text-sm font-bold text-rojo-baya">
          {error}
        </p>
      )}

      {canPreview && preview && (
        <div className="space-y-2">
          <div className="relative h-72 overflow-hidden rounded-2xl bg-marino sm:h-96">
            <Cropper
              image={preview}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={3 / 4}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-1 items-center gap-2 text-sm font-bold">
              Zoom
              <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-rojo" />
            </label>
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="inline-flex items-center gap-1 rounded-full bg-pino px-3 py-1.5 text-sm font-extrabold text-crema transition-transform duration-200 ease-rebote hover:scale-105"
            >
              <RotateCw size={16} aria-hidden="true" /> Girar
            </button>
          </div>
        </div>
      )}
      {file && !canPreview && (
        <p className="flex items-center gap-2 rounded-xl bg-white/70 p-3 text-sm font-bold">
          <FileText size={18} aria-hidden="true" /> Esta foto no tiene vista previa, pero igual llegará al Polo Norte.
        </p>
      )}

      <div>
        <label htmlFor="mensaje-foto" className="text-sm font-extrabold">
          ¿Quieres agregar un mensajito? (opcional)
        </label>
        <textarea
          id="mensaje-foto"
          rows={2}
          maxLength={2000}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          className="mt-1 w-full rounded-xl border-2 border-marino/20 bg-white/90 p-3 font-mano text-xl focus:border-oro focus:outline-none focus:ring-4 focus:ring-oro-suave/60"
        />
      </div>

      <p className="flex items-start gap-2 text-xs font-semibold text-tinta-suave">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-muerdago" aria-hidden="true" />
        {externalAi
          ? 'Un ayudante de IA externo (que tu familia aceptó) transcribirá la letra para armar la lista de regalos.'
          : 'La foto llega tal cual al taller (nuestro servidor); no se envía a servicios externos.'}{' '}
        Quitamos la ubicación y datos ocultos de la foto. <Link to="/privacidad" className="underline">Más info</Link>
      </p>

      <div className="flex flex-col items-center pb-8 pt-2">
        <SealButton label="Enviar al Polo Norte" busy={busy} disabled={disabled || !file} />
      </div>
    </form>
  );
}
