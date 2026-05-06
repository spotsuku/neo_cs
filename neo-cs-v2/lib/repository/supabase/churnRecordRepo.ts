// 解約レコード Supabase リポジトリ
// マイグレーション: supabase/migrations/0001_init.sql
//   churn_events          (1 row / churn 決定)
//   churn_event_reasons   (junction: 1 churn × n reason_category)
//
// 解約予兆 (churn_signals) とは別物 — こちらは「実際に解約したレコード」。
// CompanyDetail の解約タブが listByCompany を介して読む。

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import {
  DEFAULT_ORG_ID,
  type ChurnRecord,
  type ChurnRecordRepo,
  type ChurnRecordUpsertInput,
  type ChurnReasonCategory
} from "../types";

type EventRow = {
  id: string;
  organization_id: string;
  contract_id: string;
  churned_at: string;
  reason_note: string | null;
  next_action_date: string | null;
  next_action_note: string | null;
  notified: boolean;
  created_at: string;
  created_by: string | null;
};

type ReasonRow = {
  churn_event_id: string;
  reason_category: ChurnReasonCategory;
};

/**
 * EventRow + reason_categories[] → ChurnRecord 変換
 *
 * NOTE: DB は churn_event_reasons で複数 reason を持てる schema だが、
 * mock 側 ChurnRecord は単一 reasonCategory しか持たない。
 * TODO: 複数理由対応する場合は ChurnRecord 型を reasonCategories: string[] に
 *       拡張する。現状は配列の先頭 (or "other") を採用する。
 *
 * NOTE: verifiedByCustomer / verifiedAt / verificationNote は DB に列が無いため
 *       常に false / undefined を返す。setVerification は no-op + audit log。
 *       TODO: migration で列追加するか jsonb メタ列を用意する。
 */
function toRecord(ev: EventRow, reasons: ChurnReasonCategory[]): ChurnRecord {
  return {
    contractId: ev.contract_id,
    churnedAt: ev.churned_at,
    reasonCategory: reasons[0] ?? "other",
    reasonNote: ev.reason_note ?? "",
    verifiedByCustomer: false, // TODO: schema 不足
    verifiedAt: undefined,      // TODO: schema 不足
    verificationNote: undefined, // TODO: schema 不足
    nextActionDate: ev.next_action_date ?? undefined,
    nextActionNote: ev.next_action_note ?? undefined,
    notified: ev.notified
  };
}

async function fetchReasonsForEvents(
  sb: ReturnType<typeof getServiceClient>,
  eventIds: string[]
): Promise<Map<string, ChurnReasonCategory[]>> {
  const map = new Map<string, ChurnReasonCategory[]>();
  if (eventIds.length === 0) return map;
  const { data, error } = await sb
    .from("churn_event_reasons")
    .select("churn_event_id, reason_category")
    .in("churn_event_id", eventIds);
  if (error) throw new Error(`churn_event_reasons.list: ${error.message}`);
  for (const r of (data ?? []) as ReasonRow[]) {
    const arr = map.get(r.churn_event_id) ?? [];
    arr.push(r.reason_category);
    map.set(r.churn_event_id, arr);
  }
  return map;
}

