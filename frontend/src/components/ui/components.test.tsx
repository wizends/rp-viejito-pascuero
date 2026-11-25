import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLights } from '@/stores/lights';
import { PlugSwitch } from './PlugSwitch';
import { WriteLetterForm } from '@/features/letters/WriteLetterForm';

describe('PlugSwitch', () => {
  beforeEach(() => useLights.setState({ mode: 'off', lastOnMode: 'twinkle', audio: false }));

  it('es un switch accesible que enciende y apaga', async () => {
    render(<PlugSwitch />);
    const sw = screen.getByRole('switch', { name: /encender las luces/i });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(sw);
    expect(useLights.getState().mode).toBe('twinkle');
    expect(screen.getByRole('switch', { name: /apagar/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('permite elegir el modo con radios', async () => {
    render(<PlugSwitch />);
    await userEvent.click(screen.getByRole('radio', { name: /secuencia/i }));
    expect(useLights.getState().mode).toBe('sequence');
  });
});

describe('WriteLetterForm', () => {
  it('no envía una carta vacía y muestra el error', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<WriteLetterForm disabled={false} busy={false} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: /enviar al polo norte/i }));
    expect(await screen.findByText(/al menos un deseo/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('agrega deseos y envía', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<WriteLetterForm disabled={false} busy={false} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/nuevo deseo/i), 'Una pelota{enter}');
    await userEvent.type(screen.getByLabelText(/mi carta/i), 'Hola Viejito');
    await userEvent.click(screen.getByRole('button', { name: /enviar al polo norte/i }));
    expect(onSubmit).toHaveBeenCalledWith({ deseos: ['Una pelota'], mensaje: 'Hola Viejito' });
  });

  it('avisa si se escribe un teléfono', async () => {
    render(<WriteLetterForm disabled={false} busy={false} onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/mi carta/i), 'mi fono es 9 1234 5678');
    expect(screen.getByRole('alert')).toHaveTextContent(/teléfono/);
  });
});
