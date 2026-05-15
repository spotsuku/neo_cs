// lib/master/ バレル: 旧 `@/lib/mock/data` の互換 import を吸収するための入口。
//
// 新規コードはなるべく細分化されたサブモジュール
// (`@/lib/master/products` / `@/lib/master/format` / `@/lib/master/date` /
//  `@/lib/master/onboarding` / `@/lib/master/participants` / `@/lib/master/surveys`)
// から直接 import すること。

export * from "./products";
export * from "./format";
