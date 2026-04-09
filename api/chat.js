module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'Se requiere una API key de Claude.' });

  const { question, context } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Pregunta vacía.' });

  const systemPrompt = `Sos un asistente experto en análisis de ventas integrado en un dashboard.
Tenés acceso a los datos actuales del dashboard. Respondé de forma concisa, directa y en español.
Usá los números exactos del dashboard. Si la información no está disponible, indicalo con claridad.
No inventes datos. Podés hacer comparaciones, sacar conclusiones y dar recomendaciones basadas en los datos.

Datos actuales del dashboard:
${context || 'Sin datos cargados.'}`;

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
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.error?.message || `Error ${response.status}`;
      return res.status(response.status).json({ error: msg });
    }

    return res.json({ answer: data.content[0].text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
