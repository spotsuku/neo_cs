"use client";

import { useMemo, useState } from "react";
import type { Company, Contact, ContactRoleLevel } from "@/lib/mock/entities";
import {
  resolveParticipantRole,
  ROLE_LEVEL_LABEL,
  ROLE_LEVEL_ORDER,
  type Participant,
  type Session
} from "@/lib/mock/participants";
import type { ProductCode } from "@/lib/repository/types";

/**
 * 出席対象の編集モーダル。
 *
 * - 1列 = 同 product 内で同日のセッション群（複数 contract をまたぐ）
 * - 派遣者は contract ごとに別なので、保存時は contractId → expectedIds[] のマップで返す
 * - 属性指定は「組織ロール（担当役員 / 決裁者 / 担当責任者 / 担当者）」軸のみ
 *   企業ごとの招待概念は持たない（招待は事業横断で組織ロール単位）
 */
export function ExpectedTargetModal({
  sessions,
  contractParticipants,
  companies,
  contacts,
  product,
  onClose,
  onSave
}: {
  sessions: Session[];
  contractParticipants: Participant[];
  companies: Company[];
  contacts: Contact[];
  product: ProductCode;
  onClose: () => void;
  onSave: (idsByContract: Map<string, string[]>) => void;
}) {
  // 派遣者ID → ロール（組織図優先）
  const participantRole = useMemo(() => {
    const map = new Map<string, ContactRoleLevel>();
    contractParticipants.forEach((p) => {
      map.set(
        p.id,
        resolveParticipantRole(p, {
          contacts,
          productScope: product,
          // sessions の cycleNumber は contractId 経由で自明だが、既存契約から推定
          currentCycle: undefined
        })
      );
    });
    return map;
  }, [contractParticipants, contacts, product]);
  const initial = useMemo(() => {
    const s = new Set<string>();
    sessions.forEach((sess) =>
      sess.expectedParticipantIds.forEach((id) => s.add(id))
    );
    return s;
  }, [sessions]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial));

  const headerSession = sessions[0];

  const availableRoles = useMemo(() => {
    const s = new Set<ContactRoleLevel>();
    contractParticipants.forEach((p) => {
      const lvl = participantRole.get(p.id);
      if (lvl) s.add(lvl);
    });
    return ROLE_LEVEL_ORDER.filter((r) => s.has(r));
  }, [contractParticipants, participantRole]);

  const groupedByCompany = useMemo(() => {
    const m = new Map<string, Participant[]>();
    contractParticipants.forEach((p) => {
      const arr = m.get(p.companyId) ?? [];
      arr.push(p);
      m.set(p.companyId, arr);
    });
    return Array.from(m.entries()).map(([companyId, ps]) => ({
      companyId,
      company: companies.find((c) => c.id === companyId),
      participants: ps.sort((a, b) => a.name.localeCompare(b.name, "ja"))
    }));
  }, [contractParticipants, companies]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setAll = (val: boolean) => {
    setSelected(val ? new Set(contractParticipants.map((p) => p.id)) : new Set());
  };

  const applyRole = (r: ContactRoleLevel, include: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      contractParticipants
        .filter((p) => participantRole.get(p.id) === r)
        .forEach((p) => {
          if (include) next.add(p.id);
          else next.delete(p.id);
        });
      return next;
    });
  };

  const roleState = (r: ContactRoleLevel): "all" | "none" | "mix" => {
    const targets = contractParticipants.filter(
      (p) => participantRole.get(p.id) === r
    );
    if (targets.length === 0) return "none";
    const ins = targets.filter((p) => selected.has(p.id)).length;
    if (ins === targets.length) return "all";
    if (ins === 0) return "none";
    return "mix";
  };

  const handleSave = () => {
    const byContract = new Map<string, string[]>();
    sessions.forEach((sess) => {
      const ids = contractParticipants
        .filter((p) => p.contractId === sess.contractId && selected.has(p.id))
        .map((p) => p.id);
      byContract.set(sess.contractId, ids);
    });
    onSave(byContract);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-5 space-y-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink-900">出席対象を編集</h2>
            <button
              onClick={onClose}
              className="text-ink-400 hover:text-ink-700 text-lg"
            >
              ×
            </button>
          </div>
          <div className="text-xs text-ink-500 mt-0.5">
            {headerSession?.scheduledAt} 第{headerSession?.sessionNumber}回 ・{" "}
            {headerSession?.title}
            {sessions.length > 1 && (
              <span className="ml-2 text-ink-400">
                （{sessions.length}契約をまたぐ列）
              </span>
            )}
          </div>
        </header>

        <div className="space-y-3 overflow-y-auto flex-1 -mx-1 px-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setAll(true)}
              className="px-3 py-1 rounded-full text-xs bg-ink-50 text-ink-700 hover:bg-ink-100"
            >
              全員を対象
            </button>
            <button
              onClick={() => setAll(false)}
              className="px-3 py-1 rounded-full text-xs bg-ink-50 text-ink-700 hover:bg-ink-100"
            >
              全員を除外
            </button>
            <span className="ml-auto text-xs text-ink-500">
              対象: <span className="font-bold text-ink-900">{selected.size}</span> /{" "}
              {contractParticipants.length} 名
            </span>
          </div>

          {availableRoles.length > 0 && (
            <div>
              <div className="text-[11px] text-ink-500 mb-1.5">
                組織ロールで含める / 外す
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableRoles.map((r) => {
                  const st = roleState(r);
                  return (
                    <AttrChip
                      key={r}
                      label={ROLE_LEVEL_LABEL[r]}
                      state={st}
                      onInclude={() => applyRole(r, true)}
                      onExclude={() => applyRole(r, false)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="text-[11px] text-ink-500 mb-1.5">個別設定</div>
            <ul className="border border-ink-100 rounded-xl divide-y divide-ink-50">
              {groupedByCompany.map((grp) => (
                <li key={grp.companyId}>
                  <div className="px-3 py-1.5 bg-ink-50/60 text-[11px] font-semibold text-ink-700">
                    {grp.company?.name ?? grp.companyId}
                  </div>
                  <ul>
                    {grp.participants.map((p) => {
                      const lvl = participantRole.get(p.id) ?? "member";
                      return (
                        <li
                          key={p.id}
                          className="px-3 py-2 flex items-center gap-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            id={`pp-${p.id}`}
                            checked={selected.has(p.id)}
                            onChange={() => toggle(p.id)}
                          />
                          <label
                            htmlFor={`pp-${p.id}`}
                            className="flex items-center gap-2 flex-1 cursor-pointer"
                          >
                            <span className="font-medium text-ink-900">
                              {p.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-px rounded bg-ink-50 text-ink-700">
                              {ROLE_LEVEL_LABEL[lvl]}
                            </span>
                            {p.role && (
                              <span className="text-[10px] text-ink-500">
                                {p.role}
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 pt-2 border-t border-ink-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-full border border-ink-100 text-xs text-ink-700 hover:bg-ink-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-full bg-ink-900 text-white text-xs hover:opacity-90"
          >
            保存
          </button>
        </footer>
      </div>
    </div>
  );
}

function AttrChip({
  label,
  state,
  onInclude,
  onExclude
}: {
  label: string;
  state: "all" | "none" | "mix";
  onInclude: () => void;
  onExclude: () => void;
}) {
  const tone =
    state === "all"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : state === "mix"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-ink-50 text-ink-500 border-ink-100";
  return (
    <div className={`inline-flex items-stretch rounded-full border ${tone}`}>
      <span className="px-2.5 py-0.5 text-xs">{label}</span>
      <button
        onClick={onInclude}
        title="この組織ロールを全員対象に含める"
        className="px-2 py-0.5 text-xs border-l border-current/30 hover:bg-emerald-200/60"
      >
        +
      </button>
      <button
        onClick={onExclude}
        title="この組織ロールを全員対象から外す"
        className="px-2 py-0.5 text-xs border-l border-current/30 hover:bg-rose-200/60"
      >
        −
      </button>
    </div>
  );
}
