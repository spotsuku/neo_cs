"use client";

import { useMemo, useState } from "react";
import type { ActiveContract } from "@/lib/mock/onboarding";
import type { Company, Contact, ContactRoleLevel } from "@/lib/mock/entities";
import {
  resolveParticipantRole,
  ROLE_LEVEL_LABEL,
  ROLE_LEVEL_ORDER,
  type Participant,
  type Session
} from "@/lib/mock/participants";
import type { ProductCode } from "@/lib/mock/data";

type ScopeMode = "all" | "by_role";

/**
 * 列（=事業の選択期に対する 1 つの開催回）を追加するモーダル。
 *
 * - 事業内の選択期の全アクティブ契約に対して、同じ日付・タイトルで一括生成
 * - 出席対象は組織図ロール（Contact.roles[]）優先 → seniority fallback で resolve
 * - 期(cycleNumber)で絞り込み: 事業内に複数期が存在する場合に選択
 */
export function AddSessionModal({
  product,
  productLabel,
  productContracts,
  productParticipants,
  companies,
  contacts,
  defaultSessionNumber,
  onClose,
  onSave
}: {
  product: ProductCode;
  productLabel: string;
  productContracts: ActiveContract[];
  productParticipants: Participant[];
  companies: Company[];
  contacts: Contact[];
  defaultSessionNumber: number;
  onClose: () => void;
  onSave: (sessions: Session[]) => void;
}) {
  // 期一覧（事業内の cycleNumber、降順）
  const cycles = useMemo(() => {
    const s = new Set<number>();
    productContracts.forEach((c) => s.add(c.cycleNumber));
    return Array.from(s).sort((a, b) => b - a);
  }, [productContracts]);
  const currentCycle = cycles[0] ?? 1;
  const [cycle, setCycle] = useState<number>(currentCycle);

  // 選択期の契約・派遣者
  const cycleContracts = useMemo(
    () => productContracts.filter((c) => c.cycleNumber === cycle),
    [productContracts, cycle]
  );
  const cycleParticipants = useMemo(() => {
    const ids = new Set(cycleContracts.map((c) => c.id));
    return productParticipants.filter((p) => ids.has(p.contractId));
  }, [productParticipants, cycleContracts]);

  const [scheduledAt, setScheduledAt] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [title, setTitle] = useState<string>("");
  const [completed, setCompleted] = useState<boolean>(false);
  const [scopeMode, setScopeMode] = useState<ScopeMode>("all");
  const [selectedRoles, setSelectedRoles] = useState<Set<ContactRoleLevel>>(
    new Set()
  );

  // 派遣者の解決済みロール（Contact.roles 優先）
  const participantRole = useMemo(() => {
    const map = new Map<string, ContactRoleLevel>();
    cycleParticipants.forEach((p) => {
      map.set(
        p.id,
        resolveParticipantRole(p, {
          contacts,
          productScope: product,
          currentCycle: cycle
        })
      );
    });
    return map;
  }, [cycleParticipants, contacts, product, cycle]);

  // 事業に存在するロールレベル
  const availableRoles = useMemo(() => {
    const s = new Set<ContactRoleLevel>();
    cycleParticipants.forEach((p) => {
      const lvl = participantRole.get(p.id);
      if (lvl) s.add(lvl);
    });
    return ROLE_LEVEL_ORDER.filter((r) => s.has(r));
  }, [cycleParticipants, participantRole]);

  // ロールごとの人数（chip に件数表示）
  const roleCount = useMemo(() => {
    const m = new Map<ContactRoleLevel, number>();
    cycleParticipants.forEach((p) => {
      const lvl = participantRole.get(p.id);
      if (!lvl) return;
      m.set(lvl, (m.get(lvl) ?? 0) + 1);
    });
    return m;
  }, [cycleParticipants, participantRole]);

  // 契約 → expected 派遣者ID
  const expectedByContract = useMemo(() => {
    const map = new Map<string, string[]>();
    cycleContracts.forEach((c) => {
      const inContract = cycleParticipants.filter(
        (p) => p.contractId === c.id
      );
      const matched =
        scopeMode === "all"
          ? inContract
          : selectedRoles.size === 0
          ? []
          : inContract.filter((p) => {
              const lvl = participantRole.get(p.id);
              return lvl ? selectedRoles.has(lvl) : false;
            });
      map.set(c.id, matched.map((p) => p.id));
    });
    return map;
  }, [
    cycleContracts,
    cycleParticipants,
    scopeMode,
    selectedRoles,
    participantRole
  ]);

  const totalExpected = useMemo(
    () => Array.from(expectedByContract.values()).reduce((s, x) => s + x.length, 0),
    [expectedByContract]
  );
  const coveredCompanyCount = useMemo(() => {
    const s = new Set<string>();
    cycleContracts.forEach((c) => {
      if ((expectedByContract.get(c.id) ?? []).length > 0) s.add(c.companyId);
    });
    return s.size;
  }, [cycleContracts, expectedByContract]);

  const totalCompanies = useMemo(
    () => new Set(cycleContracts.map((c) => c.companyId)).size,
    [cycleContracts]
  );

  const canSave = scheduledAt && title.trim() && totalExpected > 0;

  const toggleRole = (r: ContactRoleLevel) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  const handleSave = () => {
    if (!canSave) return;
    const sessions: Session[] = cycleContracts.map((c) => ({
      id: `s-new-${c.id}-${Date.now()}`,
      contractId: c.id,
      sessionNumber: defaultSessionNumber,
      scheduledAt,
      completedAt: completed ? scheduledAt : undefined,
      title: title.trim(),
      expectedParticipantIds: expectedByContract.get(c.id) ?? []
    }));
    onSave(sessions);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-base font-bold text-ink-900">列を追加</h2>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink-700 text-lg"
          >
            ×
          </button>
        </header>

        <div className="text-[11px] text-ink-500">
          対象事業:{" "}
          <span className="font-bold text-ink-700">{productLabel}</span>
        </div>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <Field label="期">
              <select
                value={cycle}
                onChange={(e) => {
                  setCycle(Number(e.target.value));
                  setSelectedRoles(new Set());
                }}
                className="w-full px-3 py-1.5 rounded-xl border border-ink-100 bg-white text-sm"
              >
                {cycles.map((cy) => (
                  <option key={cy} value={cy}>
                    第{cy}期 {cy === currentCycle && "（今期）"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="回">
              <input
                type="number"
                min={1}
                value={defaultSessionNumber}
                disabled
                className="w-full px-3 py-1.5 rounded-xl border border-ink-100 bg-ink-50 text-sm text-ink-500"
              />
            </Field>
            <Field label="開催日">
              <input
                type="date"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-ink-100 bg-white text-sm"
              />
            </Field>
          </div>

          <Field label="タイトル">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="第N回 ◯◯講義"
              className="w-full px-3 py-1.5 rounded-xl border border-ink-100 bg-white text-sm"
            />
          </Field>

          <label className="flex items-center gap-2 text-xs text-ink-700">
            <input
              type="checkbox"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
            />
            実施済み（出席率の分母に含める）
          </label>

          <div className="text-[11px] text-ink-500">
            候補: {totalCompanies}社 / {cycleParticipants.length}名（第{cycle}
            期）
          </div>

          <div className="border-t border-ink-100 pt-3">
            <div className="text-[11px] text-ink-500 mb-2">出席対象</div>
            <div className="inline-flex gap-1 p-1 rounded-full bg-ink-50 mb-2">
              <button
                type="button"
                onClick={() => setScopeMode("all")}
                className={`px-3 py-1 rounded-full text-xs ${
                  scopeMode === "all"
                    ? "bg-white shadow text-ink-900 font-medium"
                    : "text-ink-500 hover:text-ink-700"
                }`}
              >
                全員（全社対象）
              </button>
              <button
                type="button"
                onClick={() => setScopeMode("by_role")}
                className={`px-3 py-1 rounded-full text-xs ${
                  scopeMode === "by_role"
                    ? "bg-white shadow text-ink-900 font-medium"
                    : "text-ink-500 hover:text-ink-700"
                }`}
              >
                組織ロールで指定
              </button>
            </div>

            {scopeMode === "by_role" && (
              <div>
                <div className="text-[10px] text-ink-500 mb-1">
                  対象とする組織ロール（組織図ロール優先・複数選択可）
                </div>
                <div className="flex flex-wrap gap-1">
                  {availableRoles.map((r) => {
                    const on = selectedRoles.has(r);
                    const cnt = roleCount.get(r) ?? 0;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRole(r)}
                        className={`text-[11px] px-2.5 py-0.5 rounded-full border ${
                          on
                            ? "bg-emerald-100 border-emerald-200 text-emerald-800"
                            : "bg-white border-ink-100 text-ink-700 hover:bg-ink-50"
                        }`}
                      >
                        {ROLE_LEVEL_LABEL[r]}{" "}
                        <span className="text-ink-500">({cnt})</span>
                      </button>
                    );
                  })}
                </div>
                {selectedRoles.size === 0 && (
                  <div className="text-[10px] text-amber-600 mt-1">
                    ロールを 1 つ以上選択してください
                  </div>
                )}
              </div>
            )}

            <div className="mt-2 text-[11px] text-ink-500">
              対象人数:{" "}
              <span className="font-bold text-ink-900">{totalExpected}</span> 名
              {" / "}対象企業数:{" "}
              <span className="font-bold text-ink-900">
                {coveredCompanyCount}
              </span>{" "}
              社
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-full border border-ink-100 text-xs text-ink-700 hover:bg-ink-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-1.5 rounded-full bg-ink-900 text-white text-xs hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            追加する
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[11px] text-ink-500 mb-1">{label}</div>
      {children}
    </label>
  );
}
