"use client";

import { useMemo, useState } from "react";
import type {
  Participant,
  Session,
  AttendanceRecord
} from "@/lib/mock/participants";
import type { ActiveContract } from "@/lib/mock/onboarding";
import type { Company as MockCompany } from "@/lib/mock/entities";

type Company = MockCompany;
import type { ProductCode, products as ProductList } from "@/lib/mock/data";

type Status = "present" | "absent" | "late" | "excused";
type ViewMode = "person" | "company";

const PRODUCT_TABS: ProductCode[] = ["academia", "hyogikai", "aiken", "commu"];

const STATUS_GLYPH: Record<Status, string> = {
  present: "○",
  absent: "×",
  late: "△",
  excused: "公"
};

const STATUS_COLOR: Record<Status, string> = {
  present: "#10B981",
  late: "#F59E0B",
  excused: "#6366F1",
  absent: "#EF4444"
};

const STATUS_LABEL: Record<Status, string> = {
  present: "出席",
  late: "遅刻",
  excused: "公欠",
  absent: "欠席"
};

// 出欠を循環: 未入力 → present → absent → excused → present ...
function nextStatus(current: Status | undefined): Status {
  if (!current) return "present";
  if (current === "present") return "absent";
  if (current === "absent") return "excused";
  if (current === "excused") return "late";
  return "present";
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
  products,
  initialSessionId
}: {
  initialParticipants: Participant[];
  initialSessions: Session[];
  initialRecords: AttendanceRecord[];
  contracts: ActiveContract[];
  companies: Company[];
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
  const [periodWeeks, setPeriodWeeks] = useState<number>(0); // 0 = 全期間
  const [records, setRecords] = useState<AttendanceRecord[]>(initialRecords);
  const [toast, setToast] = useState<string | null>(null);
  const [excusedTarget, setExcusedTarget] = useState<{
    participantId: string;
    sessionId: string;
  } | null>(null);
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
    return initialSessions
      .filter((s) => contractIds.has(s.contractId))
      .filter((s) => !periodFrom || s.scheduledAt >= periodFrom)
      .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));
  }, [initialSessions, productContracts, periodFrom]);

  const productParticipants = useMemo(() => {
    const contractIds = new Set(productContracts.map((c) => c.id));
    return initialParticipants.filter((p) => contractIds.has(p.contractId));
  }, [initialParticipants, productContracts]);

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
    status: Status,
    note?: string
  ) => {
    setRecords((prev) => {
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
    if (next === "excused") {
      // 公欠は理由入力モーダルを表示。先に状態だけexcusedで保存し、理由入力はモーダルで上書き
      writeStatus(sessionId, participantId, "excused", cur?.note);
      setExcusedTarget({ sessionId, participantId });
      return;
    }
    writeStatus(sessionId, participantId, next);
  };

  // 企業×日程ビュー: 該当日のその企業の出席数/総数 (期待者 = 該当 contract の participants)
  const companyDayCell = (companyId: string, sessionId: string) => {
    const session = productSessions.find((s) => s.id === sessionId);
    if (!session) return { attended: 0, total: 0, rate: 0, expectedIds: [] as string[] };
    const expected = productParticipants.filter(
      (p) => p.companyId === companyId && p.contractId === session.contractId
    );
    const expectedIds = expected.map((p) => p.id);
    if (expectedIds.length === 0)
      return { attended: 0, total: 0, rate: 0, expectedIds };
    const attended = expectedIds.filter((pid) => {
      const r = recordIndex.get(recordKey(sessionId, pid));
      return r?.status === "present" || r?.status === "late";
    }).length;
    return {
      attended,
      total: expectedIds.length,
      rate: attended / expectedIds.length,
      expectedIds
    };
  };

  // 企業の総合出席率
  const companyOverallRate = (companyId: string) => {
    let attended = 0;
    let total = 0;
    productSessions.forEach((s) => {
      const cell = companyDayCell(companyId, s.id);
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
      productSessions.forEach((s) =>
        header.push(`${s.scheduledAt} 第${s.sessionNumber}回`)
      );
      lines.push(header.map(esc).join(sep));
      groupedByCompany.forEach((grp) => {
        const row: (string | number)[] = [
          grp.company!.name,
          fmtPct(companyOverallRate(grp.companyId))
        ];
        productSessions.forEach((s) => {
          const cell = companyDayCell(grp.companyId, s.id);
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
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink-900">
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
                view === v ? "bg-white shadow text-ink-900" : "text-ink-500"
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
            onClick={exportCsv}
            className="px-3 py-1.5 rounded-full bg-white border border-ink-100 text-xs text-ink-700 hover:bg-ink-50 focus-ring"
          >
            CSVエクスポート
          </button>
        </div>
      </section>

      {/* 凡例 */}
      <section className="text-[11px] text-ink-500 flex flex-wrap items-center gap-3">
        {(["present", "late", "excused", "absent"] as Status[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white"
              style={{ background: STATUS_COLOR[s] }}
            >
              {STATUS_GLYPH[s]}
            </span>
            {STATUS_LABEL[s]}
          </span>
        ))}
        <span className="text-ink-400">
          ・セルをクリックすると 出席→欠席→公欠→遅刻→出席 の順に切替（即時保存）
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
          sessions={productSessions}
          recordIndex={recordIndex}
          onCellClick={handleCellClick}
        />
      ) : (
        <CompanyByDateTable
          groupedByCompany={groupedByCompany}
          sessions={productSessions}
          companyDayCell={companyDayCell}
          companyOverallRate={companyOverallRate}
          onCellClick={(companyId, sessionId) =>
            setDrillDown({ companyId, sessionId })
          }
        />
      )}

      {/* 公欠理由モーダル */}
      {excusedTarget && (
        <ExcusedReasonModal
          initialNote={
            recordIndex.get(
              recordKey(excusedTarget.sessionId, excusedTarget.participantId)
            )?.note ?? ""
          }
          participant={
            initialParticipants.find((p) => p.id === excusedTarget.participantId)
          }
          session={initialSessions.find((s) => s.id === excusedTarget.sessionId)}
          onClose={() => setExcusedTarget(null)}
          onSave={(note) => {
            writeStatus(
              excusedTarget.sessionId,
              excusedTarget.participantId,
              "excused",
              note
            );
            setExcusedTarget(null);
          }}
        />
      )}

      {/* 企業×日程 ドリルダウン: 個人別出欠 */}
      {drillDown && (
        <DrillDownModal
          companyName={
            companies.find((c) => c.id === drillDown.companyId)?.name ?? ""
          }
          session={initialSessions.find((s) => s.id === drillDown.sessionId)}
          expectedParticipants={productParticipants.filter(
            (p) =>
              p.companyId === drillDown.companyId &&
              p.contractId ===
                initialSessions.find((s) => s.id === drillDown.sessionId)
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
  sessions,
  recordIndex,
  onCellClick
}: {
  groupedByCompany: { companyId: string; company?: Company; participants: Participant[] }[];
  sessions: Session[];
  recordIndex: Map<string, AttendanceRecord>;
  onCellClick: (sessionId: string, participantId: string) => void;
}) {
  return (
    <div className="liquid-surface">
      <div className="overflow-auto rounded-liquid max-h-[calc(100vh-300px)]">
        <table className="border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-100 shadow-[0_2px_8px_rgba(14,15,18,0.04)]">
            <tr className="text-[11px] text-ink-500">
              <th className="sticky left-0 z-30 bg-white/95 backdrop-blur text-left px-3 py-2.5 min-w-[220px] border-r border-ink-100">
                企業 / 氏名
              </th>
              {sessions.map((s) => (
                <th
                  key={s.id}
                  className="px-2 py-2.5 text-center font-medium border-r border-ink-50 min-w-[78px]"
                >
                  <div className="text-[10px] text-ink-500">第{s.sessionNumber}回</div>
                  <div className="text-[10px] text-ink-700">{s.scheduledAt.slice(5)}</div>
                </th>
              ))}
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
                sessions={sessions}
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
  sessions,
  recordIndex,
  onCellClick
}: {
  grp: { companyId: string; company?: Company; participants: Participant[] };
  sessions: Session[];
  recordIndex: Map<string, AttendanceRecord>;
  onCellClick: (sessionId: string, participantId: string) => void;
}) {
  return (
    <>
      <tr className="bg-ink-50/60 border-b border-ink-100">
        <td
          className="sticky left-0 z-10 bg-ink-50/95 backdrop-blur px-3 py-2 border-r border-ink-100 text-[11px] font-semibold text-ink-700"
          colSpan={1}
        >
          {grp.company?.name ?? grp.companyId}
          <span className="ml-2 text-[10px] text-ink-500 font-normal">
            {grp.participants.length}名
          </span>
        </td>
        <td colSpan={sessions.length + 1} className="bg-ink-50/60" />
      </tr>
      {grp.participants.map((p) => {
        let attended = 0;
        let total = 0;
        sessions.forEach((s) => {
          if (s.contractId !== p.contractId) return;
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
            {sessions.map((s) => {
              const same = s.contractId === p.contractId;
              if (!same) {
                return (
                  <td
                    key={s.id}
                    className="px-2 py-2 text-center border-r border-ink-50 bg-ink-50/30"
                  >
                    <span className="text-ink-300 text-[11px]">—</span>
                  </td>
                );
              }
              const r = recordIndex.get(`${s.id}::${p.id}`);
              const st = r?.status as Status | undefined;
              return (
                <td
                  key={s.id}
                  className="px-2 py-2 text-center border-r border-ink-50"
                >
                  <button
                    onClick={() => onCellClick(s.id, p.id)}
                    title={r?.note ?? STATUS_LABEL[st ?? "absent"]}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold focus-ring transition hover:scale-105"
                    style={{
                      background: st ? STATUS_COLOR[st] : "white",
                      color: st ? "white" : "#9CA3AF",
                      border: st ? "none" : "1px dashed #D1D5DB"
                    }}
                  >
                    {st ? STATUS_GLYPH[st] : ""}
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
  sessions,
  companyDayCell,
  companyOverallRate,
  onCellClick
}: {
  groupedByCompany: { companyId: string; company?: Company; participants: Participant[] }[];
  sessions: Session[];
  companyDayCell: (companyId: string, sessionId: string) => {
    attended: number;
    total: number;
    rate: number;
    expectedIds: string[];
  };
  companyOverallRate: (companyId: string) => number;
  onCellClick: (companyId: string, sessionId: string) => void;
}) {
  return (
    <div className="liquid-surface">
      <div className="overflow-auto rounded-liquid max-h-[calc(100vh-300px)]">
        <table className="border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-100 shadow-[0_2px_8px_rgba(14,15,18,0.04)]">
            <tr className="text-[11px] text-ink-500">
              <th className="sticky left-0 z-30 bg-white/95 backdrop-blur text-left px-3 py-2.5 min-w-[220px] border-r border-ink-100">
                企業
              </th>
              <th className="px-3 py-2.5 text-center font-medium min-w-[80px] border-r border-ink-50">
                総合
              </th>
              {sessions.map((s) => (
                <th
                  key={s.id}
                  className="px-2 py-2.5 text-center font-medium border-r border-ink-50 min-w-[100px]"
                >
                  <div className="text-[10px] text-ink-500">第{s.sessionNumber}回</div>
                  <div className="text-[10px] text-ink-700">{s.scheduledAt.slice(5)}</div>
                </th>
              ))}
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
                  {sessions.map((s) => {
                    const cell = companyDayCell(grp.companyId, s.id);
                    if (cell.total === 0) {
                      return (
                        <td
                          key={s.id}
                          className="px-2 py-2.5 text-center border-r border-ink-50 bg-ink-50/30 text-ink-300 text-xs"
                        >
                          —
                        </td>
                      );
                    }
                    return (
                      <td
                        key={s.id}
                        className="px-2 py-2.5 text-center border-r border-ink-50"
                      >
                        <button
                          onClick={() => onCellClick(grp.companyId, s.id)}
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
                  {(["present", "absent", "excused", "late"] as Status[]).map(
                    (s) => {
                      const active = st === s;
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            if (s === "excused") {
                              const note = window.prompt(
                                "公欠理由を入力",
                                r?.note ?? ""
                              );
                              if (note === null) return;
                              onSetStatus(p.id, s, note);
                            } else {
                              onSetStatus(p.id, s);
                            }
                          }}
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
