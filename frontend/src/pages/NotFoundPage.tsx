import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <p className="font-cuento text-7xl text-rojo">404</p>
      <h1 className="mt-2 text-3xl">Esta página se perdió en la nieve</h1>
      <p className="mt-3 font-semibold text-tinta-suave">Hasta los renos se desorientan a veces. Volvamos al taller.</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-full bg-rojo px-6 py-2.5 font-display font-extrabold text-white shadow-[0_4px_0_var(--rojo-baya),0_10px_18px_-8px_rgb(15_27_61/0.5)] transition-transform duration-200 ease-rebote hover:-translate-y-0.5"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
