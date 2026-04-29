"use client";

import { useMemo, useState } from "react";
import type {
  Participant,
  Session,
  AttendanceRecord
} from "@/lib/mock/participants";
import type { ActiveContract } from "@/lib/mock/onboarding";
import type { Company } from "@/lib/mock/entities";
import type { ProductCode, products as ProductList } from "@/lib/mock/data";

const seniorityLabel: Record<string, string> = {
  young: "若手",
  mid: "中堅",
  senior: "管理職",
  exec: "役員クラス"
};

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
  // 全Participantは表示用にimmutableで保持
  const [participantList] = useState<Participant[]>(initialParticipants);
  // Sessionの expectedParticipantIds は編集可
  const [sessionList, setSessionList] = useState<Session[]>(initialSessions);
  // 出席レコード（Sessionごと/Participantごと）
  const [records, setRecords] = useState<AttendanceRecord[]>(initialRecords);
  const [savedFlash, setSavedFlash] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // フィルタ
  const initialContractId = initialSessionId
    ? initialSessions.find((s) => s.id === initialSessionId)?.contractId
    : undefined;
  const initialProduct = initialContractId
    ? contracts.find((c) => c.id === initialContractId)?.product
    : undefined;

  const [selectedProduct, setSelectedProduct] = useState<ProductCode | "">(
    initialProduct ?? ""
  );
  const [selectedContractId, setSelectedContractId] = useState<string>(
    initialContractId ?? ""
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    initialSessionId ?? ""
  );

  const filteredContracts = useMemo(
    () => contracts.filter((c) => !selectedProduct || c.product === selectedProduct),
    [contracts, selectedProduct]
  );

  const contractSessions = useMemo(
    () =>
      sessionList
        .filter((s) => !selectedContractId || s.contractId === selectedContractId)
        .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1)),
    [sessionList, selectedContractId]
  );

  const currentSession = sessionList.find((s) => s.id === selectedSessionId);
  const currentContract = currentSession
    ? contracts.find((c) => c.id === currentSession.contractId)
    : undefined;
  const currentCompany = currentContract
    ? companies.find((c) => c.id === currentContract.companyId)
    : undefined;

  const expectedParticipants = useMemo(() => {
    if (!currentSession) return [];
    return currentSession.expectedParticipantIds
      .map((id) => participantList.find((p) => p.id === id))
      .filter((p): p is Participant => !!p);
  }, [currentSession, participantList]);

  const recordFor = (participantId: string): AttendanceRecord | undefined => {
    if (!currentSession) return undefined;
    return records.find(
      (r) => r.sessionId === currentSession.id && r.participantId === participantId
    );
  };

  const setStatus = (participantId: string, status: "present" | "absent" | "late") => {
    if (!currentSession) return;
    setRecords((rs) => {
      const idx = rs.findIndex(
        (r) => r.sessionId === currentSession.id && r.participantId === participantId
      );
      if (idx >= 0) {
        const next = [...rs];
        next[idx] = { ...next[idx], status, recordedAt: new Date().toISOString().slice(0, 10) };
        return next;
      }
      return [
        ...rs,
        {
          id: `ar-new-${currentSession.id}-${participantId}`,
          participantId,
          sessionId: currentSession.id,
          status,
          recordedAt: new Date().toISOString().slice(0, 10),
          recordedBy: "古野"
        }
      ];
    });
  };

  const setNote = (participantId: string, note: string) => {
    if (!currentSession) return;
    setRecords((rs) => {
      const idx = rs.findIndex(
        (r) => r.sessionId === currentSession.id && r.participantId === participantId
      );
      if (idx >= 0) {
        const next = [...rs];
        next[idx] = { ...next[idx], note };
        return next;
      }
      return [
        ...rs,
        {
          id: `ar-new-${currentSession.id}-${participantId}`,
          participantId,
          sessionId: currentSession.id,
          status: "present",
          recordedAt: new Date().toISOString().slice(0, 10),
          recordedBy: "古野",
          note
        }
      ];
    });
  };

  const markAllPresent = () => {
    if (!currentSession) return;
    expectedParticipants.forEach((p) => setStatus(p.id, "present"));
  };

  const onSave = () => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  };

  const updateExpected = (newIds: string[]) => {
    if (!currentSession) return;
    setSessionList((ss) =>
      ss.map((s) =>
        s.id === currentSession.id ? { ...s, expectedParticipantIds: newIds } : s
      )
    );
  };

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
      <section>
        <div className="text-xs text-ink-500">出席管理</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink-900">
          出席記録
        </h1>
        <div className="mt-1 text-sm text-ink-500">
          各セッションの対象者を選択し、出席実績を入力します
        </div>
      </section>

      {/* フィルタ */}
      <section className="liquid-surface p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-[11px] font-medium text-ink-500 mb-1.5">研修</label>
          <select
            className="w-full px-3 py-2 rounded-xl bg-white border border-ink-100 text-sm text-ink-900"
            value={selectedProduct}
            onChange={(e) => {
              setSelectedProduct(e.target.value as ProductCode | "");
              setSelectedContractId("");
              setSelectedSessionId("");
            }}
          >
            <option value="">すべての研修</option>
            {products.map((p) => (
              <option key={p.code} value={p.code}>
                {p.shortName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-ink-500 mb-1.5">契約（企業）</label>
          <select
            className="w-full px-3 py-2 rounded-xl bg-white border border-ink-100 text-sm text-ink-900"
            value={selectedContractId}
            onChange={(e) => {
              setSelectedContractId(e.target.value);
              setSelectedSessionId("");
            }}
          >
            <option value="">契約を選択</option>
            {filteredContracts.map((c) => {
              const co = companies.find((x) => x.id === c.companyId);
              return (
                <option key={c.id} value={c.id}>
                  {co?.name ?? c.companyId} / {c.product}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-ink-500 mb-1.5">セッション</label>
          <select
            className="w-full px-3 py-2 rounded-xl bg-white border border-ink-100 text-sm text-ink-900"
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            disabled={!selectedContractId}
          >
            <option value="">セッションを選択</option>
            {contractSessions.map((s) => (
              <option key={s.id} value={s.id}>
                第{s.sessionNumber}回 / {s.title} / {s.scheduledAt}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* セッション本体 */}
      {currentSession ? (
        <section className="liquid-surface p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-xs text-ink-500">
                {currentCompany?.name ?? ""} ・ {currentSession.scheduledAt}
              </div>
              <div className="mt-0.5 text-lg font-bold text-ink-900">
                第{currentSession.sessionNumber}回 ・ {currentSession.title}
              </div>
              <div className="mt-1 text-[11px] text-ink-500">
                対象者 {expectedParticipants.length} 名
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={markAllPresent}
                className="px-3 py-1.5 rounded-full bg-white border border-ink-100 text-xs text-ink-700 hover:bg-ink-50"
              >
                全員 present にする
              </button>
              <button
                onClick={() => setModalOpen(true)}
                className="px-3 py-1.5 rounded-full bg-white border border-ink-100 text-xs text-ink-700 hover:bg-ink-50"
              >
                対象者を編集
              </button>
              <button
                onClick={onSave}
                className="px-4 py-1.5 rounded-full bg-ink-900 text-white text-sm hover:opacity-90"
              >
                保存
              </button>
              {savedFlash && (
                <span className="text-xs text-emerald-600 font-medium">✓ 保存しました</span>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-ink-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-ink-500 bg-ink-50 border-b border-ink-100">
                  <th className="px-4 py-2.5 font-medium">名前</th>
                  <th className="px-3 py-2.5 font-medium w-32">部門</th>
                  <th className="px-3 py-2.5 font-medium w-24">役職</th>
                  <th className="px-3 py-2.5 font-medium w-72">出席ステータス</th>
                  <th className="px-3 py-2.5 font-medium">メモ</th>
                </tr>
              </thead>
              <tbody>
                {expectedParticipants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-xs text-ink-500">
                      対象者が設定されていません
                    </td>
                  </tr>
                )}
                {expectedParticipants.map((p) => {
                  const rec = recordFor(p.id);
                  return (
                    <tr key={p.id} className="border-b border-ink-50 last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-ink-900">{p.name}</div>
                        <div className="text-[11px] text-ink-500">{p.role ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2.5 text-ink-700 text-xs">{p.department ?? "—"}</td>
                      <td className="px-3 py-2.5 text-ink-700 text-xs">
                        {p.seniority ? seniorityLabel[p.seniority] : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {(["present", "late", "absent"] as const).map((st) => {
                            const active = rec?.status === st;
                            const color =
                              st === "present"
                                ? "#10B981"
                                : st === "late"
                                ? "#F59E0B"
                                : "#EF4444";
                            const label =
                              st === "present" ? "出席" : st === "late" ? "遅刻" : "欠席";
                            return (
                              <button
                                key={st}
                                onClick={() => setStatus(p.id, st)}
                                className="text-[11px] px-2.5 py-1 rounded-full border transition"
                                style={{
                                  background: active ? color : "white",
                                  color: active ? "white" : color,
                                  borderColor: color
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          className="w-full px-2 py-1.5 rounded-lg border border-ink-100 text-xs"
                          placeholder="メモ"
                          value={rec?.note ?? ""}
                          onChange={(e) => setNote(p.id, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="liquid-surface p-12 text-center text-sm text-ink-500">
          上のフィルタからセッションを選択してください
        </section>
      )}

      {modalOpen && currentSession && (
        <ExpectedEditModal
          contractParticipants={participantList.filter(
            (p) => p.contractId === currentSession.contractId
          )}
          selectedIds={currentSession.expectedParticipantIds}
          onClose={() => setModalOpen(false)}
          onSave={(ids) => {
            updateExpected(ids);
            setModalOpen(false);
          }}
        />
      )}
    </main>
  );
}

function ExpectedEditModal({
  contractParticipants,
  selectedIds,
  onClose,
  onSave
}: {
  contractParticipants: Participant[];
  selectedIds: string[];
  onClose: () => void;
  onSave: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const toggle = (id: string) => {
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="text-base font-semibold text-ink-900">対象者の編集</div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-700 text-sm">
            ✕
          </button>
        </div>
        <div className="text-xs text-ink-500">
          このセッションに参加予定の人をチェック
        </div>
        <ul className="space-y-1.5 max-h-80 overflow-auto">
          {contractParticipants.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg hover:bg-ink-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.includes(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span className="text-ink-900 font-medium">{p.name}</span>
                <span className="text-ink-500">{p.role ?? ""}</span>
                <span className="ml-auto text-[10px] text-ink-500">
                  {p.department ?? ""}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="pt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-700 hover:bg-ink-50"
          >
            キャンセル
          </button>
          <button
            onClick={() => onSave(draft)}
            className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:opacity-90"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
