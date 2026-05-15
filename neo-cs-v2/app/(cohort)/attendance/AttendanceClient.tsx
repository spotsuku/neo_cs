"use client";

import { useMemo, useState } from "react";
import type {
  Participant,
  Session,
  AttendanceRecord
} from "@/lib/mock/participants";
import type { ActiveContract } from "@/lib/mock/onboarding";
import type { Company as MockCompany, Contact } from "@/lib/mock/entities";

type Company = MockCompany;
import type { ProductCode } from "@/lib/repository/types";
import type { products as ProductList } from "@/lib/master";
import { AddSessionModal } from "./AddSessionModal";
import { AddParticipantModal } from "./AddParticipantModal";
import { ExpectedTargetModal } from "./ExpectedTargetModal";

// AttendanceRecord.status は履歴互換のため late/excused も型上は残るが、
// 本UIでは「出席予定 / 出席 / 欠席 / 対象外」の4状態にまとめる。
//   - late      → 出席として扱う（visual coerce）
//   - excused   → 欠席として扱う（visual coerce）
//   - 記録なし  → 出席予定（pending）
//   - expected外→ 対象外
type Status = "present" | "absent" | "late" | "excused";
type ViewMode = "person" | "company";

// 列 = 同じ事業内で scheduledAt が同じセッション群を集約したもの。
// 各契約ごとに 1 つのセッションが紐づく可能性がある。
type DateColumn = {
  date: string;
  sessionsByContract: Map<string, Session>;
  sessionNumber: number;
  title: string;
};

const PRODUCT_TABS: ProductCode[] = ["academia", "hyogikai", "aiken", "commu"];

// 表示用ステータス
type DisplayStatus = "pending" | "present" | "absent" | "out_of_scope";

const DISPLAY_GLYPH: Record<DisplayStatus, string> = {
  pending: "・",
  present: "○",
  absent: "×",
  out_of_scope: "—"
};

const DISPLAY_COLOR: Record<DisplayStatus, string> = {
  pending: "#9CA3AF",
  present: "#10B981",
  absent: "#EF4444",
  out_of_scope: "#D1D5DB"
};

const DISPLAY_LABEL: Record<DisplayStatus, string> = {
  pending: "出席予定",
  present: "出席",
  absent: "欠席",
  out_of_scope: "対象外"
};

function recordToDisplay(st: Status | undefined): DisplayStatus {
  if (st === "present" || st === "late") return "present";
  if (st === "absent" || st === "excused") return "absent";
  return "pending";
}

// 後方互換: CSV / DrillDown で使う 2状態 (出席/欠席) ラベル & 色
const STATUS_LABEL: Record<Status, string> = {
  present: "出席",
  late: "出席",
  absent: "欠席",
  excused: "欠席"
};
const STATUS_COLOR: Record<Status, string> = {
  present: "#10B981",
  late: "#10B981",
  absent: "#EF4444",
  excused: "#EF4444"
};

// セルクリックでの出欠循環: 出席予定 → 出席 → 欠席 → 出席予定
function nextStatus(current: Status | undefined): Status | "pending" {
  const d = recordToDisplay(current);
  if (d === "pending") return "present";
  if (d === "present") return "absent";
  return "pending";
}

function rateToColor(rate: number): string {
  if (rate >= 0.9) return "#10B981";
  if (rate >= 0.7) return "#F59E0B";
  return "#EF4444";
}

