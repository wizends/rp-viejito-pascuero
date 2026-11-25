import type {
  Child,
  ChildInput,
  GiftInput,
  Letter,
  Shipment,
  StopInput,
  Tracking,
  User,
} from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function csrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)vp_csrf=([^;]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : '';
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return 'Revisa los datos del formulario.';
  }
  if (status === 0) return 'Sin conexión con el Polo Norte. Revisa tu internet.';
  return 'Algo se enredó en el taller. Inténtalo de nuevo.';
}

export async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
  retry = true,
): Promise<T> {
  const { json, headers, ...rest } = init;
  const method = (rest.method ?? 'GET').toUpperCase();
  const h = new Headers(headers);
  if (json !== undefined) h.set('Content-Type', 'application/json');
  if (method !== 'GET') h.set('X-CSRF-Token', csrfToken());

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...rest,
      method,
      headers: h,
      credentials: 'same-origin',
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, messageFrom(null, 0));
  }

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await tryRefresh()) return request<T>(path, init, false);
  }
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageFrom(body, res.status));
  return body as T;
}

/** Descarga una imagen de la API (con la sesión, si hay). */
async function image(path: string, retry = true): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError(0, messageFrom(null, 0));
  }
  if (res.status === 401 && retry && (await tryRefresh())) return image(path, false);
  if (!res.ok) throw new ApiError(res.status, messageFrom(await res.json().catch(() => null), res.status));
  return res.blob();
}

export const api = {
  me: () => request<User>('/auth/me'),
  login: (email: string, password: string) =>
    request<User>('/auth/login', { method: 'POST', json: { email, password } }),
  register: (email: string, password: string, display_name: string) =>
    request<User>('/auth/register', { method: 'POST', json: { email, password, display_name } }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  updateMe: (patch: Partial<Pick<User, 'display_name' | 'allow_external_ai'>>) =>
    request<User>('/auth/me', { method: 'PATCH', json: patch }),

  children: () => request<Child[]>('/children'),
  createChild: (c: ChildInput) => request<Child>('/children', { method: 'POST', json: c }),
  updateChild: (id: string, c: Partial<ChildInput>) =>
    request<Child>(`/children/${id}`, { method: 'PATCH', json: c }),
  deleteChild: (id: string) => request<void>(`/children/${id}`, { method: 'DELETE' }),

  letters: (childId?: string) =>
    request<Letter[]>(`/letters${childId ? `?child_id=${encodeURIComponent(childId)}` : ''}`),
  writeLetter: (child_id: string, deseos: string[], mensaje: string) =>
    request<Letter>('/letters', { method: 'POST', json: { child_id, deseos, mensaje } }),
  uploadLetter: (child_id: string, file: Blob, mensaje: string) => {
    const fd = new FormData();
    fd.set('child_id', child_id);
    fd.set('mensaje', mensaje);
    fd.set('file', file, 'carta.jpg');
    return request<Letter>('/letters/upload', { method: 'POST', body: fd });
  },
  updateLetter: (
    id: string,
    patch: { texto_original?: string; texto_normalizado?: string; gifts?: GiftInput[] },
  ) => request<Letter>(`/letters/${id}`, { method: 'PATCH', json: patch }),
  letter: (id: string) => request<Letter>(`/letters/${id}`),
  letterImage: (id: string) => image(`/letters/${id}/image`),
  deleteLetter: (id: string) => request<void>(`/letters/${id}`, { method: 'DELETE' }),

  shipment: (childId: string) => request<Shipment>(`/children/${childId}/shipment`),
  setArrival: (id: string, arrival_at: string) =>
    request<Shipment>(`/shipments/${id}`, { method: 'PATCH', json: { arrival_at } }),
  addStop: (id: string, stop: StopInput) =>
    request<Shipment>(`/shipments/${id}/stops`, { method: 'POST', json: stop }),
  addTemplates: (id: string) =>
    request<Shipment>(`/shipments/${id}/stops/templates`, { method: 'POST' }),
  reorderStops: (id: string, ids: string[]) =>
    request<Shipment>(`/shipments/${id}/stops/order`, { method: 'PUT', json: { ids } }),
  updateStop: (id: string, patch: Partial<StopInput> & { completed?: boolean }) =>
    request<Shipment>(`/stops/${id}`, { method: 'PATCH', json: patch }),
  deleteStop: (id: string) => request<Shipment>(`/stops/${id}`, { method: 'DELETE' }),
  treePhoto: (id: string) => image(`/shipments/${id}/tree`),
  uploadTreePhoto: (id: string, file: Blob) => {
    const fd = new FormData();
    fd.set('file', file, 'arbol.jpg');
    return request<Shipment>(`/shipments/${id}/tree`, { method: 'PUT', body: fd });
  },
  deleteTreePhoto: (id: string) => request<Shipment>(`/shipments/${id}/tree`, { method: 'DELETE' }),

  tracking: (code: string) => request<Tracking>(`/tracking/${encodeURIComponent(code)}`),
  selfie: (code: string) => image(`/tracking/${encodeURIComponent(code)}/selfie`),
};
