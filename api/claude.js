/**
 * NEO ACADEMIA PS Dashboard
 * API Proxy: /api/claude
 *
 * Anthropic API キーをサーバー側で管理し、
 * ブラウザからの直接API呼び出し（CORS）を回避する。
 *
 * 使い方:
 *   POST /api/claude
 *   Body: { model, max_tokens, messages }
 */

const https = require('https');

module.exports = async function handler(req, res) {
  // CORSヘッダー（開発時はすべて許可、本番はオリジンを絞る）
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // プリフライトリクエスト
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY が設定されていません。.env を確認してください。' });
    return;
  }

  try {
    const { model, max_tokens, messages, system } = req.body;

    // Anthropic API へリクエスト
    const payload = JSON.stringify({
      model:      model      || 'claude-sonnet-4-20250514',
      max_tokens: max_tokens || 1000,
      messages:   messages   || [],
      ...(system ? { system } : {}),
    });

    const response = await callAnthropicAPI(apiKey, payload);
    res.status(200).json(response);

  } catch (err) {
    console.error('[/api/claude] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Node.js 標準 https モジュールで Anthropic API を呼び出す
 * （外部ライブラリ不要）
 */
function callAnthropicAPI(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (apiRes.statusCode >= 400) {
            reject(new Error(`Anthropic API Error ${apiRes.statusCode}: ${parsed.error?.message || data}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`JSON parse error: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
