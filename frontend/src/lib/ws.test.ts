import { wsBase } from './ws';

const https = { protocol: 'https:', host: 'buzon.cl' };

describe('origen de los WebSockets', () => {
  it('sin backend aparte usa el mismo origen (Docker)', () => {
    expect(wsBase({}, '', https)).toBe('wss://buzon.cl');
    expect(wsBase({ public: true }, '', { protocol: 'http:', host: 'localhost:5173' })).toBe('ws://localhost:5173');
  });

  it('con backend aparte solo conecta los sockets públicos, siempre por wss', () => {
    expect(wsBase({ public: true }, 'wss://api.vercel.app', https)).toBe('wss://api.vercel.app');
    expect(wsBase({ public: true }, 'https://api.vercel.app', https)).toBe('wss://api.vercel.app');
    // las cartas necesitan la cookie de sesión, que no viaja a otro dominio
    expect(wsBase({}, 'wss://api.vercel.app', https)).toBeNull();
  });
});
