import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { Component, type ReactNode } from 'react';

/**
 * Si una página no puede mostrarse (por ejemplo, quedó una versión vieja abierta y la
 * recarga automática ya se intentó), en vez de una pantalla en blanco aparece un aviso
 * con un botón para recargar. Se reinicia al cambiar de página (key = ruta).
 */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('La página no pudo mostrarse', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <motion.div
        role="alert"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="papel-crema mx-auto my-16 max-w-md rounded-galleta p-8 text-center text-tinta shadow-papel"
      >
        <p className="font-cuento text-4xl text-rojo">¡Hay novedades en el taller!</p>
        <p className="mt-2 font-semibold text-tinta-suave">
          Los duendes actualizaron la página mientras la tenías abierta. Recárgala para seguir.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-rojo px-5 py-2 font-display font-extrabold text-white shadow-[0_4px_0_var(--rojo-baya)] transition-transform hover:-translate-y-0.5"
        >
          <RefreshCw size={16} aria-hidden="true" /> Recargar
        </button>
      </motion.div>
    );
  }
}
