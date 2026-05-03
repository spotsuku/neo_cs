// Server-only Repository ファサード
//
// REPO_DRIVER に従って mock / supabase 実装を返す。
// Server Components / Server Actions / Route Handler から import すること。
// クライアントコンポーネントから import すると `server-only` 経由で build
// エラーになる (これは意図したガード)。
//
// 使い方:
//   import { getRepo } from "@/lib/repository/server";
//   const repo = getRepo();
//   const list = await repo.companies.list({ organizationId });

import "server-only";
import type { Repository } from "./types";
import { mockRepository } from "./mock";
import { supabaseRepository } from "./supabase";

export type RepoDriver = "mock" | "supabase";

export function resolveDriver(): RepoDriver {
  const raw = process.env.REPO_DRIVER?.toLowerCase();
  return raw === "supabase" ? "supabase" : "mock";
}

let cached: Repository | null = null;

export function getRepo(): Repository {
  if (cached) return cached;
  cached = resolveDriver() === "supabase" ? supabaseRepository : mockRepository;
  return cached;
}

export const repoDriver: RepoDriver = resolveDriver();
