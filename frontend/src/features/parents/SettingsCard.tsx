import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/stores/session';
import { toast } from '@/components/ui/Toast';

/** Consentimiento explícito para usar IA externa como respaldo de lectura. */
export function SettingsCard() {
  const user = useSession((s) => s.user)!;
  const setUser = useSession((s) => s.setUser);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (allow: boolean) => api.updateMe({ allow_external_ai: allow }),
    onSuccess: (u) => {
      setUser(u);
      qc.setQueryData(['me'], u);
      toast(u.allow_external_ai ? 'IA activada: transcribirá las próximas fotos de cartas.' : 'Listo: las fotos quedan solo como imagen en nuestro taller.', 'info');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });
  return (
    <div className="rounded-galleta bg-noche-700 p-4 text-hielo ring-1 ring-hielo/15">
      <h2 className="flex items-center gap-2 font-display text-lg text-crema">
        <motion.span
          key={user.allow_external_ai ? 'ia' : 'local'}
          initial={{ rotate: -25, scale: 0.6 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 16 }}
          className="grid place-items-center"
        >
          <ShieldCheck size={20} className="text-muerdago" aria-hidden="true" />
        </motion.span>{' '}
        Privacidad
      </h2>
      <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={user.allow_external_ai}
          disabled={m.isPending}
          onChange={(e) => m.mutate(e.target.checked)}
          className="mt-1 h-5 w-5 accent-[var(--dorado-estrella)]"
        />
        <span>
          <strong className="text-crema">Permitir que una IA transcriba las fotos de las cartas.</strong> La foto se
          envía a un proveedor externo con capa gratuita que lee la letra y arma la lista de regalos. Por defecto está
          desactivado: la foto queda solo como imagen y nada sale de nuestro servidor.
        </span>
      </label>
      <p className="mt-3 text-xs">
        Las fotos se guardan limpias (sin ubicación ni datos de la cámara) y se borran a los 60 días o cuando borres la carta.
      </p>
    </div>
  );
}
