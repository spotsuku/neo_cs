/**
 * NEO ACADEMIA CSポータル v1 サーバー (凍結済)
 *
 * 2026-05-03 ストリーム04にて旧 SPA (`index.html`) の配信を停止。
 *   - Stored XSS が残存しているため (reviews/11_情シスセキュリティ.md §6)
 *   - 後継は neo-cs-v2/ (Next.js)
 *   - ファイル本体は _legacy/index.html に退避 (履歴保持)。物理削除は
 *     ストリーム01 の v1 全廃 PR で実施予定。
 *
 * 本ファイルは旧URLにブックマーク等で到達したユーザーへ
 * 410 Gone と移行案内のみを返す。
 */

const http = require('http');
const PORT = process.env.PORT || 3000;
const NEW_URL = process.env.NEO_CS_V2_URL || 'https://cs.neoacademia.jp';

const HTML = `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8">
<title>NEO CS — サービス移行のお知らせ</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#0e1a2b;color:#e6edf5;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
  main{max-width:520px;background:#13243b;border-radius:14px;padding:32px;
       box-shadow:0 20px 60px rgba(0,0,0,.4)}
  h1{margin:0 0 12px;font-size:20px}
  p{line-height:1.7;margin:0 0 12px;color:#b6c4d6;font-size:14px}
  a.btn{display:inline-block;margin-top:12px;background:#3D9EFF;color:#fff;
        text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700}
  code{background:#0a1424;padding:2px 6px;border-radius:4px;font-size:12px}
</style></head>
<body><main>
  <h1>NEO CS ポータルは新しいURLへ移行しました</h1>
  <p>旧版 (<code>index.html</code>) の提供は <strong>2026-05-03</strong> に終了しました。
     セキュリティ強化のため、新ポータル (Next.js 版) をご利用ください。</p>
  <p>ブックマークの更新をお願いします。</p>
  <a class="btn" href="__NEW_URL__">新ポータルを開く</a>
</main></body></html>`;

const SECURITY_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

const server = http.createServer((req, res) => {
  res.writeHead(410, SECURITY_HEADERS);
  res.end(HTML.replace('__NEW_URL__', NEW_URL));
});

server.listen(PORT, () => {
  console.log(`v1 frozen — serving 410 Gone notice on :${PORT}`);
  console.log(`   redirect target: ${NEW_URL}`);
});
