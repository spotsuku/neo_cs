/**
 * Google OAuth 認証 API
 * POST /api/auth { action:'verify', token }  → Googleトークン検証・ユーザー登録
 * POST /api/auth { action:'users' }           → ユーザー一覧取得（管理者のみ）
 * POST /api/auth { action:'setRole', email, role } → 権限変更（管理者のみ）
 */

const https = require('https');

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body;
  try {
    body = req.body || await readBody(req);
    if (typeof body === 'string') body = JSON.parse(body);
  } catch(e) { return res.status(400).json({ error: 'Invalid JSON' }); }

  const { action } = body;

  // ── Googleトークン検証 ──
  if (action === 'verify') {
    const { token } = body;
    if (!token) return res.status(400).json({ error: 'token required' });

    try {
      // Google tokeninfo API でトークン検証
      const info = await googleVerify(token);
      if (!info.email) throw new Error('Invalid token');

      // Supabase の users テーブルにユーザー登録/更新
      const user = await upsertUser(info.email, info.name, info.picture);

      return res.status(200).json({
        ok: true,
        user: {
          email: info.email,
          name:  info.name || user.name,
          picture: info.picture,
          role:  user.role || 'member',
          id:    user.id,
        }
      });
    } catch(e) {
      console.error('[auth] verify error:', e.message);
      return res.status(401).json({ error: e.message });
    }
  }

  // ── ユーザー一覧 ──
  if (action === 'users') {
    const { email } = body;
    const requester = await getUserByEmail(email);
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
    const users = await getAllUsers();
    return res.status(200).json({ users });
  }

  // ── 権限変更 ──
  if (action === 'setRole') {
    const { email, targetEmail, role } = body;
    const requester = await getUserByEmail(email);
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
    await setUserRole(targetEmail, role);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
};

function googleVerify(token) {
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`;
    https.get(url, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        if (r.statusCode !== 200) return reject(new Error('Token invalid: ' + d.slice(0,100)));
        try { resolve(JSON.parse(d)); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function upsertUser(email, name, picture) {
  const existing = await getUserByEmail(email);
  if (existing) {
    // ログイン日時更新
    await sbReq(`/rest/v1/neo_users?email=eq.${encodeURIComponent(email)}`,
      'PATCH', JSON.stringify({ last_login: new Date().toISOString(), name, picture }),
      { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' });
    return existing;
  }
  // 新規登録（最初のユーザーは管理者）
  const allUsers = await getAllUsers();
  const role = allUsers.length === 0 ? 'admin' : 'member';
  const rows = await sbReq(`/rest/v1/neo_users`, 'POST',
    JSON.stringify({ email, name, picture, role, last_login: new Date().toISOString() }),
    { 'Content-Type': 'application/json', 'Prefer': 'return=representation' });
  return Array.isArray(rows) ? rows[0] : rows;
}

function getUserByEmail(email) {
  return sbReq(`/rest/v1/neo_users?email=eq.${encodeURIComponent(email)}&select=*`, 'GET')
    .then(rows => Array.isArray(rows) ? rows[0] : null);
}

function getAllUsers() {
  return sbReq(`/rest/v1/neo_users?select=*&order=created_at`, 'GET')
    .then(rows => Array.isArray(rows) ? rows : []);
}

function setUserRole(email, role) {
  return sbReq(`/rest/v1/neo_users?email=eq.${encodeURIComponent(email)}`,
    'PATCH', JSON.stringify({ role }),
    { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' });
}

function sbReq(path, method, body, extra={}) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL);
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...extra,
    };
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    const options = { hostname: url.hostname, path, method, headers };
    const r = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`Supabase ${res.statusCode}: ${d.slice(0,200)}`));
        else { try { resolve(d ? JSON.parse(d) : null); } catch(e) { resolve(null); } }
      });
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    req.on('error', reject);
  });
}
