import type { Avatar as AvatarId } from '@/lib/types';

const CONFIG: Record<AvatarId, { kind: 'duende' | 'reno'; main: string; accent: string; label: string }> = {
  duende_rojo: { kind: 'duende', main: '#c8102e', accent: '#f4d58d', label: 'Duende de gorro rojo' },
  duende_verde: { kind: 'duende', main: '#1f5135', accent: '#fff8ec', label: 'Duende de gorro verde' },
  duende_dorado: { kind: 'duende', main: '#e8b931', accent: '#c8102e', label: 'Duende de gorro dorado' },
  reno_canela: { kind: 'reno', main: '#9a6236', accent: '#1b1420', label: 'Reno canela' },
  reno_nieve: { kind: 'reno', main: '#e9dccb', accent: '#1b1420', label: 'Reno de las nieves' },
  reno_brasita: { kind: 'reno', main: '#9a6236', accent: '#ff2a3a', label: 'Reno de nariz brillante' },
};

export const AVATAR_LABEL = (id: AvatarId) => CONFIG[id]?.label ?? 'Avatar';

/** Avatares ilustrados de duende o reno (SVG propio). */
export function Avatar({ id, size = 56, className }: { id: AvatarId; size?: number; className?: string }) {
  const c = CONFIG[id] ?? CONFIG.duende_rojo;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label={c.label}>
      <circle cx="32" cy="32" r="31" fill="#cfe8f5" />
      {c.kind === 'duende' ? (
        <>
          <path d="M14 30 L32 4 L50 30 Z" fill={c.main} />
          <circle cx="32" cy="5" r="4" fill="#e8b931" />
          <path d="M10 33 L4 26 L14 32Z M54 33 L60 26 L50 32Z" fill="#f6c9a8" />
          <circle cx="32" cy="38" r="17" fill="#f6c9a8" />
          <rect x="13" y="26" width="38" height="7" rx="3.5" fill={c.accent} />
        </>
      ) : (
        <>
          <path d="M20 18 l-6 -10 M20 18 l-10 -2 M44 18 l6 -10 M44 18 l10 -2" stroke="#d9b98c" strokeWidth="3.5" strokeLinecap="round" />
          <ellipse cx="14" cy="28" rx="6" ry="4" fill={c.main} />
          <ellipse cx="50" cy="28" rx="6" ry="4" fill={c.main} />
          <circle cx="32" cy="35" r="18" fill={c.main} />
          <ellipse cx="32" cy="44" rx="10" ry="8" fill="#e8c9a0" />
          <circle cx="32" cy="40" r={id === 'reno_brasita' ? 5 : 3.5} fill={c.accent} />
          {id === 'reno_brasita' && <circle cx="32" cy="40" r="8" fill="#ff2a3a" opacity="0.25" />}
        </>
      )}
      <circle cx="25" cy="34" r="2.6" fill="#1b1420" />
      <circle cx="39" cy="34" r="2.6" fill="#1b1420" />
      <circle cx="26" cy="33" r="0.9" fill="#fff" />
      <circle cx="40" cy="33" r="0.9" fill="#fff" />
      <ellipse cx="21" cy="40" rx="3.2" ry="2" fill="#ff8fa0" opacity="0.8" />
      <ellipse cx="43" cy="40" rx="3.2" ry="2" fill="#ff8fa0" opacity="0.8" />
      {c.kind === 'duende' && <path d="M27 44 q5 4 10 0" stroke="#7a1f2b" strokeWidth="2" fill="none" strokeLinecap="round" />}
    </svg>
  );
}
