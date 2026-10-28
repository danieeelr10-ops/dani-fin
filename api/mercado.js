import { json, requireUser, readJsonLimited } from './_auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const denied = await requireUser(req);
  if (denied) return denied;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: 'API key no configurada' }, 500);

  // Imagen base64 ya comprimida por el frontend (~1400px); 4 MB sobra y queda bajo el tope de Vercel.
  const parsed = await readJsonLimited(req, 4_000_000);
  if (parsed.error) return parsed.error;
  const { image, mediaType } = parsed.body;
  if (!image || typeof image !== 'string') return json({ error: 'Imagen requerida' }, 400);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image },
            },
            {
              type: 'text',
              text: `Analiza esta foto de factura o tiquete de mercado/supermercado.
Extrae todos los productos comprados con su nombre, precio y cantidad.

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{"items": [{"nombre": "Leche Alpina 1L", "precio": 4200, "cantidad": 2}]}

Reglas:
- nombre: nombre simplificado del producto en español
- precio: precio TOTAL del ítem (unitario × cantidad), entero en pesos colombianos
- cantidad: unidades compradas (entero)
- Omite descuentos, subtotales, impuestos, totales — solo productos individuales
- Si no es una factura: {"items": [], "error": "No es una factura de mercado"}`
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return json({ error: data.error?.message || 'Error de API' }, 500);
    }

    const text = data.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return json({ error: 'No se pudo leer la factura' }, 500);

    return json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    return json({ error: 'Error procesando la imagen' }, 500);
  }
}
