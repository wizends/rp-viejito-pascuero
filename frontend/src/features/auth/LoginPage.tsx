import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useSession } from '@/stores/session';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { Field } from '@/components/ui/Field';
import { MagicButton } from '@/components/ui/MagicButton';
import { toast } from '@/components/ui/Toast';

const loginSchema = z.object({
  email: z.string().trim().email('Ese correo no parece válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
});
const registerSchema = loginSchema.extend({
  display_name: z.string().trim().min(1, '¿Cómo te llamamos?').max(80),
  password: z.string().min(10, 'Usa al menos 10 caracteres').max(128),
});
type Values = z.infer<typeof registerSchema>;

/** Inicio de sesión / registro con forma de credencial de ayudante del Viejito. */
export default function LoginPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const reduced = useReducedMotion();
  const setUser = useSession((s) => s.setUser);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/panel';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(isRegister ? registerSchema : loginSchema) as never,
    defaultValues: { email: '', password: '', display_name: '' },
  });

  const onSubmit = handleSubmit(async (v) => {
    try {
      const user = isRegister
        ? await api.register(v.email, v.password, v.display_name)
        : await api.login(v.email, v.password);
      setUser(user);
      qc.setQueryData(['me'], user);
      toast(`¡Bienvenido al taller, ${user.display_name}!`);
      navigate(from, { replace: true });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  });

  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-10 md:grid-cols-[1fr_1.1fr]">
      <div className="text-center md:text-left">
        <h1 className="text-4xl text-marino sm:text-5xl">
          {isRegister ? 'Saca tu credencial de ayudante' : 'Muestra tu credencial de ayudante'}
        </h1>
        <p className="mt-4 max-w-[52ch] text-lg font-semibold text-tinta-suave">
          Es para papás, mamás y tutores. Con ella guardas las cartas de tus niños, revisas lo que pidieron y armas el viaje del regalo hasta el
          árbol, parada por parada.
        </p>
      </div>

      <motion.form
        onSubmit={onSubmit}
        noValidate
        initial={reduced ? false : { rotate: -6, y: 30, opacity: 0 }}
        animate={{ rotate: -1.5, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 16 }}
        className="papel-crema relative overflow-hidden rounded-[1.6rem] text-tinta shadow-papel ring-1 ring-marino/20"
        aria-labelledby="cred-title"
      >
        {/* perforación para la cinta */}
        <div aria-hidden="true" className="absolute left-1/2 top-3 h-3 w-16 -translate-x-1/2 rounded-full bg-noche/80" />
        <div className="relative bg-rojo px-6 pb-6 pt-9 text-crema after:absolute after:inset-x-0 after:bottom-0 after:h-3 after:bg-[radial-gradient(circle,rgb(255_248_236/0.9)_1.6px,transparent_2px)] after:bg-[length:12px_12px] after:content-['']">
          <h2 id="cred-title" className="font-cuento text-3xl">
            Credencial de Ayudante
          </h2>
          <p className="mt-0.5 text-sm font-bold text-oro-suave">Emitida por la Oficina de Correos del Polo Norte</p>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-[96px_1fr]">
          <div aria-hidden="true" className="hidden h-28 place-items-center rounded-xl border-2 border-dashed border-marino/20 bg-hielo/50 sm:grid">
            <svg viewBox="0 0 64 64" className="h-16 w-16">
              <circle cx="32" cy="24" r="12" fill="#f6c9a8" />
              <path d="M18 22 L32 4 L46 22Z" fill="#1f5135" />
              <circle cx="32" cy="5" r="3" fill="#e8b931" />
              <path d="M12 60c2-14 10-20 20-20s18 6 20 20z" fill="#c8102e" />
            </svg>
          </div>
          <div className="space-y-3">
            {isRegister && (
              <Field label="Tu nombre" autoComplete="name" error={errors.display_name?.message} {...register('display_name')} />
            )}
            <Field label="Correo" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            <Field
              label="Contraseña"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              error={errors.password?.message}
              hint={isRegister ? 'Mínimo 10 caracteres. Una frase fácil de recordar es ideal.' : undefined}
              {...register('password')}
            />
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t-2 border-dashed border-marino/20 px-6 py-4 sm:flex-row">
          <MagicButton type="submit" disabled={isSubmitting} variant="rojo">
            {isSubmitting ? 'Revisando…' : isRegister ? 'Crear credencial' : 'Entrar al taller'}
          </MagicButton>
          <p className="text-sm font-bold">
            {isRegister ? (
              <>
                ¿Ya tienes una?{' '}
                <Link to="/entrar" className="text-rojo-baya underline underline-offset-4">
                  Entra aquí
                </Link>
              </>
            ) : (
              <>
                ¿Primera vez?{' '}
                <Link to="/registro" className="text-rojo-baya underline underline-offset-4">
                  Crea tu credencial
                </Link>
              </>
            )}
          </p>
        </div>
        {/* sello */}
        <div aria-hidden="true" className="absolute right-4 top-6 hidden h-20 w-20 rotate-12 place-items-center rounded-full border-4 border-double border-oro-suave/80 text-center font-cuento text-xs leading-tight text-oro-suave sm:grid">
          Aprobado
          <br />
          por el Viejito
        </div>
      </motion.form>
    </div>
  );
}
