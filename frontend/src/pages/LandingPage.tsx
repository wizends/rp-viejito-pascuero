import { AnimatePresence, motion } from 'framer-motion';
import { fadeUp, pop } from '@/lib/motion';
import { Suspense, useEffect, useState } from 'react';
import { lazyPage } from '@/lib/lazyPage';
import { Gift, MailOpen, MapPinned, Sparkles } from 'lucide-react';
import { useScene } from '@/stores/scene';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { SleighLoader } from '@/components/ui/SleighLoader';
import { SceneBoundary } from '@/components/ui/SceneBoundary';
import { SCENE_DEBUG } from '@/components/scene/debug';
import { LetterComposer } from '@/features/letters/LetterComposer';
import { SITE_DESCRIPTION, SITE_NAME, usePageSeo } from '@/lib/seo';

const Scene = lazyPage(() => import('@/components/scene/Scene'));

function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Progreso "de cuento" mientras llega el chunk 3D; salta a 100 cuando la escena avisa. */
function FakeProgress() {
  const [p, setP] = useState(8);
  useEffect(() => {
    const id = setInterval(() => setP((v) => Math.min(92, v + (100 - v) * 0.08)), 120);
    return () => clearInterval(id);
  }, []);
  return <SleighLoader progress={p} />;
}

/** Alternativa cuando no hay WebGL o la escena falla: la carta igual se puede enviar. */
function NoScene({ onShow }: { onShow?: () => void }) {
  useEffect(() => onShow?.(), [onShow]);
  return (
    <div className="grid h-full place-items-center bg-[linear-gradient(180deg,var(--cielo),var(--cielo-claro))] p-8 text-center font-bold text-marino">
      Tu navegador no puede mostrar el taller en 3D, pero tu carta llega igual al Polo Norte.
    </div>
  );
}

/** Ramita de acebo pintada (dos hojas y tres bayas), como la del título del boceto. */
function Acebo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 36" aria-hidden="true" className={className}>
      <path d="M24 20 C14 8 6 14 2 8 C8 6 6 0 14 2 C14 8 22 8 24 20Z" fill="#3f7d45" stroke="#2a4a2c" strokeWidth="1.2" />
      <path d="M24 20 C34 8 42 14 46 8 C40 6 42 0 34 2 C34 8 26 8 24 20Z" fill="#4f8a48" stroke="#2a4a2c" strokeWidth="1.2" />
      <circle cx="20" cy="24" r="4.2" fill="#b8352b" />
      <circle cx="28" cy="24" r="4.2" fill="#c8433a" />
      <circle cx="24" cy="30" r="4.2" fill="#a8352e" />
      <circle cx="19" cy="22.5" r="1.2" fill="#f6dcc9" />
    </svg>
  );
}

function SceneCaption() {
  const caption = useScene((s) => s.caption);
  const phase = useScene((s) => s.phase);
  return (
    <motion.p
      key={caption}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-live="polite"
      className={
        'papel-crema mx-auto max-w-md rounded-2xl px-4 py-2 text-center text-sm font-bold text-tinta shadow-papel sm:text-base ' +
        (phase === 'idle' ? 'opacity-90' : 'ring-4 ring-oro')
      }
    >
      {caption}
    </motion.p>
  );
}

