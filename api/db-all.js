/**
 * GET /api/db/all → Supabaseの全データを一括取得
 * ページロード時に全LocalStorageキーを同期するために使用
 */

const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase環境変数が未設定です' });
  }

  try {
    const url  = new URL(supabaseUrl);
    const rows = await supabaseGet(url.hostname, supabaseKey, '/rest/v1/ps_data?select=key,value');
    return res.status(200).json({ rows: rows || [] });
  } catch (e) {
    console.error('[/api/db/all]', e.message);
    return res.status(500).json({ error: e.message });
  }
};

function supabaseGet(hostname, apiKey, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: 'GET',
      headers: {
        'apikey':        apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
    };
    const req = https.request(options, apiRes => {
      let data = '';
      apiRes.on('data', c => { data += c; });
      apiRes.on('end', () => {
        if (apiRes.statusCode >= 400) {
          reject(new Error(`Supabase ${apiRes.statusCode}: ${data.slice(0, 200)}`));
        } else {
          try { resolve(JSON.parse(data)); }
          catch (e) { resolve([]); }
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}
