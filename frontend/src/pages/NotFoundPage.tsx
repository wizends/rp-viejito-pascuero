import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { cascade, fadeUp } from '@/lib/motion';

export default function NotFoundPage() {
  return (
    <motion.div initial="hidden" animate="shown" variants={cascade(0.09)} className="mx-auto max-w-lg px-6 py-20 text-center">
      <motion.p
        variants={{ hidden: { opacity: 0, y: -60, rotate: -8 }, shown: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 260, damping: 12 } } }}
        className="font-cuento text-7xl text-rojo"
      >
        404
      </motion.p>
      <motion.h1 variants={fadeUp} className="mt-2 text-3xl">
        Esta página se perdió en la nieve
      </motion.h1>
      <motion.p variants={fadeUp} className="mt-3 font-semibold text-tinta-suave">
        Hasta los renos se desorientan a veces. Volvamos al taller.
      </motion.p>
      <motion.div variants={fadeUp}>
      <Link
        to="/"
        className="mt-6 inline-block rounded-full bg-rojo px-6 py-2.5 font-display font-extrabold text-white shadow-[0_4px_0_var(--rojo-baya),0_10px_18px_-8px_rgb(15_27_61/0.5)] transition-transform duration-200 ease-rebote hover:-translate-y-0.5"
      >
        Volver al inicio
      </Link>
      </motion.div>
    </motion.div>
  );
}
