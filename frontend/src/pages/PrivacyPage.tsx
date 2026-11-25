import { motion } from 'framer-motion';
import { fadeUp } from '@/lib/motion';
import { SITE_NAME, usePageSeo } from '@/lib/seo';

export default function PrivacyPage() {
  usePageSeo({
    title: `Cómo cuidamos las cartas · ${SITE_NAME}`,
    description:
      'Qué datos pide el Buzón del Viejito Pascuero, quién puede ver las cartas de los niños y cuándo se borran las fotos.',
    type: 'article',
  });

  return (
    <motion.article initial="hidden" animate="shown" variants={fadeUp} className="papel-crema mx-auto mt-6 max-w-3xl rounded-galleta p-6 text-tinta shadow-papel sm:p-10">
      <h1 className="font-cuento text-4xl text-rojo-baya">Cómo cuidamos las cartas</h1>
      <p className="mt-3 font-semibold text-tinta-suave">
        Las cartas son de niños y niñas, así que las tratamos como el tesoro más grande del Polo Norte.
      </p>
      <div className="mt-6 space-y-5 leading-relaxed">
        <motion.section initial="hidden" whileInView="shown" viewport={{ once: true, margin: '-30px' }} variants={fadeUp}>
          <h2 className="text-xl">¿Quién puede ver una carta?</h2>
          <p>
            Solo la cuenta del papá, mamá o tutor que la envió. Nadie más del sitio puede verlas. La vista de
            seguimiento del niño muestra solo su apodo, su avatar y las paradas del regalo.
          </p>
        </motion.section>
        <motion.section initial="hidden" whileInView="shown" viewport={{ once: true, margin: '-30px' }} variants={fadeUp}>
          <h2 className="text-xl">¿Qué datos pedimos?</h2>
          <p>
            Un apodo y, si quieres, la edad aproximada. No pedimos apellidos, direcciones ni colegio. Si una carta
            trae teléfonos, RUT, direcciones o colegios, los tapamos automáticamente al leerla.
          </p>
        </motion.section>
        <motion.section initial="hidden" whileInView="shown" viewport={{ once: true, margin: '-30px' }} variants={fadeUp}>
          <h2 className="text-xl">¿Qué pasa con las fotos?</h2>
          <p>
            Al subirlas las volvemos a dibujar desde cero: así se borran los datos ocultos de la cámara, incluida la
            ubicación GPS. La foto es la carta: solo tú la ves en tu panel, y se borra cuando la borres o, como
            máximo, a los 60 días.
          </p>
        </motion.section>
        <motion.section initial="hidden" whileInView="shown" viewport={{ once: true, margin: '-30px' }} variants={fadeUp}>
          <h2 className="text-xl">¿Quién lee la letra manuscrita?</h2>
          <p>
            Por defecto, nadie: la foto llega tal cual y puedes transcribirla tú si quieres. Solo si lo activas en tu
            panel, una IA externa con capa gratuita transcribe la letra y arma la lista de regalos; en ese caso la foto
            se envía a ese proveedor.
          </p>
        </motion.section>
        <motion.section initial="hidden" whileInView="shown" viewport={{ once: true, margin: '-30px' }} variants={fadeUp}>
          <h2 className="text-xl">¿Puedo borrar todo?</h2>
          <p>Sí. Desde el panel puedes borrar cada carta o el perfil completo de un niño, con todas sus cartas.</p>
        </motion.section>
      </div>
    </motion.article>
  );
}
