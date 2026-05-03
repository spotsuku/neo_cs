/**
 * Supabase API プロキシ（upsert修正版）
 * POST /api/db { key, value }          → 保存（upsert）
 * POST /api/db { action:'all' }        → 全データ取得
 * POST /api/db { action:'del', key }   → 削除
 */

const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_ANON_KEY が未設定です' });
  }

  let body;
  try {
    body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : (req.body || await readBody(req));
  } catch(e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const host = new URL(supabaseUrl).hostname;

  // ── 全データ取得 ──
  if (body.action === 'all') {
    try {
      const rows = await sbReq(
        host, supabaseKey,
        '/rest/v1/ps_data?select=key,value&limit=1000',
        'GET'
      );
      return res.status(200).json({ rows: rows || [] });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── 削除 ──
  if (body.action === 'del') {
    const { key } = body;
    if (!key) return res.status(400).json({ error: 'key required' });
    try {
      await sbReq(
        host, supabaseKey,
        `/rest/v1/ps_data?key=eq.${encodeURIComponent(key)}`,
        'DELETE'
      );
      return res.status(200).json({ ok: true });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── 保存（upsert）──
  // onConflict=key を URL パラメータに含めることで
  // 同一キーが存在する場合は UPDATE、存在しない場合は INSERT
  const { key, value } = body;
  if (!key) return res.status(400).json({ error: 'key required' });
  try {
    await sbReq(
      host, supabaseKey,
      '/rest/v1/ps_data?on_conflict=key',   // ← upsert のキー指定
      'POST',
      JSON.stringify({ key, value }),
      {
        'Prefer': 'resolution=merge-duplicates,return=minimal',
        'Content-Type': 'application/json',
      }
    );
    return res.status(200).json({ ok: true, key });
  } catch(e) {
    console.error('[api/db] upsert error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => { d += c; });
    req.on('end', () => {
      try { resolve(d ? JSON.parse(d) : {}); }
      catch(e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sbReq(host, apiKey, path, method, body, extra = {}) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type':  'application/json',
      'apikey':        apiKey,
      'Authorization': `Bearer ${apiKey}`,
      ...extra,
    };
    if (body) headers['Content-Length'] = Buffer.byteLength(body);

    const options = { hostname: host, path, method, headers };

    const req = https.request(options, r => {
      let d = '';
      r.on('data', c => { d += c; });
      r.on('end', () => {
        if (r.statusCode >= 400) {
          reject(new Error(`Supabase ${r.statusCode}: ${d.slice(0, 300)}`));
        } else {
          try { resolve(d ? JSON.parse(d) : null); }
          catch(e) { resolve(null); }
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
