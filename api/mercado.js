export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key no configurada' });

  const { image, mediaType } = req.body;
  if (!image) return res.status(400).json({ error: 'Imagen requerida' });

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
      return res.status(500).json({ error: data.error?.message || 'Error de API' });
    }

    const text = data.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'No se pudo leer la factura' });

    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: 'Error procesando la imagen' });
  }
}
