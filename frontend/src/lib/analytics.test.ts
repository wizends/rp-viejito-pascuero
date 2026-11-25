import { redactEvent, redactUrl } from './analytics';

describe('analítica sin datos privados', () => {
  it('oculta el código del enlace del niño y el id de la carta', () => {
    expect(redactUrl('https://buzon.cl/seguimiento/JFNCsTRKzKPHXdtc')).toBe('https://buzon.cl/seguimiento/[codigo]');
    expect(redactUrl('https://buzon.cl/postal/89e5854d-34f7-4989-8e83-87983ceeee4b')).toBe('https://buzon.cl/postal/[carta]');
  });

  it('quita la query y el ancla, que podrían llevar cualquier cosa', () => {
    expect(redactUrl('https://buzon.cl/panel?email=a@b.cl#carta')).toBe('https://buzon.cl/panel');
  });

  it('deja intactas las páginas sin datos privados', () => {
    expect(redactUrl('https://buzon.cl/')).toBe('https://buzon.cl/');
    expect(redactUrl('https://buzon.cl/privacidad')).toBe('https://buzon.cl/privacidad');
  });

  it('limpia el evento sin perder sus otros campos', () => {
    expect(redactEvent({ type: 'pageview', url: 'https://buzon.cl/seguimiento/abc?x=1' })).toEqual({
      type: 'pageview',
      url: 'https://buzon.cl/seguimiento/[codigo]',
    });
  });
});