export function LandingPage() {
  const ready = useScene((s) => s.sceneReady);
  const reduced = useReducedMotion();
  const [webgl] = useState(supportsWebGL);
  const [failed, setFailed] = useState(false);
  const sendLetter = useScene((s) => s.sendLetter);
  const phase = useScene((s) => s.phase);

  usePageSeo({ title: `${SITE_NAME} · Escríbele tu carta`, description: SITE_DESCRIPTION });

  return (
    <>
      {/* ---------- Escena ---------- */}
      <section aria-labelledby="titulo" className="relative">
        <div className="relative mx-auto h-[62vh] min-h-[420px] max-w-[1600px] overflow-hidden sm:h-[74vh]">
          {webgl && !failed ? (
            <SceneBoundary fallback={<NoScene onShow={() => setFailed(true)} />}>
              <Suspense fallback={null}>
                <Scene />
              </Suspense>
            </SceneBoundary>
          ) : (
            <NoScene />
          )}
          {/* el telón de carga se levanta cuando la escena está lista */}
          <AnimatePresence>
            {webgl && !failed && !ready && !SCENE_DEBUG.shot && (
              <motion.div
                key="cargando"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)', transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }}
                className="absolute inset-0 grid place-items-center bg-[linear-gradient(180deg,var(--cielo),var(--cielo-claro))]"
              >
                <FakeProgress />
              </motion.div>
            )}
          </AnimatePresence>
          {/* Texto alternativo de la escena */}
          <p className="sr-only">
            Ilustración animada del taller del Polo Norte: el Viejito Pascuero, con sus lentes en la punta de la
            nariz, está sentado en un sillón verde junto a la chimenea. Cinco duendes trabajan: uno clasifica
            cartas en buzones de colores, otro las sella con un timbre, otro sube una escalera hacia el estante,
            otro duerme sobre una pila de cartas y otro corre con un carrito. Tres renos se asoman por la puerta del
            establo; uno tiene la nariz roja brillante. Por la ventana se ve nieve cayendo y una aurora boreal.
          </p>
          {/* Título del libro (boceto): letras de cuento verde y rojo con acebo, sobre el papel */}
          <div className="pointer-events-none absolute inset-x-0 top-0 px-4 pt-4 text-center">
            <motion.h1
              id="titulo"
              initial={{ opacity: 0, y: -18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }}
              className="titulo-libro inline-flex flex-col items-center font-cuento text-4xl font-bold leading-[0.95] sm:text-6xl"
            >
              <span className="flex items-center gap-2 text-pino">
                <Acebo className="h-7 w-9 -scale-x-100 sm:h-10 sm:w-12" />
                El Buzón del
                <Acebo className="h-7 w-9 sm:h-10 sm:w-12" />
              </span>
              <span className="text-rojo">Viejito Pascuero</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
              className="papel-crema mx-auto mt-2 block max-w-xl rounded-2xl px-4 py-1.5 text-sm font-extrabold text-marino shadow-papel sm:text-base">
              Escríbele tu carta y mira cómo la leen en el Polo Norte. ¡Jo, jo, jo!
            </motion.p>
          </div>
          <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-3 px-4">
            <SceneCaption />
            <AnimatePresence>
              {phase === 'idle' && ready && (
                <motion.button
                  key="demo"
                  type="button"
                  onClick={() => sendLetter(null)}
                  data-demo-carta
                  initial="hidden"
                  animate="shown"
                  exit="gone"
                  variants={pop}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.94 }}
                  className="rounded-full bg-frambuesa px-5 py-2 text-sm font-extrabold text-white shadow-[0_6px_16px_-4px_rgb(227_48_111/0.7)]"
                >
                  <Sparkles size={16} className="mr-1.5 inline" aria-hidden="true" />Ver cómo viaja una carta
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <div className="cinta-separador mx-auto mt-8 max-w-4xl" aria-hidden="true" />

      {/* ---------- Carta ---------- */}
      <motion.section
        id="carta"
        aria-labelledby="carta-titulo"
        initial="hidden"
        whileInView="shown"
        viewport={{ once: true, margin: '-80px' }}
        variants={fadeUp}
        className="mx-auto mt-6 max-w-4xl px-4"
      >
        <LetterComposer reduced={reduced} />
      </motion.section>

      {/* ---------- Cómo funciona ---------- */}
      <section aria-labelledby="como-titulo" className="mx-auto mt-20 max-w-5xl px-4">
        <motion.h2
          id="como-titulo"
          initial="hidden"
          whileInView="shown"
          viewport={{ once: true, margin: '-60px' }}
          variants={fadeUp}
          className="text-center font-cuento text-4xl text-marino sm:text-5xl"
        >
          ¿Cómo funciona la magia?
        </motion.h2>
        {/* Ruta de vuelo: tres sellos postales unidos por la estela del trineo */}
        <div className="relative mt-10">
          {/* la estela del trineo se dibuja de izquierda a derecha al llegar a esta sección */}
          <motion.svg
            initial={{ clipPath: 'inset(0 100% 0 0)' }}
            whileInView={{ clipPath: 'inset(0 0% 0 0)' }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden="true"
            viewBox="0 0 1000 120"
            preserveAspectRatio="none"
            className="absolute inset-x-[12%] top-6 hidden h-24 w-[76%] sm:block"
          >
            <path
              d="M0 80 C 180 -10, 320 -10, 500 60 S 820 130, 1000 40"
              fill="none"
              stroke="var(--turquesa)"
              strokeWidth="3"
              strokeDasharray="2 14"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </motion.svg>
          <ol className="relative grid gap-12 sm:grid-cols-3 sm:gap-8">
            {[
              {
                icon: <MailOpen size={34} strokeWidth={2.25} />,
                t: 'Escribe o fotografía tu carta',
                d: 'En el papel mágico o en una hoja de verdad: sácale una foto y llega tal cual al Polo Norte.',
                bg: 'bg-rojo',
                tilt: -4,
              },
              {
                icon: <Gift size={34} strokeWidth={2.25} />,
                t: 'El Viejito la lee',
                d: 'Sus duendes la sellan y él se pone los lentes. ¡A veces se ríe con la panza!',
                bg: 'bg-pino',
                tilt: 3,
              },
              {
                icon: <MapPinned size={34} strokeWidth={2.25} />,
                t: 'Sigue el viaje del regalo',
                d: 'Tu papá, mamá o tutor arma el trayecto, y tú ves al trineo acercarse.',
                bg: 'bg-canela',
                tilt: -2,
              },
            ].map((s, i) => (
              <motion.li
                key={s.t}
                initial={reduced ? false : { y: 24, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
                className="flex flex-col items-center text-center"
              >
                <span
                  className="relative transition-transform duration-300 ease-rebote hover:scale-105"
                  style={{ transform: `rotate(${s.tilt}deg)` }}
                >
                  <span className="sello-postal block drop-shadow-[0_8px_12px_rgb(0_0_0/0.35)]">
                    <span className={`grid h-28 w-24 place-items-center ${s.bg} text-crema`}>{s.icon}</span>
                  </span>
                  {/* matasellos con el número de paso (fuera de la máscara del sello) */}
                  <span
                    aria-hidden="true"
                    className="absolute -right-5 -top-4 grid h-11 w-11 place-items-center rounded-full border-[3px] border-dashed border-rojo bg-white font-display text-lg font-extrabold text-rojo"
                  >
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-6 max-w-[18ch] text-2xl text-marino">{s.t}</h3>
                <p className="mt-2 max-w-[32ch] font-semibold text-tinta-suave">{s.d}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
