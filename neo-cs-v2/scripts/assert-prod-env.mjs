#!/usr/bin/env node
// 本番ビルド時の環境前提を check する prebuild ガード。
// next.config.mjs は NODE_ENV !== 'production' で CSP に 'unsafe-eval' を含める。
// 本番デプロイ (Vercel など) では NODE_ENV='production' で起動される必要があるため、
// build コマンド実行時にこれを assert し、誤って dev ビルドを本番に push する事故を防ぐ。
//
// CI/Vercel: NODE_ENV='production' で実行される。
// ローカル開発で `npm run build` する場合: NODE_ENV='production' を付与すれば OK。
//   $ NODE_ENV=production npm run build

const skip = process.env.SKIP_BUILD_ASSERT === '1';
const env = process.env.NODE_ENV;

if (skip) {
  console.warn('[assert-prod-env] SKIP_BUILD_ASSERT=1 のため check をスキップ');
  process.exit(0);
}

if (env !== 'production') {
  console.error(
    `[assert-prod-env] エラー: NODE_ENV='${env ?? '(unset)'}' で next build を実行しようとしています。\n` +
      `本番ビルドは NODE_ENV='production' で実行してください。\n` +
      `ローカルで dev ビルドを意図して試したい場合は SKIP_BUILD_ASSERT=1 を付与してください。`
  );
  process.exit(1);
}

console.log('[assert-prod-env] NODE_ENV=production を確認');
