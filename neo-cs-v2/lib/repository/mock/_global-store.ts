// mock リポジトリ共通: globalThis に状態を寄せて Server Action / Server Component
// 間で同じ参照を共有するヘルパ。
//
// 背景:
//   Next.js dev (webpack) では (action-browser) と (rsc) で module graph が
//   分離されることがあり、module-level の `const store = []` だと両者で
//   別配列インスタンスになる → mutation が見えない。
//   globalThis (Node プロセス単位) なら両者が同じ参照を見る。
//
// 利用法:
//   const store = useGlobalStore<Foo>("__fooStore", () => seed.map(...));

type GlobalBucket = Record<string, unknown>;

export function useGlobalStore<T>(key: string, factory: () => T): T {
  const G = globalThis as unknown as GlobalBucket;
  if (G[key] === undefined) {
    G[key] = factory();
  }
  return G[key] as T;
}
