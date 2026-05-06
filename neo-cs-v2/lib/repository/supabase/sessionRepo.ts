// sessions (Supabase 実装)
// マイグレーション: supabase/migrations/0001_init.sql sessions
//
// 列マッピング:
//   session_number ↔ sessionNumber
//   scheduled_at   ↔ scheduledAt (timestamptz → YYYY-MM-DD で返却して mock 互換)
//   completed_at   ↔ completedAt
//
// expectedParticipantIds は DB に保持されないため、participants テーブルの
// (contract_id 一致) を join して動的に計算する。

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import type { Session, SessionRepo } from "../types";

type Row = {
  id: string;
  organization_id: string;
  contract_id: string;
  session_number: number;
  scheduled_at: string;
  completed_at: string | null;
  title: string | null;
};

/** timestamptz を YYYY-MM-DD に正規化 (mock の Session は日付文字列のため) */
function toDate(iso: string): string {
  return iso.slice(0, 10);
}

export const supabaseSessionRepo: SessionRepo = {
  async listByContract(contractId) {
    const sb = getServiceClient();
    const [sessRes, partRes] = await Promise.all([
      sb
        .from("sessions")
        .select("*")
        .eq("contract_id", contractId)
        .order("session_number", { ascending: true }),
      sb
        .from("participants")
        .select("id")
        .eq("contract_id", contractId)
    ]);
    if (sessRes.error)
      throw new Error(`sessions.listByContract: ${sessRes.error.message}`);
    if (partRes.error)
      throw new Error(`participants.listForSessions: ${partRes.error.message}`);

    const expectedIds = (partRes.data ?? []).map((p: { id: string }) => p.id);
    return ((sessRes.data ?? []) as Row[]).map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      contractId: r.contract_id,
      sessionNumber: r.session_number,
      scheduledAt: toDate(r.scheduled_at),
      completedAt: r.completed_at ? toDate(r.completed_at) : undefined,
      title: r.title ?? "",
      expectedParticipantIds: [...expectedIds]
    } satisfies Session));
  }
};
