"use client";

import { useState } from "react";
import type { ActiveContract } from "@/lib/mock/onboarding";
import type { Company } from "@/lib/mock/entities";
import type {
  Participant,
  ParticipantSeniority
} from "@/lib/mock/participants";

const SENIORITY_OPTIONS: { value: ParticipantSeniority; label: string }[] = [
  { value: "young", label: "若手" },
  { value: "mid", label: "中堅" },
  { value: "senior", label: "シニア" },
  { value: "exec", label: "役員" }
];

export function AddParticipantModal({
  contracts,
  companies,
  defaultContractId,
  existingDepartments,
  onClose,
  onSave
}: {
  contracts: ActiveContract[];
  companies: Company[];
  defaultContractId?: string;
  existingDepartments: string[];
  onClose: () => void;
  onSave: (p: Participant) => void;
}) {
  const [contractId, setContractId] = useState<string>(
    defaultContractId ?? contracts[0]?.id ?? ""
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [seniority, setSeniority] = useState<ParticipantSeniority>("mid");

  const contract = contracts.find((c) => c.id === contractId);
  const canSave = !!contract && name.trim().length > 0;

  const handleSave = () => {
    if (!canSave || !contract) return;
    onSave({
      id: `pa-new-${Date.now()}`,
      companyId: contract.companyId,
      contractId,
      name: name.trim(),
      email: email.trim(),
      role: role.trim() || undefined,
      status: "active",
      joinedAt: new Date().toISOString().slice(0, 10),
      department: department.trim() || undefined,
      seniority
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-base font-bold text-ink-900">派遣者を追加</h2>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink-700 text-lg"
          >
            ×
          </button>
        </header>

        <div className="space-y-3 text-sm">
          <Field label="契約">
            <select
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-ink-100 bg-white text-sm"
            >
              {contracts.map((c) => {
                const co = companies.find((x) => x.id === c.companyId);
                return (
                  <option key={c.id} value={c.id}>
                    {co?.name ?? c.companyId} / {c.product} / {c.courseKey} / 第
                    {c.cycleNumber}期
                  </option>
                );
              })}
            </select>
          </Field>

          <Field label="氏名">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-ink-100 bg-white text-sm"
            />
          </Field>

          <Field label="メールアドレス">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-ink-100 bg-white text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="部門">
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                list="dept-options"
                className="w-full px-3 py-1.5 rounded-xl border border-ink-100 bg-white text-sm"
              />
              <datalist id="dept-options">
                {existingDepartments.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>
            <Field label="役職">
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-ink-100 bg-white text-sm"
              />
            </Field>
          </div>

          <Field label="シニアリティ">
            <div className="inline-flex gap-1 p-1 rounded-full bg-ink-50">
              {SENIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSeniority(opt.value)}
                  className={`px-3 py-1 rounded-full text-xs ${
                    seniority === opt.value
                      ? "bg-white shadow-sm text-ink-900 font-medium"
                      : "text-ink-500 hover:text-ink-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
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
