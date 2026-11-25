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
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
