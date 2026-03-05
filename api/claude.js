export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    // Wiktionary pronunciation lookup
    if (body.wiktionary) {
      const word = body.wiktionary.toLowerCase().trim();
      const wikiUrl = `https://it.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&format=json&origin=*`;
      const wikiRes = await fetch(wikiUrl);
      const wikiData = await wikiRes.json();

      let pronuncia = null;

      if (wikiData.parse && wikiData.parse.wikitext) {
        const text = wikiData.parse.wikitext['*'];
        const ipaMatch = text.match(/\{\{IPA\|([^}]+)\}\}/);
        if (ipaMatch) pronuncia = ipaMatch[1].replace(/\//g, '').trim();

        const sillabaMatch = text.match(/sill[^=]*=\s*([^\n|}\]]+)/i) ||
                             text.match(/\{\{sill\|([^}]+)\}\}/i);
        if (sillabaMatch) pronuncia = sillabaMatch[1].replace(/·/g, '-').trim();
      }

      return res.status(200).json({ pronuncia });
    }

    // Normal AI route
    const groqBody = {
      model: 'llama-3.3-70b-versatile',
      max_tokens: body.max_tokens || 2000,
      messages: body.messages,
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(groqBody),
    });

    const data = await response.json();

    const converted = {
      content: [{ type: 'text', text: data.choices?.[0]?.message?.content || '' }]
    };

    return res.status(200).json(converted);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
