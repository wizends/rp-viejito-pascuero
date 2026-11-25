import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Swap, cascade, fadeUp } from '@/lib/motion';
import { Mail, Route } from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/stores/session';
import { Avatar } from '@/components/ui/Avatar';
import { ChildrenManager } from './ChildrenManager';
import { LettersList } from './LettersList';
import { ShipmentEditor } from './ShipmentEditor';
import { SettingsCard } from './SettingsCard';
import { SITE_NAME, usePageSeo } from '@/lib/seo';

type Section = 'cartas' | 'trayecto';

export default function PanelPage() {
  const user = useSession((s) => s.user)!;
  const children = useQuery({ queryKey: ['children'], queryFn: api.children });
  const [childId, setChildId] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('cartas');

  usePageSeo({
    title: `Panel de ayudantes · ${SITE_NAME}`,
    description: 'Revisa las cartas de tu familia, organiza el trayecto y administra los regalos del Viejito Pascuero.',
    noindex: true,
  });

  useEffect(() => {
    const list = children.data ?? [];
    if (!list.length) setChildId(null);
    else if (!childId || !list.some((c) => c.id === childId)) setChildId(list[0]!.id);
  }, [children.data, childId]);

  const child = children.data?.find((c) => c.id === childId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <motion.header initial="hidden" animate="shown" variants={cascade(0.08)} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <motion.h1 variants={fadeUp} className="font-cuento text-4xl text-marino sm:text-5xl">
            Panel de ayudantes
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-1 font-bold text-tinta-suave">
            Hola, {user.display_name}. Aquí llegan las cartas de tu familia.
          </motion.p>
        </div>
      </motion.header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
        <motion.aside initial="hidden" animate="shown" variants={cascade(0.1, 0.1)} className="space-y-6">
          <motion.div variants={fadeUp}>
            <ChildrenManager children={children.data ?? []} selected={childId} onSelect={setChildId} loading={children.isLoading} />
          </motion.div>
          <motion.div variants={fadeUp}>
            <SettingsCard />
          </motion.div>
        </motion.aside>

        <section aria-label="Detalle del niño o niña" className="min-w-0">
          {/* al cambiar de niño, su detalle se despide y entra el del otro */}
          <Swap id={child ? child.id : 'vacio'} variants={fadeUp}>
          {!child ? (
            <div className="papel-crema rounded-galleta p-8 text-center text-tinta shadow-papel">
              <p className="font-cuento text-3xl text-rojo-baya">¡El taller está listo!</p>
              <p className="mt-2 font-semibold">Agrega a tu primer niño o niña para empezar a recibir cartas.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Avatar id={child.avatar} size={52} />
                <h2 className="text-3xl text-marino">{child.nickname}</h2>
                <div role="tablist" aria-label="Secciones" className="ml-auto flex gap-1 rounded-full bg-white p-1 shadow-[0_6px_16px_-8px_rgb(74_46_30/0.4)]">
                  {(
                    [
                      ['cartas', 'Cartas', <Mail key="m" size={16} aria-hidden="true" />],
                      ['trayecto', 'Trayecto del regalo', <Route key="r" size={16} aria-hidden="true" />],
                    ] as const
                  ).map(([id, label, icon]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={section === id}
                      onClick={() => setSection(id)}
                      className={clsx(
                        'relative inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-extrabold transition-colors duration-200',
                        section === id ? 'text-tinta' : 'text-marino hover:bg-cielo-claro',
                      )}
                    >
                      {section === id && (
                        <motion.span layoutId="panel-seccion" className="absolute inset-0 rounded-full bg-oro" transition={{ type: 'spring', stiffness: 420, damping: 34 }} aria-hidden="true" />
                      )}
                      <span className="relative inline-flex items-center gap-1.5">
                        {icon}
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4" role="tabpanel">
                <Swap id={section} variants={fadeUp}>
                  {section === 'cartas' ? <LettersList childId={child.id} /> : <ShipmentEditor child={child} />}
                </Swap>
              </div>
            </>
          )}
          </Swap>
        </section>
      </div>
    </div>
  );
}
