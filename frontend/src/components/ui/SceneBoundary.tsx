import { motion } from 'framer-motion';
import { Component, type ReactNode } from 'react';

/** Si la escena 3D falla (GPU, driver, memoria), la página sigue usable. */
export class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('La escena 3D no pudo dibujarse', error);
  }

  render() {
    return this.state.failed ? (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="h-full">
        {this.props.fallback}
      </motion.div>
    ) : (
      this.props.children
    );
  }
}