function fmtPct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function AttendanceClient({
  initialParticipants,
  initialSessions,
  initialRecords,
  contracts,
  companies,
  contacts,
  products,
  initialSessionId
}: {
  initialParticipants: Participant[];
  initialSessions: Session[];
  initialRecords: AttendanceRecord[];
  contracts: ActiveContract[];
  companies: Company[];
  contacts: Contact[];
  products: typeof ProductList;
  initialSessionId?: string;
}) {
  // 初期プロダクトの判定 (sessionId 指定時)
  const initialProduct: ProductCode = useMemo(() => {
    if (initialSessionId) {
      const s = initialSessions.find((x) => x.id === initialSessionId);
      const c = s ? contracts.find((cc) => cc.id === s.contractId) : undefined;
      if (c) return c.product;
    }
    return "academia";
  }, [initialSessionId, initialSessions, contracts]);

  const [product, setProduct] = useState<ProductCode>(initialProduct);
  const [view, setView] = useState<ViewMode>("person");
  const [selectedCourseKey, setSelectedCourseKey] = useState<string>("");
  const [periodWeeks, setPeriodWeeks] = useState<number>(12); // 直近12週（~5列に抑える）
  const [records, setRecords] = useState<AttendanceRecord[]>(initialRecords);
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [participants, setParticipants] =
    useState<Participant[]>(initialParticipants);
  const [showAddSession, setShowAddSession] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [editExpectedColumnDate, setEditExpectedColumnDate] = useState<
    string | null
  >(null);
  const [toast, setToast] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<{
    companyId: string;
    sessionId: string;
  } | null>(null);

  const productMeta = products.find((p) => p.code === product);

  // プロダクト単位での絞り込み
  const productContracts = useMemo(
    () =>
      contracts.filter(
        (c) => c.product === product && (!selectedCourseKey || c.courseKey === selectedCourseKey)
      ),
    [contracts, product, selectedCourseKey]
  );

  const courseKeys = useMemo(() => {
    const keys = new Set<string>();
    contracts
      .filter((c) => c.product === product)
      .forEach((c) => c.courseKey && keys.add(c.courseKey));
    return Array.from(keys);
  }, [contracts, product]);

  const periodFrom = useMemo(() => {
    if (periodWeeks <= 0) return "";
    const d = new Date();
    d.setDate(d.getDate() - periodWeeks * 7);
    return d.toISOString().slice(0, 10);
  }, [periodWeeks]);

  const productSessions = useMemo(() => {
    const contractIds = new Set(productContracts.map((c) => c.id));
    return sessions
      .filter((s) => contractIds.has(s.contractId))
      .filter((s) => !periodFrom || s.scheduledAt >= periodFrom)
      .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));
  }, [sessions, productContracts, periodFrom]);

  // 列 = 同じ事業内の同じ scheduledAt を集約。1列に複数 contract の session が紐づく。
  const dateColumns = useMemo<DateColumn[]>(() => {
    const map = new Map<string, DateColumn>();
    productSessions.forEach((s) => {
      const col = map.get(s.scheduledAt);
      if (col) {
        col.sessionsByContract.set(s.contractId, s);
      } else {
        map.set(s.scheduledAt, {
          date: s.scheduledAt,
          sessionsByContract: new Map([[s.contractId, s]]),
          sessionNumber: s.sessionNumber,
          title: s.title
        });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.date < b.date ? -1 : 1
    );
  }, [productSessions]);

  const productParticipants = useMemo(() => {
    const contractIds = new Set(productContracts.map((c) => c.id));
    return participants.filter((p) => contractIds.has(p.contractId));
  }, [participants, productContracts]);

  // company × participants グルーピング
  const groupedByCompany = useMemo(() => {
    const map = new Map<string, Participant[]>();
    productParticipants.forEach((p) => {
      const arr = map.get(p.companyId) ?? [];
      arr.push(p);
      map.set(p.companyId, arr);
    });
    return Array.from(map.entries())
      .map(([companyId, ps]) => ({
        companyId,
        company: companies.find((c) => c.id === companyId),
        participants: ps
      }))
      .filter((g) => !!g.company)
      .sort((a, b) => (a.company!.name < b.company!.name ? -1 : 1));
  }, [productParticipants, companies]);

  const recordKey = (sid: string, pid: string) => `${sid}::${pid}`;
  const recordIndex = useMemo(() => {
    const m = new Map<string, AttendanceRecord>();
    records.forEach((r) => m.set(recordKey(r.sessionId, r.participantId), r));
    return m;
  }, [records]);

  const flashSaved = (msg = "保存しました") => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1200);
  };

  const writeStatus = (
    sessionId: string,
    participantId: string,
    status: Status | "pending",
    note?: string
  ) => {
    setRecords((prev) => {
      // pending = 記録を削除して「出席予定」状態に戻す
      if (status === "pending") {
        return prev.filter(
          (r) => !(r.sessionId === sessionId && r.participantId === participantId)
        );
      }
      const idx = prev.findIndex(
        (r) => r.sessionId === sessionId && r.participantId === participantId
      );
      const today = new Date().toISOString().slice(0, 10);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          status,
          recordedAt: today,
          note: note ?? next[idx].note
        };
        return next;
      }
      return [
        ...prev,
        {
          id: `ar-new-${sessionId}-${participantId}`,
          participantId,
          sessionId,
          status,
          recordedAt: today,
          recordedBy: "古野",
          note
        }
      ];
    });
    flashSaved();
  };

  const handleCellClick = (sessionId: string, participantId: string) => {
    const cur = recordIndex.get(recordKey(sessionId, participantId));
    const next = nextStatus(cur?.status as Status | undefined);
    writeStatus(sessionId, participantId, next);
  };

  // 企業×日程ビュー: 該当日(列)におけるその企業の出席数/総数
  //   - 1列 = 同 product 内で同日のセッション群（複数契約をまたぐ）
  //   - 出席対象 = 該当企業の派遣者のうち、その契約のセッションで expected に含まれる人
  const companyDayCellByColumn = (companyId: string, col: DateColumn) => {
    const expectedIds: string[] = [];
    let sessionIdForFirstClick: string | undefined;
    productParticipants.forEach((p) => {
      if (p.companyId !== companyId) return;
      const session = col.sessionsByContract.get(p.contractId);
      if (!session) return;
      if (!session.expectedParticipantIds.includes(p.id)) return;
      expectedIds.push(p.id);
      if (!sessionIdForFirstClick) sessionIdForFirstClick = session.id;
    });
    if (expectedIds.length === 0) {
      return { attended: 0, total: 0, rate: 0, expectedIds, sessionIdForFirstClick };
    }
    const attended = expectedIds.filter((pid) => {
      // セッションIDは派遣者ごとに違うので、p の contract から再引き
      const p = productParticipants.find((x) => x.id === pid);
      if (!p) return false;
      const session = col.sessionsByContract.get(p.contractId);
      if (!session) return false;
      const r = recordIndex.get(recordKey(session.id, pid));
      return r?.status === "present" || r?.status === "late";
    }).length;
    return {
      attended,
      total: expectedIds.length,
      rate: attended / expectedIds.length,
      expectedIds,
      sessionIdForFirstClick
    };
  };

  // 企業の総合出席率（全列の合算）
  const companyOverallRate = (companyId: string) => {
    let attended = 0;
    let total = 0;
    dateColumns.forEach((col) => {
      const cell = companyDayCellByColumn(companyId, col);
      if (cell.total > 0) {
        attended += cell.attended;
        total += cell.total;
      }
    });
    return total === 0 ? 0 : attended / total;
  };

  // CSV エクスポート
  const exportCsv = () => {
    const sep = ",";
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = [];
    if (view === "person") {
      const header = ["企業", "氏名", "部門", "役職"];
      productSessions.forEach((s) =>
        header.push(`${s.scheduledAt} 第${s.sessionNumber}回`)
      );
      header.push("出席率");
      lines.push(header.map(esc).join(sep));
      groupedByCompany.forEach((grp) => {
        grp.participants.forEach((p) => {
          const row: (string | number)[] = [
            grp.company!.name,
            p.name,
            p.department ?? "",
            p.role ?? ""
          ];
          let attended = 0;
          let total = 0;
          productSessions.forEach((s) => {
            const r = recordIndex.get(recordKey(s.id, p.id));
            // 同 contract のみカウント
            if (s.contractId !== p.contractId) {
              row.push("");
              return;
            }
            total += 1;
            if (r?.status === "present" || r?.status === "late") attended += 1;
            row.push(r ? STATUS_LABEL[r.status as Status] : "");
          });
          row.push(total === 0 ? "" : fmtPct(attended / total));
          lines.push(row.map(esc).join(sep));
        });
      });
    } else {
      const header = ["企業", "総合出席率"];
      dateColumns.forEach((col) =>
        header.push(`${col.date} 第${col.sessionNumber}回`)
      );
      lines.push(header.map(esc).join(sep));
      groupedByCompany.forEach((grp) => {
        const row: (string | number)[] = [
          grp.company!.name,
          fmtPct(companyOverallRate(grp.companyId))
        ];
        dateColumns.forEach((col) => {
          const cell = companyDayCellByColumn(grp.companyId, col);
          row.push(cell.total === 0 ? "" : `${cell.attended}/${cell.total}`);
        });
        lines.push(row.map(esc).join(sep));
      });
    }
    const blob = new Blob(["﻿" + lines.join("\n")], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${product}_${view}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8 space-y-5">
      <section>
        <div className="text-xs text-ink-500">出席管理</div>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-ink-900">
          出席ピボット
        </h1>
        <div className="mt-1 text-sm text-ink-500">
          プロダクトごとに「人×日程」「企業×日程」の2軸でピボット表示。セルクリックで即時保存します。
        </div>
      </section>

      {/* プロダクトタブ */}
      <section className="liquid-surface p-2 inline-flex gap-1">
        {PRODUCT_TABS.map((code) => {
          const meta = products.find((p) => p.code === code);
          const active = product === code;
          return (
            <button
              key={code}
              onClick={() => {
                setProduct(code);
                setSelectedCourseKey("");
              }}
              className={`px-4 py-2 rounded-full text-sm transition focus-ring ${
                active
                  ? "bg-ink-900 text-white"
                  : "text-ink-700 hover:bg-ink-50"
              }`}
              style={
                active && meta
                  ? { background: meta.accent, color: "white" }
                  : undefined
              }
            >
              {meta?.shortName ?? code}
            </button>
          );
        })}
      </section>

      {/* ビュー切替 + フィルタ + エクスポート */}
      <section className="liquid-surface p-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex bg-ink-50 rounded-full p-1">
          {(["person", "company"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition focus-ring ${
                view === v ? "bg-white shadow-sm text-ink-900" : "text-ink-500"
              }`}
            >
              {v === "person" ? "人 × 日程" : "企業 × 日程"}
            </button>
          ))}
        </div>

        {courseKeys.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-ink-500">コース</label>
            <select
              className="px-3 py-1.5 rounded-xl bg-white border border-ink-100 text-xs"
              value={selectedCourseKey}
              onChange={(e) => setSelectedCourseKey(e.target.value)}
            >
              <option value="">すべて</option>
              {courseKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-[11px] text-ink-500">期間</label>
          <select
            className="px-3 py-1.5 rounded-xl bg-white border border-ink-100 text-xs"
            value={periodWeeks}
            onChange={(e) => setPeriodWeeks(Number(e.target.value))}
          >
            <option value={0}>全期間</option>
            <option value={4}>直近4週間</option>
            <option value={12}>直近12週間</option>
            <option value={26}>直近6ヶ月</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {toast && (
            <span className="text-xs text-emerald-600 font-medium">
              ✓ {toast}
            </span>
          )}
          <button
            onClick={() => setShowAddSession(true)}
            disabled={productContracts.length === 0}
            title="新しい開催回（列）を追加します"
            className="px-3 py-1.5 rounded-full bg-white border border-ink-100 text-xs text-ink-700 hover:bg-ink-50 focus-ring disabled:opacity-30"
          >
            ＋ 列を追加
          </button>
          <button
            onClick={() => setShowAddParticipant(true)}
            disabled={productContracts.length === 0}
            title="新しい派遣者を1名追加します"
            className="px-3 py-1.5 rounded-full bg-white border border-ink-100 text-xs text-ink-700 hover:bg-ink-50 focus-ring disabled:opacity-30"
          >
            ＋ 派遣者を追加
          </button>
          <button
            onClick={exportCsv}
            className="px-3 py-1.5 rounded-full bg-white border border-ink-100 text-xs text-ink-700 hover:bg-ink-50 focus-ring"
          >
            CSVエクスポート
          </button>
        </div>
      </section>

      {/* 凡例 */}
      <section className="text-[11px] text-ink-500 flex flex-wrap items-center gap-3">
        {(
          ["pending", "present", "absent", "out_of_scope"] as DisplayStatus[]
        ).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
              style={{
                background: s === "out_of_scope" ? "transparent" : DISPLAY_COLOR[s],
                color: s === "out_of_scope" ? DISPLAY_COLOR[s] : "white",
                border:
                  s === "pending" || s === "out_of_scope"
                    ? `1px dashed ${DISPLAY_COLOR[s]}`
                    : "none"
              }}
            >
              {DISPLAY_GLYPH[s]}
            </span>
            {DISPLAY_LABEL[s]}
          </span>
        ))}
        <span className="text-ink-400">
          ・セルをクリックすると 出席予定→出席→欠席→出席予定 の順に切替（即時保存）
        </span>
      </section>

      {/* メイン: ピボット表 */}
      {productSessions.length === 0 ? (
        <section className="liquid-surface p-12 text-center text-sm text-ink-500">
          {productMeta?.shortName ?? product} のセッションが見つかりません
        </section>
      ) : view === "person" ? (
        <PersonByDateTable
          groupedByCompany={groupedByCompany}
          columns={dateColumns}
          recordIndex={recordIndex}
          onCellClick={handleCellClick}
          onEditExpected={(date) => setEditExpectedColumnDate(date)}
        />
      ) : (
        <CompanyByDateTable
          groupedByCompany={groupedByCompany}
          columns={dateColumns}
          companyDayCellByColumn={companyDayCellByColumn}
          companyOverallRate={companyOverallRate}
          onCellClick={(companyId, sessionId) =>
            setDrillDown({ companyId, sessionId })
          }
          onEditExpected={(date) => setEditExpectedColumnDate(date)}
        />
      )}

      {/* 列を追加（事業全社一括・期で絞り込み） */}
      {showAddSession && (
        <AddSessionModal
          product={product}
          productLabel={productMeta?.shortName ?? product}
          productContracts={productContracts}
          productParticipants={productParticipants}
          companies={companies}
          contacts={contacts}
          defaultSessionNumber={
            (productSessions.reduce(
              (m, s) => Math.max(m, s.sessionNumber),
              0
            ) || 0) + 1
          }
          onClose={() => setShowAddSession(false)}
          onSave={(newSessions) => {
            setSessions((prev) => [...prev, ...newSessions]);
            setShowAddSession(false);
            flashSaved(`列を追加しました（${newSessions.length}契約に展開）`);
          }}
        />
      )}

      {/* 派遣者追加 */}
      {showAddParticipant && (
        <AddParticipantModal
          contracts={productContracts}
          companies={companies}
          existingDepartments={Array.from(
            new Set(
              productParticipants.map((p) => p.department).filter(Boolean)
            )
          ) as string[]}
          onClose={() => setShowAddParticipant(false)}
          onSave={(p) => {
            setParticipants((prev) => [...prev, p]);
            // 既存の同 contract 全セッションの expected にも追加（デフォルトで対象に）
            setSessions((prev) =>
              prev.map((s) =>
                s.contractId === p.contractId
                  ? {
                      ...s,
                      expectedParticipantIds: [
                        ...s.expectedParticipantIds,
                        p.id
                      ]
                    }
                  : s
              )
            );
            setShowAddParticipant(false);
            flashSaved("派遣者を追加しました");
          }}
        />
      )}

      {/* 出席対象の編集（列=同日のセッション群を対象） */}
      {editExpectedColumnDate &&
        (() => {
          const col = dateColumns.find((c) => c.date === editExpectedColumnDate);
          if (!col) return null;
          const colSessions = Array.from(col.sessionsByContract.values());
          const contractIds = new Set(colSessions.map((s) => s.contractId));
          const eligible = participants.filter((p) =>
            contractIds.has(p.contractId)
          );
          return (
            <ExpectedTargetModal
              sessions={colSessions}
              contractParticipants={eligible}
              companies={companies}
              contacts={contacts}
              product={product}
              onClose={() => setEditExpectedColumnDate(null)}
              onSave={(idsByContract) => {
                setSessions((prev) =>
                  prev.map((s) => {
                    if (!contractIds.has(s.contractId)) return s;
                    if (s.scheduledAt !== col.date) return s;
                    const next = idsByContract.get(s.contractId);
                    return next
                      ? { ...s, expectedParticipantIds: next }
                      : s;
                  })
                );
                setEditExpectedColumnDate(null);
                flashSaved("出席対象を更新しました");
              }}
            />
          );
        })()}

      {/* 企業×日程 ドリルダウン: 個人別出欠 */}
      {drillDown && (
        <DrillDownModal
          companyName={
            companies.find((c) => c.id === drillDown.companyId)?.name ?? ""
          }
          session={sessions.find((s) => s.id === drillDown.sessionId)}
          expectedParticipants={productParticipants.filter(
            (p) =>
              p.companyId === drillDown.companyId &&
              p.contractId ===
                sessions.find((s) => s.id === drillDown.sessionId)
                  ?.contractId
          )}
          recordIndex={recordIndex}
          onClose={() => setDrillDown(null)}
          onSetStatus={(participantId, status, note) => {
            if (status === "excused") {
              writeStatus(drillDown.sessionId, participantId, status, note);
            } else {
              writeStatus(drillDown.sessionId, participantId, status);
            }
          }}
        />
      )}
    </main>
  );
}

// ─────────────────────────────────────────────
// 人×日程ピボット
// ─────────────────────────────────────────────
function PersonByDateTable({
  groupedByCompany,
  columns,
  recordIndex,
  onCellClick,
  onEditExpected
}: {
  groupedByCompany: { companyId: string; company?: Company; participants: Participant[] }[];
  columns: DateColumn[];
  recordIndex: Map<string, AttendanceRecord>;
  onCellClick: (sessionId: string, participantId: string) => void;
  onEditExpected: (date: string) => void;
}) {
  return (
    <div className="liquid-surface">
      <div className="overflow-auto rounded-liquid max-h-[calc(100vh-300px)]">
        <table className="border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-ink-100 shadow-[0_2px_8px_rgba(14,15,18,0.04)]">
            <tr className="text-[11px] text-ink-500">
              <th className="sticky left-0 z-30 bg-white/95 backdrop-blur-sm text-left px-3 py-2.5 min-w-[220px] border-r border-ink-100">
                企業 / 氏名
              </th>
              {columns.map((col) => {
                const totalExpected = Array.from(
                  col.sessionsByContract.values()
                ).reduce((s, x) => s + x.expectedParticipantIds.length, 0);
                return (
                  <th
                    key={col.date}
                    className="px-2 py-2.5 text-center font-medium border-r border-ink-50 min-w-[78px]"
                  >
                    <div className="text-[10px] text-ink-500">
                      第{col.sessionNumber}回
                    </div>
                    <div className="text-[10px] text-ink-700">
                      {col.date.slice(5)}
                    </div>
                    <button
                      onClick={() => onEditExpected(col.date)}
                      title={`対象を編集 (${totalExpected}名)`}
                      className="mt-0.5 text-[9px] text-ink-400 hover:text-ink-700"
                    >
                      ⚙ {totalExpected}名
                    </button>
                  </th>
                );
              })}
              <th className="px-3 py-2.5 text-center font-medium min-w-[80px]">
                出席率
              </th>
            </tr>
          </thead>
          <tbody>
            {groupedByCompany.map((grp) => (
              <CompanyGroupRows
                key={grp.companyId}
                grp={grp}
                columns={columns}
                recordIndex={recordIndex}
                onCellClick={onCellClick}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompanyGroupRows({
  grp,
  columns,
  recordIndex,
  onCellClick
}: {
  grp: { companyId: string; company?: Company; participants: Participant[] };
  columns: DateColumn[];
  recordIndex: Map<string, AttendanceRecord>;
  onCellClick: (sessionId: string, participantId: string) => void;
}) {
  return (
    <>
      <tr className="bg-ink-50/60 border-b border-ink-100">
        <td
          className="sticky left-0 z-10 bg-ink-50/95 backdrop-blur-sm px-3 py-2 border-r border-ink-100 text-[11px] font-semibold text-ink-700"
          colSpan={1}
        >
          {grp.company?.name ?? grp.companyId}
          <span className="ml-2 text-[10px] text-ink-500 font-normal">
            {grp.participants.length}名
          </span>
        </td>
        <td colSpan={columns.length + 1} className="bg-ink-50/60" />
      </tr>
      {grp.participants.map((p) => {
        let attended = 0;
        let total = 0;
        columns.forEach((col) => {
          const s = col.sessionsByContract.get(p.contractId);
          if (!s) return;
          if (!s.expectedParticipantIds.includes(p.id)) return;
          const r = recordIndex.get(`${s.id}::${p.id}`);
          total += 1;
          if (r?.status === "present" || r?.status === "late") attended += 1;
        });
        const rate = total === 0 ? 0 : attended / total;
        return (
          <tr key={p.id} className="border-b border-ink-50">
            <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-ink-100">
              <div className="text-sm text-ink-900 font-medium">{p.name}</div>
              <div className="text-[10px] text-ink-500">
                {p.department ?? ""} {p.role ? `/ ${p.role}` : ""}
              </div>
            </td>
            {columns.map((col) => {
              const s = col.sessionsByContract.get(p.contractId);
              if (!s) {
                return (
                  <td
                    key={col.date}
                    className="px-2 py-2 text-center border-r border-ink-50 bg-ink-50/30"
                  >
                    <span className="text-ink-300 text-[11px]">—</span>
                  </td>
                );
              }
              const expected = s.expectedParticipantIds.includes(p.id);
              if (!expected) {
                return (
                  <td
                    key={col.date}
                    className="px-2 py-2 text-center border-r border-ink-50 bg-ink-50/20"
                    title="対象外"
                  >
                    <span className="text-ink-300 text-[10px]">対象外</span>
                  </td>
                );
              }
              const r = recordIndex.get(`${s.id}::${p.id}`);
              const disp = recordToDisplay(r?.status as Status | undefined);
              return (
                <td
                  key={s.id}
                  className="px-2 py-2 text-center border-r border-ink-50"
                >
                  <button
                    onClick={() => onCellClick(s.id, p.id)}
                    title={r?.note ?? DISPLAY_LABEL[disp]}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold focus-ring transition hover:scale-105"
                    style={{
                      background:
                        disp === "pending" ? "white" : DISPLAY_COLOR[disp],
                      color: disp === "pending" ? "#9CA3AF" : "white",
                      border:
                        disp === "pending"
                          ? "1px dashed #D1D5DB"
                          : "none"
                    }}
                  >
                    {DISPLAY_GLYPH[disp]}
                  </button>
                </td>
              );
            })}
            <td className="px-3 py-2 text-center">
              {total === 0 ? (
                <span className="text-ink-400 text-xs">—</span>
              ) : (
                <span
                  className="text-xs font-semibold"
                  style={{ color: rateToColor(rate) }}
                >
                  {fmtPct(rate)}
                </span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────
// 企業×日程ピボット
// ─────────────────────────────────────────────
function CompanyByDateTable({
  groupedByCompany,
  columns,
  companyDayCellByColumn,
  companyOverallRate,
  onCellClick,
  onEditExpected
}: {
  groupedByCompany: { companyId: string; company?: Company; participants: Participant[] }[];
  columns: DateColumn[];
  companyDayCellByColumn: (
    companyId: string,
    col: DateColumn
  ) => {
    attended: number;
    total: number;
    rate: number;
    expectedIds: string[];
    sessionIdForFirstClick?: string;
  };
  companyOverallRate: (companyId: string) => number;
  onCellClick: (companyId: string, sessionId: string) => void;
  onEditExpected: (date: string) => void;
}) {
  return (
    <div className="liquid-surface">
      <div className="overflow-auto rounded-liquid max-h-[calc(100vh-300px)]">
        <table className="border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-ink-100 shadow-[0_2px_8px_rgba(14,15,18,0.04)]">
            <tr className="text-[11px] text-ink-500">
              <th className="sticky left-0 z-30 bg-white/95 backdrop-blur-sm text-left px-3 py-2.5 min-w-[220px] border-r border-ink-100">
                企業
              </th>
              <th className="px-3 py-2.5 text-center font-medium min-w-[80px] border-r border-ink-50">
                総合
              </th>
              {columns.map((col) => {
                const totalExpected = Array.from(
                  col.sessionsByContract.values()
                ).reduce((s, x) => s + x.expectedParticipantIds.length, 0);
                return (
                  <th
                    key={col.date}
                    className="px-2 py-2.5 text-center font-medium border-r border-ink-50 min-w-[100px]"
                  >
                    <div className="text-[10px] text-ink-500">
                      第{col.sessionNumber}回
                    </div>
                    <div className="text-[10px] text-ink-700">
                      {col.date.slice(5)}
                    </div>
                    <button
                      onClick={() => onEditExpected(col.date)}
                      title={`対象を編集 (${totalExpected}名)`}
                      className="mt-0.5 text-[9px] text-ink-400 hover:text-ink-700"
                    >
                      ⚙ {totalExpected}名
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groupedByCompany.map((grp) => {
              const overall = companyOverallRate(grp.companyId);
              return (
                <tr key={grp.companyId} className="border-b border-ink-50 hover:bg-ink-50/30">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2.5 border-r border-ink-100 text-sm font-medium text-ink-900">
                    {grp.company?.name ?? grp.companyId}
                    <div className="text-[10px] text-ink-500 font-normal">
                      {grp.participants.length}名
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center border-r border-ink-50">
                    <span
                      className="text-sm font-bold"
                      style={{ color: rateToColor(overall) }}
                    >
                      {fmtPct(overall)}
                    </span>
                  </td>
                  {columns.map((col) => {
                    const cell = companyDayCellByColumn(grp.companyId, col);
                    if (cell.total === 0) {
                      return (
                        <td
                          key={col.date}
                          className="px-2 py-2.5 text-center border-r border-ink-50 bg-ink-50/30 text-ink-300 text-xs"
                        >
                          —
                        </td>
                      );
                    }
                    return (
                      <td
                        key={col.date}
                        className="px-2 py-2.5 text-center border-r border-ink-50"
                      >
                        <button
                          onClick={() =>
                            cell.sessionIdForFirstClick &&
                            onCellClick(grp.companyId, cell.sessionIdForFirstClick)
                          }
                          className="inline-flex flex-col items-center justify-center px-2 py-1 rounded-lg hover:bg-ink-50 focus-ring transition"
                        >
                          <span
                            className="text-xs font-bold"
                            style={{ color: rateToColor(cell.rate) }}
                          >
                            {cell.attended}/{cell.total}
                          </span>
                          <span className="text-[10px] text-ink-500">
                            {fmtPct(cell.rate)}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 公欠理由モーダル
// ─────────────────────────────────────────────
function ExcusedReasonModal({
  initialNote,
  participant,
  session,
  onClose,
  onSave
}: {
  initialNote: string;
  participant?: Participant;
  session?: Session;
  onClose: () => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState(initialNote);
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-base font-semibold text-ink-900">公欠理由</div>
            <div className="text-[11px] text-ink-500 mt-0.5">
              {participant?.name} ・ 第{session?.sessionNumber}回 ({session?.scheduledAt})
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-500 hover:text-ink-700 text-sm"
          >
            ✕
          </button>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          autoFocus
          placeholder="例: 出張のため公欠 / 体調不良 など"
          className="w-full px-3 py-2 rounded-xl border border-ink-100 text-sm focus-ring"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-700 hover:bg-ink-50"
          >
            キャンセル
          </button>
          <button
            onClick={() => onSave(note)}
            className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:opacity-90"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 企業×日程ドリルダウン: 個人別出欠
// ─────────────────────────────────────────────
function DrillDownModal({
  companyName,
  session,
  expectedParticipants,
  recordIndex,
  onClose,
  onSetStatus
}: {
  companyName: string;
  session?: Session;
  expectedParticipants: Participant[];
  recordIndex: Map<string, AttendanceRecord>;
  onClose: () => void;
  onSetStatus: (participantId: string, status: Status, note?: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-base font-semibold text-ink-900">
              {companyName}
            </div>
            <div className="text-[11px] text-ink-500 mt-0.5">
              第{session?.sessionNumber}回 ({session?.scheduledAt})
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-500 hover:text-ink-700 text-sm"
          >
            ✕
          </button>
        </div>
        <ul className="space-y-1.5">
          {expectedParticipants.map((p) => {
            const r = session
              ? recordIndex.get(`${session.id}::${p.id}`)
              : undefined;
            const st = r?.status as Status | undefined;
            return (
              <li
                key={p.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ink-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink-900 font-medium truncate">
                    {p.name}
                  </div>
                  <div className="text-[10px] text-ink-500 truncate">
                    {p.department ?? ""} {p.role ? `/ ${p.role}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {(["present", "absent"] as Status[]).map(
                    (s) => {
                      const active =
                        recordToDisplay(st) === recordToDisplay(s);
                      return (
                        <button
                          key={s}
                          onClick={() => onSetStatus(p.id, s)}
                          className="text-[10px] px-2 py-1 rounded-full border focus-ring"
                          style={{
                            background: active ? STATUS_COLOR[s] : "white",
                            color: active ? "white" : STATUS_COLOR[s],
                            borderColor: STATUS_COLOR[s]
                          }}
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      );
                    }
                  )}
                </div>
              </li>
            );
          })}
          {expectedParticipants.length === 0 && (
            <li className="text-center text-xs text-ink-500 py-6">
              対象者がいません
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
