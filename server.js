/**
 * NEO ACADEMIA PS Dashboard
 * サーバー起動エントリーポイント
 *
 * 起動: node server.js
 * または: npm start
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

// .env を読み込む（dotenv が無くても動く簡易実装）
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const [key, ...vals] = line.split('=');
      if (key && key.trim() && !key.startsWith('#')) {
        process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
}

const PORT = process.env.PORT || 3000;
const claudeHandler = require('./api/claude');

// リクエストボディを JSON でパース
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch(e) { reject(new Error('Invalid JSON')); }
    });
  });
}

// MIMEタイプ
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const parsed  = url.parse(req.url);
  const pathname = parsed.pathname;

  // ── API エンドポイント ──
  if (pathname === '/api/claude') {
    try {
      req.body = await parseBody(req);
    } catch (e) {
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }
    await claudeHandler(req, res);
    return;
  }

  // ── 静的ファイル配信 ──
  let filePath;
  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(__dirname, 'index.html');
  } else {
    filePath = path.join(__dirname, pathname);
  }

  // パストラバーサル対策
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Not found');
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type': mime});
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 NEO ACADEMIA PS Dashboard`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/claude`);
  console.log(`\n   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ 設定済み' : '❌ 未設定（.env を確認）'}`);
  console.log(`\n   停止: Ctrl+C\n`);
});
