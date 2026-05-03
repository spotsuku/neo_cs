/**
 * バンドラに静的解析されない動的 import
 *
 * `import('pkg' as string)` は TypeScript はだませても webpack/Turbopack の
 * 静的解析はすり抜けず、未導入パッケージで build が失敗する。
 *
 * `new Function` 経由にすると、文字列はランタイムまで評価されないため
 * バンドラは見えない → 未導入でも build が通る。
 *
 * 使い方:
 *   const supabase = await optionalImport<typeof import('@supabase/supabase-js')>(
 *     '@supabase/supabase-js'
 *   );
 *   if (!supabase) return null; // 未導入なら no-op フォールバック
 */

const dynImport = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;

export async function optionalImport<T = unknown>(specifier: string): Promise<T | null> {
  try {
    return (await dynImport(specifier)) as T;
  } catch {
    return null;
  }
}
