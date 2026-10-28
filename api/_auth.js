// Utilidades compartidas por las edge functions (el prefijo _ evita que Vercel las exponga como ruta).
// La URL y la anon key de Supabase son públicas (ya van en el bundle del frontend);
// se pueden sobreescribir con SUPABASE_URL / SUPABASE_ANON_KEY en Vercel.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hwhabwsjnzpmpdkwonnj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_CapoY3IsqEOA8etMcUUsOA_xLGYZAmN';

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}

// Devuelve null si la sesión es válida; si no, una Response 401 lista para devolver.
export async function requireUser(req) {
  const match = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return json({ error: 'Sesión requerida', code: 'no_session' }, 401);
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${match[1]}` }
    });
    if (r.ok) return null;
  } catch {
    return json({ error: 'No se pudo verificar la sesión', code: 'auth_unavailable' }, 503);
  }
  return json({ error: 'Sesión inválida o expirada', code: 'invalid_session' }, 401);
}

// Lee el body como JSON rechazando peticiones mayores a maxBytes. Devuelve { body } o { error: Response }.
export async function readJsonLimited(req, maxBytes) {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > maxBytes) return { error: json({ error: 'Petición demasiado grande' }, 413) };
  const text = await req.text();
  if (text.length > maxBytes) return { error: json({ error: 'Petición demasiado grande' }, 413) };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { error: json({ error: 'JSON inválido' }, 400) };
  }
}
