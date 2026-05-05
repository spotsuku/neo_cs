"use client";

// アクティブなCS担当者一覧（フォームのアサイン候補に使う）
//
// 設計:
//   - userRepo.list({ activeOnly: true }) を非同期取得しキャッシュ
//   - ASSIGNEES ハードコード配列の置換用
//   - 並び順は role: admin → manager → member → viewer、name asc
//
// 使い方:
//   const { members, names, ready } = useActiveMembers();
//   {names.map(n => <option key={n}>{n}</option>)}

import { useEffect, useState } from "react";
import { userRepo } from "@/lib/repository";
import type { AppUser, AppUserRole } from "@/lib/repository";

const ROLE_ORDER: Record<AppUserRole, number> = {
  admin: 0,
  manager: 1,
  member: 2,
  viewer: 3,
  external: 4
};

let cached: AppUser[] | null = null;
let pending: Promise<AppUser[]> | null = null;

function sortMembers(list: AppUser[]): AppUser[] {
  return [...list].sort((a, b) => {
    const r = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (r !== 0) return r;
    return a.name.localeCompare(b.name, "ja");
  });
}

export function useActiveMembers(): {
  members: AppUser[];
  names: string[];
  ready: boolean;
} {
  const [members, setMembers] = useState<AppUser[]>(cached ?? []);
  const [ready, setReady] = useState<boolean>(cached !== null);

  useEffect(() => {
    if (cached) return;
    if (!pending) {
      pending = userRepo.list({ activeOnly: true }).then((list) => {
        cached = sortMembers(list);
        return cached;
      });
    }
    let cancelled = false;
    pending.then((list) => {
      if (cancelled) return;
      setMembers(list);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { members, names: members.map((m) => m.name), ready };
}
