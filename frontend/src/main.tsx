import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/index.css';
import { watchForNewVersion } from './lib/lazyPage';

// si quedó abierta una versión vieja y falta un archivo, la web se recarga sola
watchForNewVersion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
