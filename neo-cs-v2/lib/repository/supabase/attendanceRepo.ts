// attendance_events (Supabase 実装)
// マイグレーション: supabase/migrations/0001_init.sql attendance_events
//
// 列マッピング:
//   participant_id ↔ participantId
//   session_id     ↔ sessionId
//   recorded_at    ↔ recordedAt (timestamptz → YYYY-MM-DD)
//   recorded_by    ↔ recordedBy (uuid → string そのまま)
//   note           ↔ note
//
// CHECK 制約: status は ('present','absent','late') のみ。mock の
// 'excused' は本テーブルでは保持できないため supabase 側からは返らない
// (write 機能を実装する際に migration で 'excused' を追加するか要検討)。
// 型上は AttendanceRecord["status"] が広いままだが、Supabase 経由では
// 3値のみが返る。

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import type { AttendanceEvent, AttendanceRepo } from "../types";

type Row = {
  id: string;
  organization_id: string;
  participant_id: string;
  session_id: string;
  status: "present" | "absent" | "late";
  recorded_at: string;
  recorded_by: string | null;
  note: string | null;
};

function toDate(iso: string): string {
  return iso.slice(0, 10);
}

export const supabaseAttendanceRepo: AttendanceRepo = {
  async listByContract(contractId) {
    const sb = getServiceClient();
    // 該当契約のセッション ID を一旦取得し attendance_events を IN で絞る
    const { data: sess, error: sErr } = await sb
      .from("sessions")
      .select("id")
      .eq("contract_id", contractId);
    if (sErr) throw new Error(`sessions.listForAttendance: ${sErr.message}`);
    const ids = (sess ?? []).map((s: { id: string }) => s.id);
    if (ids.length === 0) return [];

    const { data, error } = await sb
      .from("attendance_events")
      .select("*")
      .in("session_id", ids);
    if (error) throw new Error(`attendance_events.listByContract: ${error.message}`);

    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      participantId: r.participant_id,
      sessionId: r.session_id,
      status: r.status,
      recordedAt: toDate(r.recorded_at),
      recordedBy: r.recorded_by ?? "",
      note: r.note ?? undefined
    } satisfies AttendanceEvent));
  }
};
