import { useMutation, useQueryClient } from '@tanstack/react-query';
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
      toast(u.allow_external_ai ? 'IA externa activada como respaldo.' : 'Listo: todo se leerá solo en nuestro taller.', 'info');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });
  return (
    <div className="rounded-galleta bg-noche-700 p-4 text-hielo ring-1 ring-hielo/15">
      <h2 className="flex items-center gap-2 font-display text-lg text-crema">
        <ShieldCheck size={20} className="text-muerdago" aria-hidden="true" /> Privacidad
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
          <strong className="text-crema">Permitir IA externa para letras difíciles.</strong> Si el OCR y el modelo local
          no logran leer una foto, se puede enviar a un proveedor externo con capa gratuita. Por defecto está
          desactivado y nada sale de nuestro servidor.
        </span>
      </label>
      <p className="mt-3 text-xs">
        Las fotos se borran cuando la carta queda leída. Si necesita ayuda, se guarda hasta que la transcribas (máx. 60 días).
      </p>
    </div>
  );
}
