import { supabase } from './supabase';

export const SESION_EXPIRADA = 'Tu sesión expiró. Cierra sesión y vuelve a entrar para usar esta función.';

// POST JSON a una función /api/* con el token de la sesión actual de Supabase.
// Devuelve { ok, status, data }; si no hay sesión o el servidor responde 401, data.error trae un mensaje claro.
export async function apiPost(path, payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, status: 401, data: { error: SESION_EXPIRADA } };

  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  });
  let data = {};
  try { data = await res.json(); } catch { /* respuesta sin JSON */ }
  if (res.status === 401) data = { error: SESION_EXPIRADA };
  if (res.status === 413) data = { error: 'El mensaje o la imagen es demasiado grande.' };
  return { ok: res.ok, status: res.status, data };
}
