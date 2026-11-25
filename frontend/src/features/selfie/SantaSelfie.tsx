import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { lifecycle, pop } from '@/lib/motion';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { composeSelfie } from './compose';
import './selfie.css';

/**
 * La selfie del Viejito Pascuero con el árbol de la familia, revelada como foto
 * instantánea (flash y luego se aclara). Se compone en el navegador.
 */
export function SantaSelfie({
  photo,
  when,
  caption,
  className,
}: {
  photo: Blob | undefined;
  when?: string | null;
  caption?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) return;
    let alive = true;
    let made: string | null = null;
    setError(null);
    composeSelfie(photo, { when: when ? new Date(when) : null })
      .then((b) => {
        made = URL.createObjectURL(b);
        if (alive) setUrl(made);
        else URL.revokeObjectURL(made);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [photo, when]);

  return (
    <motion.figure
      initial={{ opacity: 0, y: 20, rotate: -4 }}
      animate={{ opacity: 1, y: 0, rotate: -1.2 }}
      transition={{ type: 'spring', stiffness: 160, damping: 16 }}
      className={clsx('selfie-polaroid mx-auto w-full max-w-xl', className)}
    >
      <div className="relative overflow-hidden rounded-md bg-noche-700" style={{ aspectRatio: url ? undefined : '4 / 3' }}>
        <AnimatePresence mode="wait">
        {url ? (
          <motion.img
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            key={url}
            src={url}
            alt="Selfie del Viejito Pascuero junto a tu árbol de Pascua"
            className={clsx('block h-auto w-full', !reduced && 'selfie-revela')}
          />
        ) : (
          <motion.p
            key={error ? 'error' : 'esperando'}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.55, 1, 0.55] }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 1.8, repeat: error ? 0 : Infinity }}
            className="absolute inset-0 grid place-items-center p-6 text-center font-bold text-hielo"
            role="status"
          >
            {error ?? 'El Viejito se está acomodando para la foto…'}
          </motion.p>
        )}
        </AnimatePresence>
        {url && !reduced && <span aria-hidden="true" className="selfie-flash" />}
      </div>
      <figcaption className="flex items-center gap-3 px-1 pt-3">
        <span className="flex-1 font-mano text-2xl leading-tight text-tinta">{caption ?? '¡Jo, jo, jo! Pasé por aquí'}</span>
        <AnimatePresence>
        {url && (
          <motion.a
            key="descargar"
            {...lifecycle}
            variants={pop}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            href={url}
            download="selfie-viejito-pascuero.jpg"
            className="inline-flex items-center gap-1.5 rounded-full bg-oro px-4 py-1.5 text-sm font-extrabold text-tinta shadow-[0_3px_0_var(--canela)]"
          >
            <Download size={15} aria-hidden="true" /> Descargar
          </motion.a>
        )}
        </AnimatePresence>
      </figcaption>
    </motion.figure>
  );
}
