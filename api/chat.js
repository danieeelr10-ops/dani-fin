import { json, requireUser, readJsonLimited } from './_auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const denied = await requireUser(req);
  if (denied) return denied;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key no configurada' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Tope de tamaño: frena abusos con una sesión robada (el contexto financiero real pesa decenas de KB).
  const parsed = await readJsonLimited(req, 200_000);
  if (parsed.error) return parsed.error;
  const { messages, context } = parsed.body;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 60
      || messages.some(m => !m || typeof m.content !== 'string' || !['user', 'assistant'].includes(m.role))
      || (context != null && typeof context !== 'string')) {
    return json({ error: 'Petición inválida' }, 400);
  }

  const systemPrompt = `Eres el asistente financiero personal de Dani, un asesor financiero experto que conoce sus finanzas al detalle.

PERSONALIDAD:
- Hablas en español colombiano, natural y directo — como un amigo financiero de confianza
- Eres analítico pero accesible, usas emojis con moderación
- Cuando hay un problema financiero, lo dices claramente sin rodeos
- Celebras los logros: si el mes va bien, lo resaltas

FORMATO DE RESPUESTA:
- Si es una pregunta simple: 2-3 oraciones directas
- Si es un análisis: usa secciones cortas con emojis (📊 Diagnóstico, ⚠️ Problemas, ✅ Acciones)
- Siempre menciona números específicos con formato colombiano ($30.000)
- Termina con UNA recomendación concreta y accionable

CAPACIDADES:
- Detectas patrones de gasto anómalos comparando meses
- Calculas proyecciones: "A este ritmo, en fin de mes habrás gastado X"
- Comparas presupuesto vs real e identificas categorías en riesgo
- Evalúas si la tasa de ahorro es saludable (mínimo 10% para estar bien)
- Analizas si los gastos fijos son proporcionales al ingreso (idealmente <50%)

${context}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'Error de API' }), {
        status: response.status, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ text: data.content[0].text }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error de conexión' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