export const supabaseChurnRecordRepo: ChurnRecordRepo = {
  async listByCompany(companyId) {
    const sb = getServiceClient();
    // company → contracts → churn_events の順で引く (contracts.company_id で絞る)
    const { data: contracts, error: cerr } = await sb
      .from("contracts")
      .select("id")
      .eq("company_id", companyId);
    if (cerr) throw new Error(`contracts.list: ${cerr.message}`);
    const contractIds = (contracts ?? []).map((c: { id: string }) => c.id);
    if (contractIds.length === 0) return [];

    const { data: events, error } = await sb
      .from("churn_events")
      .select("*")
      .in("contract_id", contractIds)
      .order("churned_at", { ascending: false });
    if (error) throw new Error(`churn_events.listByCompany: ${error.message}`);
    const evRows = (events ?? []) as EventRow[];
    const reasonMap = await fetchReasonsForEvents(sb, evRows.map((e) => e.id));
    return evRows.map((ev) => toRecord(ev, reasonMap.get(ev.id) ?? []));
  },

  async getByContract(contractId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("churn_events")
      .select("*")
      .eq("contract_id", contractId)
      .order("churned_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`churn_events.getByContract: ${error.message}`);
    if (!data) return null;
    const ev = data as EventRow;
    const reasonMap = await fetchReasonsForEvents(sb, [ev.id]);
    return toRecord(ev, reasonMap.get(ev.id) ?? []);
  },

  async upsert(input: ChurnRecordUpsertInput) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const orgId = input.organizationId ?? DEFAULT_ORG_ID;

    // 既存レコード (contractId 単位で 1 件のみとして扱う) を取得
    const { data: prevRow } = await sb
      .from("churn_events")
      .select("*")
      .eq("contract_id", input.contractId)
      .order("churned_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prev = (prevRow as EventRow | null) ?? null;

    const eventBody = {
      organization_id: orgId,
      contract_id: input.contractId,
      churned_at: input.churnedAt,
      reason_note: input.reasonNote ?? null,
      next_action_date: input.nextActionDate ?? null,
      next_action_note: input.nextActionNote ?? null,
      notified: input.notified ?? prev?.notified ?? false,
      created_by: ctx.actor.userId ?? null
    };

    let eventId: string;
    if (prev) {
      const { error } = await sb
        .from("churn_events")
        .update(eventBody)
        .eq("id", prev.id);
      if (error) throw new Error(`churn_events.update: ${error.message}`);
      eventId = prev.id;
      // reasons は一旦消して入れ替え
      const { error: delErr } = await sb
        .from("churn_event_reasons")
        .delete()
        .eq("churn_event_id", eventId);
      if (delErr) throw new Error(`churn_event_reasons.delete: ${delErr.message}`);
    } else {
      const { data: ins, error } = await sb
        .from("churn_events")
        .insert(eventBody)
        .select("id")
        .single();
      if (error) throw new Error(`churn_events.insert: ${error.message}`);
      eventId = (ins as { id: string }).id;
    }

    // reason_category を junction に積む (mock の単一 reasonCategory → 1 行)
    const { error: rerr } = await sb
      .from("churn_event_reasons")
      .insert({ churn_event_id: eventId, reason_category: input.reasonCategory });
    if (rerr) throw new Error(`churn_event_reasons.insert: ${rerr.message}`);

    // TODO: input.verifiedByCustomer / verifiedAt / verificationNote は
    //       DB schema に列が無く永続化されない。migration 後に対応。

    // 再取得して返却
    const { data: after, error: aerr } = await sb
      .from("churn_events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (aerr) throw new Error(`churn_events.afterFetch: ${aerr.message}`);
    const reasonMap = await fetchReasonsForEvents(sb, [eventId]);
    const record = toRecord(after as EventRow, reasonMap.get(eventId) ?? []);

    await runAfterWrite({
      entityType: "churn_events",
      entityId: eventId,
      before: prev ?? undefined,
      after: record,
      action: prev ? "update" : "create",
      ctx
    });
    return record;
  },

  async setVerification(contractId, input) {
    // TODO: churn_events に verified_* 列が無いため、現状は一旦 audit log のみ
    //       残し、in-memory には反映できない (即時取得するとフラグ false で返る)。
    //       UI 側は当面、楽観的に値を保持する想定。
    const sb = getServiceClient();
    const ctx = getActorContext();
    const existing = await supabaseChurnRecordRepo.getByContract(contractId);
    if (!existing) {
      throw new Error(`churn_record not found: contractId=${contractId}`);
    }
    await runAfterWrite({
      entityType: "churn_events",
      entityId: contractId,
      before: existing,
      after: {
        ...existing,
        verifiedByCustomer: true,
        verifiedAt: input.verifiedAt ?? new Date().toISOString(),
        verificationNote: input.verificationNote ?? existing.verificationNote
      },
      action: "update",
      ctx
    });
    return {
      ...existing,
      verifiedByCustomer: true,
      verifiedAt: input.verifiedAt ?? new Date().toISOString(),
      verificationNote: input.verificationNote ?? existing.verificationNote
    };
  }
};
