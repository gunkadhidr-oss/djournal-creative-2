export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured on the server.'
    });
  }

  try {
    const { payload } = req.body || {};

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Missing Gemini request payload.' });
    }

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `gemini-3-flash-preview:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).send(text);
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(text);
  } catch (error) {
    console.error('Gemini proxy error:', error);
    return res.status(500).json({
      error: 'Failed to contact Gemini API.'
    });
  }
}
