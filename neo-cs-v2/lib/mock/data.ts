// 後方互換: lib/master/products + lib/master/format への re-export 専用ファイル。
//
// 新規コードは `@/lib/master/products` / `@/lib/master/format` から直接 import すること。
// このファイル経由の import は段階的に置換中で、将来的に削除予定。

export {
  type ProductCode,
  type ProductType,
  type CycleUnit,
  type CycleSyncMode,
  type Course,
  products,
  productByCode,
  productCourses,
  cycleLabel,
  hasMultipleCourses,
  courseByKey,
  courseName,
  courseShortName
} from "@/lib/master/products";

export { yen, pct, nrrFormat } from "@/lib/master/format";
