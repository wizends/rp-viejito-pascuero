export interface User {
  id: string;
  email: string;
  display_name: string;
  allow_external_ai: boolean;
}

export const AVATARS = [
  'duende_rojo',
  'duende_verde',
  'duende_dorado',
  'reno_canela',
  'reno_nieve',
  'reno_brasita',
] as const;
export type Avatar = (typeof AVATARS)[number];

export interface Child {
  id: string;
  nickname: string;
  age: number | null;
  avatar: Avatar;
}
export type ChildInput = { nickname: string; age?: number | null; avatar: Avatar };

export type LetterStatus = 'recibida' | 'leyendo' | 'leida' | 'necesita_ayuda';

export interface Gift {
  id: string;
  nombre: string;
  prioridad: number | null;
  marcado: boolean;
}
export type GiftInput = Omit<Gift, 'id'>;

export interface Letter {
  id: string;
  child_id: string;
  source: 'escrita' | 'foto';
  status: LetterStatus;
  mensaje: string;
  texto_original: string;
  texto_normalizado: string;
  tono: string | null;
  confianza: number | null;
  metodo: 'ia' | 'manual' | 'escrita' | null;
  pii_masked: boolean;
  has_image: boolean;
  created_at: string;
  gifts: Gift[];
}

export const STOP_ICONS = [
  'carta',
  'taller',
  'lupa',
  'regalo',
  'trineo',
  'reno',
  'montana',
  'ciudad',
  'arbol',
  'estrella',
] as const;
export type StopIcon = (typeof STOP_ICONS)[number];

export interface Stop {
  id: string;
  position: number;
  nombre: string;
  icono: StopIcon;
  descripcion: string;
  lat: number | null;
  lng: number | null;
  eta: string | null;
  completed_at: string | null;
  auto_advance: boolean;
}
export type StopInput = {
  nombre: string;
  icono: StopIcon;
  descripcion?: string;
  lat?: number | null;
  lng?: number | null;
  eta?: string | null;
  auto_advance?: boolean;
};

export interface Shipment {
  id: string;
  child_id: string;
  share_code: string;
  arrival_at: string;
  /** el padre subió la foto del árbol para la selfie del Viejito */
  has_tree_photo: boolean;
  stops: Stop[];
}

export interface Tracking {
  nickname: string;
  avatar: Avatar;
  arrival_at: string;
  server_time: string;
  /** el regalo llegó y hay selfie del Viejito con el árbol */
  selfie: boolean;
  stops: Stop[];
}

export interface LetterStatusEvent {
  id: string;
  child_id: string;
  status: LetterStatus;
  mensaje: string;
}
