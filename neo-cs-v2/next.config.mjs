/** @type {import('next').NextConfig} */

// セキュリティヘッダ (reviews/11_情シスセキュリティ.md, 16_SRE.md)
//   CSP は段階導入を経て enforce へ昇格。緊急時は CSP_ENFORCE=false で Report-Only に戻せる。
const isProd = process.env.NODE_ENV === 'production';
const cspReport = process.env.CSP_REPORT_URI ?? '';
const cspEnforce = (process.env.CSP_ENFORCE ?? 'true') !== 'false';
const cspHeaderKey = cspEnforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://api.anthropic.com",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'self'",
  cspReport ? `report-uri ${cspReport}` : '',
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: cspHeaderKey, value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ...(isProd
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload',
        },
      ]
    : []),
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
