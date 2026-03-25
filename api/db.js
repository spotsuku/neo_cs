/**
 * Supabase データベース操作 API
 * GET  /api/db?key=xxx         → 値を取得
 * POST /api/db { key, value }  → 値を保存（upsert）
 */

const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'SUPABASE_URL または SUPABASE_ANON_KEY が未設定です'
    });
  }

  // ── GET: 値を取得 ──
  if (req.method === 'GET') {
    const { key } = req.query || parseQuery(req.url);
    if (!key) return res.status(400).json({ error: 'key が必要です' });

    try {
      const result = await supabaseRequest(
        supabaseUrl, supabaseKey,
        `/rest/v1/ps_data?key=eq.${encodeURIComponent(key)}&select=key,value`,
        'GET'
      );
      // 見つかった場合は value を返す
      if (result && result.length > 0) {
        return res.status(200).json({ key, value: result[0].value, found: true });
      }
      return res.status(200).json({ key, value: null, found: false });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST: 値を保存（upsert）──
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string'
        ? JSON.parse(req.body)
        : (req.body || await readBody(req));

      const { key, value } = body;
      if (!key) return res.status(400).json({ error: 'key が必要です' });

      await supabaseRequest(
        supabaseUrl, supabaseKey,
        '/rest/v1/ps_data',
        'POST',
        JSON.stringify({ key, value }),
        { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
      );
      return res.status(200).json({ ok: true, key });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

function parseQuery(url) {
  const q = {};
  (url.split('?')[1] || '').split('&').forEach(p => {
    const [k, v] = p.split('=');
    if (k) q[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  return q;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function supabaseRequest(baseUrl, apiKey, path, method, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const options = {
      hostname: url.hostname,
      path,
      method,
      headers: {
        'Content-Type':  'application/json',
        'apikey':        apiKey,
        'Authorization': `Bearer ${apiKey}`,
        ...extraHeaders,
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    };

    const req = https.request(options, apiRes => {
      let data = '';
      apiRes.on('data', c => { data += c; });
      apiRes.on('end', () => {
        if (apiRes.statusCode >= 400) {
          reject(new Error(`Supabase ${apiRes.statusCode}: ${data.slice(0, 200)}`));
        } else {
          try { resolve(data ? JSON.parse(data) : null); }
          catch (e) { resolve(null); }
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
