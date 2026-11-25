import { beforeEach, describe, expect, it } from 'vitest';
import { useScene } from './scene';

describe('máquina de estados de la escena', () => {
  beforeEach(() => useScene.setState({ phase: 'idle', letterId: null, backendStatus: null }));

  it('enviar una carta arranca el vuelo', () => {
    useScene.getState().sendLetter('c1');
    expect(useScene.getState().phase).toBe('flying');
    expect(useScene.getState().backendStatus).toBe('recibida');
  });

  it('ignora eventos de otras cartas', () => {
    useScene.getState().sendLetter('c1');
    useScene.getState().setBackendStatus('otra', 'leida');
    expect(useScene.getState().backendStatus).toBe('recibida');
    useScene.getState().setBackendStatus('c1', 'necesita_ayuda');
    expect(useScene.getState().backendStatus).toBe('necesita_ayuda');
  });

  it('cada fase tiene su subtítulo accesible', () => {
    useScene.getState().setPhase('reading');
    expect(useScene.getState().caption).toMatch(/Leyendo/);
  });
});
