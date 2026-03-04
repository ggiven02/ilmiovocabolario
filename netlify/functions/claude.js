export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json();

    // Special route: Wiktionary pronunciation lookup
    if (body.wiktionary) {
      const word = body.wiktionary.toLowerCase().trim();
      const wikiUrl = `https://it.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&format=json&origin=*`;
      const wikiRes = await fetch(wikiUrl);
      const wikiData = await wikiRes.json();
      
      let pronuncia = null;

      if (wikiData.parse && wikiData.parse.wikitext) {
        const text = wikiData.parse.wikitext['*'];
        
        // Try to extract IPA pronunciation
        const ipaMatch = text.match(/\{\{IPA\|([^}]+)\}\}/);
        if (ipaMatch) {
          pronuncia = ipaMatch[1].replace(/\//g, '').trim();
        }

        // Try to extract syllabification (sillabazione)
        const sillabaMatch = text.match(/sill[^=]*=\s*([^\n|}\]]+)/i) ||
                             text.match(/\{\{sill\|([^}]+)\}\}/i) ||
                             text.match(/sillabazione[^\n]*\n[^=]*?([a-zàáèéìíòóùú·\-]+(?:[·\-][a-zàáèéìíòóùú]+)+)/i);
        
        if (sillabaMatch) {
          // Convert middle dots or other separators to hyphens
          pronuncia = sillabaMatch[1].replace(/·/g, '-').trim();
        }
      }

      return new Response(JSON.stringify({ pronuncia }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Normal AI route
    const groqBody = {
      model: 'llama-3.3-70b-versatile',
      max_tokens: body.max_tokens || 2000,
      messages: body.messages,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(groqBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await response.json();

    const converted = {
      content: [{ type: 'text', text: data.choices?.[0]?.message?.content || '' }]
    };

    return new Response(JSON.stringify(converted), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};

export const config = { path: '/api/claude' };
