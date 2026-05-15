"use client";

// オンボテンプレ編集 UI (Client Component)
// /settings/products/[code] のセクションとして使う

import { useState, useTransition } from "react";
import {
  upsertOnboardingCategoryAction,
  deleteOnboardingCategoryAction,
  upsertOnboardingItemAction,
  deleteOnboardingItemAction,
  applyTemplateToActiveContractsAction
} from "./onboarding-actions";
import type {
  OnboardingTemplateCategoryRecord,
  OnboardingTemplateItemRecord
} from "@/lib/repository/types";

const ROLE_OPTIONS: ("cs" | "pr" | "ops" | "finance" | "")[] = ["", "cs", "pr", "ops", "finance"];
const ROLE_LABEL: Record<string, string> = {
  "": "—",
  cs: "CS",
  pr: "PR",
  ops: "Ops",
  finance: "Finance"
};

export function OnboardingTemplateEditor({
  productCode,
  initialTemplate,
  canManage,
  productCourses
}: {
  productCode: string;
  initialTemplate: OnboardingTemplateCategoryRecord[];
  canManage: boolean;
  productCourses: { key: string; shortName: string }[];
}) {
  const [template, setTemplate] = useState(initialTemplate);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [addingCat, setAddingCat] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [applyPending, startApply] = useTransition();

  const onApplyToActive = () => {
    setError(null);
    setApplyResult(null);
    if (
      !window.confirm(
        `${productCode} の active 契約全件に、現在のテンプレ項目を一括投入します。\n` +
          `既存項目は重複せず保持されます。実行しますか？`
      )
    ) {
      return;
    }
    startApply(async () => {
      const r = await applyTemplateToActiveContractsAction({ productCode });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setApplyResult(
        `対象 ${r.targetContracts} 契約 / 新規 ${r.created} 件 / 既存スキップ ${r.skipped} 件`
      );
    });
  };

  const refreshAfter = (mutator: () => OnboardingTemplateCategoryRecord[]) => {
    setTemplate(mutator());
  };

  const onAddCategory = (input: { categoryKey: string; label: string }) => {
    setError(null);
    start(async () => {
      const r = await upsertOnboardingCategoryAction({
        productCode,
        categoryKey: input.categoryKey,
        label: input.label,
        displayOrder: (template[template.length - 1]?.displayOrder ?? 0) + 1
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      // 楽観追加: 仮 id でリストに追加
      refreshAfter(() => [
        ...template,
        {
          id: r.id,
          productCode,
          categoryKey: input.categoryKey,
          label: input.label,
          displayOrder: (template[template.length - 1]?.displayOrder ?? 0) + 1,
          items: []
        }
      ]);
      setAddingCat(false);
    });
  };

  const onUpdateCategory = (cat: OnboardingTemplateCategoryRecord, label: string) => {
    setError(null);
    start(async () => {
      const r = await upsertOnboardingCategoryAction({
        productCode,
        id: cat.id,
        categoryKey: cat.categoryKey,
        label,
        displayOrder: cat.displayOrder
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      refreshAfter(() =>
        template.map((c) => (c.id === cat.id ? { ...c, label } : c))
      );
    });
  };

  const onDeleteCategory = (cat: OnboardingTemplateCategoryRecord) => {
    if (!confirm(`カテゴリ「${cat.label}」を削除します。この中の項目も全て削除されます。`)) return;
    setError(null);
    start(async () => {
      const r = await deleteOnboardingCategoryAction({ productCode, id: cat.id });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      refreshAfter(() => template.filter((c) => c.id !== cat.id));
    });
  };

  const onUpsertItem = (
    cat: OnboardingTemplateCategoryRecord,
    item: Partial<OnboardingTemplateItemRecord> & {
      itemKey: string;
      name: string;
      dueOffsetDays: number;
      required: boolean;
    }
  ) => {
    setError(null);
    start(async () => {
      const r = await upsertOnboardingItemAction({
        productCode,
        id: item.id,
        categoryId: cat.id,
        itemKey: item.itemKey,
        name: item.name,
        dueOffsetDays: item.dueOffsetDays,
        required: item.required,
        defaultAssigneeRole: item.defaultAssigneeRole ?? null,
        courseKey: item.courseKey ?? null
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      refreshAfter(() =>
        template.map((c) => {
          if (c.id !== cat.id) return c;
          const next: OnboardingTemplateItemRecord = {
            id: r.id,
            categoryId: cat.id,
            itemKey: item.itemKey,
            name: item.name,
            dueOffsetDays: item.dueOffsetDays,
            required: item.required,
            defaultAssigneeRole: item.defaultAssigneeRole ?? null,
            courseKey: item.courseKey ?? null
          };
          const idx = c.items.findIndex((i) => i.id === r.id);
          if (idx < 0) return { ...c, items: [...c.items, next] };
          return {
            ...c,
            items: c.items.map((i, j) => (j === idx ? next : i))
          };
        })
      );
    });
  };

  const onDeleteItem = (cat: OnboardingTemplateCategoryRecord, item: OnboardingTemplateItemRecord) => {
    if (!confirm(`項目「${item.name}」を削除します。`)) return;
    setError(null);
    start(async () => {
      const r = await deleteOnboardingItemAction({ productCode, id: item.id });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      refreshAfter(() =>
        template.map((c) =>
          c.id === cat.id ? { ...c, items: c.items.filter((i) => i.id !== item.id) } : c
        )
      );
    });
  };

  return (
    <section className="liquid-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-ink-700">オンボーディング テンプレ</div>
          <div className="mt-0.5 text-[11px] text-ink-500">
            この研修の各契約に自動展開されるオンボ項目。期 (cycleNumber) や課程の起票時に
            <code className="bg-ink-50 px-1 rounded">contract_onboarding_items</code> に展開される。
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onApplyToActive}
              disabled={pending || applyPending || template.length === 0}
              title={
                template.length === 0
                  ? "テンプレを追加してから実行できます"
                  : "active 契約に現テンプレ項目を一括投入"
              }
              className="text-xs px-3 py-1.5 rounded-md border border-ink-300 text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              {applyPending ? "適用中…" : "既存契約に一括適用"}
            </button>
            <button
              type="button"
              onClick={() => setAddingCat(true)}
              disabled={pending}
              className="text-xs px-3 py-1.5 rounded-md bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-50"
            >
              ＋ カテゴリ追加
            </button>
          </div>
        )}
      </div>

      {applyResult && (
        <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 px-3 py-2 rounded-md">
          {applyResult}
        </div>
      )}

      {error && <div className="text-xs text-rose-600">{error}</div>}

      {addingCat && (
        <CategoryAddRow
          onCancel={() => setAddingCat(false)}
          onSubmit={(input) => onAddCategory(input)}
        />
      )}

      {template.length === 0 && !addingCat && (
        <div className="text-xs text-ink-500">テンプレが未登録です</div>
      )}

      {template.map((cat) => (
        <CategoryBlock
          key={cat.id}
          cat={cat}
          canManage={canManage}
          productCourses={productCourses}
          onUpdate={(label) => onUpdateCategory(cat, label)}
          onDelete={() => onDeleteCategory(cat)}
          onUpsertItem={(item) => onUpsertItem(cat, item)}
          onDeleteItem={(item) => onDeleteItem(cat, item)}
        />
      ))}
    </section>
  );
}

function CategoryAddRow({
  onCancel,
  onSubmit
}: {
  onCancel: () => void;
  onSubmit: (input: { categoryKey: string; label: string }) => void;
}) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  return (
    <div className="rounded border border-ink-200 p-3 bg-white flex items-end gap-2 flex-wrap">
      <label className="text-[11px] text-ink-700">
        category_key (英数字)
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="block mt-1 border border-ink-200 rounded px-2 py-1 text-sm w-44"
          placeholder="follow_up"
        />
      </label>
      <label className="text-[11px] text-ink-700">
        ラベル (表示名)
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="block mt-1 border border-ink-200 rounded px-2 py-1 text-sm w-56"
          placeholder="フォローアップ"
        />
      </label>
      <button
        type="button"
        onClick={() => onSubmit({ categoryKey: key, label })}
        className="text-xs px-3 py-1.5 rounded bg-ink-900 text-white"
      >
        追加
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-xs px-3 py-1.5 rounded border border-ink-200 text-ink-700"
      >
        キャンセル
      </button>
    </div>
  );
}

function CategoryBlock({
  cat,
  canManage,
  productCourses,
  onUpdate,
  onDelete,
  onUpsertItem,
  onDeleteItem
}: {
  cat: OnboardingTemplateCategoryRecord;
  canManage: boolean;
  productCourses: { key: string; shortName: string }[];
  onUpdate: (label: string) => void;
  onDelete: () => void;
  onUpsertItem: (
    item: Partial<OnboardingTemplateItemRecord> & {
      itemKey: string;
      name: string;
      dueOffsetDays: number;
      required: boolean;
    }
  ) => void;
  onDeleteItem: (item: OnboardingTemplateItemRecord) => void;
}) {
  const [label, setLabel] = useState(cat.label);
  const [adding, setAdding] = useState(false);

  return (
    <div className="rounded border border-ink-100 bg-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-ink-100 bg-ink-50/30">
        <div className="flex items-center gap-2">
          <code className="text-[10px] text-ink-500 bg-white border border-ink-100 px-1.5 py-0.5 rounded">
            {cat.categoryKey}
          </code>
          {canManage ? (
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => label !== cat.label && onUpdate(label)}
              className="border border-transparent hover:border-ink-200 focus:border-ink-300 rounded px-1.5 py-0.5 text-sm font-medium"
            />
          ) : (
            <span className="text-sm font-medium">{cat.label}</span>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-[11px] text-ink-700 px-2 py-1 rounded border border-ink-200 hover:bg-ink-50"
            >
              ＋ 項目追加
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-[11px] text-rose-600 px-2 py-1 rounded border border-rose-200 hover:bg-rose-50"
            >
              カテゴリ削除
            </button>
          </div>
        )}
      </div>
      <div className="px-3 py-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] text-ink-500 border-b border-ink-100">
              <th className="px-2 py-1.5 w-32">item_key</th>
              <th className="px-2 py-1.5">項目名</th>
              <th className="px-2 py-1.5 w-20">期日(日)</th>
              <th className="px-2 py-1.5 w-16">必須</th>
              <th className="px-2 py-1.5 w-24">担当</th>
              <th className="px-2 py-1.5 w-28">course</th>
              <th className="px-2 py-1.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {cat.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                canManage={canManage}
                productCourses={productCourses}
                onSave={(patch) =>
                  onUpsertItem({
                    ...item,
                    ...patch
                  })
                }
                onDelete={() => onDeleteItem(item)}
              />
            ))}
            {adding && (
              <ItemAddRow
                productCourses={productCourses}
                onCancel={() => setAdding(false)}
                onSubmit={(input) => {
                  onUpsertItem(input);
                  setAdding(false);
                }}
              />
            )}
            {cat.items.length === 0 && !adding && (
              <tr>
                <td colSpan={7} className="px-2 py-3 text-center text-[11px] text-ink-500">
                  項目がまだありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  canManage,
  productCourses,
  onSave,
  onDelete
}: {
  item: OnboardingTemplateItemRecord;
  canManage: boolean;
  productCourses: { key: string; shortName: string }[];
  onSave: (patch: Partial<OnboardingTemplateItemRecord>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [dueOffset, setDueOffset] = useState(String(item.dueOffsetDays));
  const [required, setRequired] = useState(item.required);
  const [role, setRole] = useState<string>(item.defaultAssigneeRole ?? "");
  const [courseKey, setCourseKey] = useState<string>(item.courseKey ?? "");

  const flush = () => {
    const num = Number(dueOffset);
    if (Number.isNaN(num)) return;
    onSave({
      name,
      dueOffsetDays: num,
      required,
      defaultAssigneeRole: (role || null) as "cs" | "pr" | "ops" | "finance" | null,
      courseKey: courseKey || null
    });
  };

  return (
    <tr className="border-b border-ink-50 last:border-0">
      <td className="px-2 py-1">
        <code className="text-[10px] text-ink-500">{item.itemKey}</code>
      </td>
      <td className="px-2 py-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={flush}
          disabled={!canManage}
          className="w-full border border-transparent hover:border-ink-200 focus:border-ink-300 rounded px-1.5 py-0.5 text-sm disabled:bg-ink-50/30"
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="number"
          value={dueOffset}
          onChange={(e) => setDueOffset(e.target.value)}
          onBlur={flush}
          disabled={!canManage}
          className="w-full border border-transparent hover:border-ink-200 focus:border-ink-300 rounded px-1.5 py-0.5 text-sm disabled:bg-ink-50/30 tabular-nums"
        />
      </td>
      <td className="px-2 py-1 text-center">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => {
            setRequired(e.target.checked);
            onSave({
              required: e.target.checked
            });
          }}
          disabled={!canManage}
        />
      </td>
      <td className="px-2 py-1">
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            onSave({
              defaultAssigneeRole: (e.target.value || null) as
                | "cs"
                | "pr"
                | "ops"
                | "finance"
                | null
            });
          }}
          disabled={!canManage}
          className="w-full text-[11px] border border-ink-200 rounded px-1 py-0.5 disabled:bg-ink-50/30"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1">
        <select
          value={courseKey}
          onChange={(e) => {
            setCourseKey(e.target.value);
            onSave({ courseKey: e.target.value || null });
          }}
          disabled={!canManage || productCourses.length <= 1}
          className="w-full text-[11px] border border-ink-200 rounded px-1 py-0.5 disabled:bg-ink-50/30"
        >
          <option value="">全コース</option>
          {productCourses.map((c) => (
            <option key={c.key} value={c.key}>
              {c.shortName}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1 text-right">
        {canManage && (
          <button
            type="button"
            onClick={onDelete}
            className="text-[11px] text-rose-600 hover:underline"
          >
            削除
          </button>
        )}
      </td>
    </tr>
  );
}

function ItemAddRow({
  productCourses,
  onCancel,
  onSubmit
}: {
  productCourses: { key: string; shortName: string }[];
  onCancel: () => void;
  onSubmit: (input: {
    itemKey: string;
    name: string;
    dueOffsetDays: number;
    required: boolean;
    defaultAssigneeRole?: "cs" | "pr" | "ops" | "finance" | null;
    courseKey?: string | null;
  }) => void;
}) {
  const [itemKey, setItemKey] = useState("");
  const [name, setName] = useState("");
  const [dueOffset, setDueOffset] = useState("0");
  const [required, setRequired] = useState(true);
  const [role, setRole] = useState<string>("");
  const [courseKey, setCourseKey] = useState<string>("");

  return (
    <tr className="bg-amber-50/30">
      <td className="px-2 py-1">
        <input
          value={itemKey}
          onChange={(e) => setItemKey(e.target.value)}
          placeholder="welcome_mail"
          className="w-full border border-ink-200 rounded px-1.5 py-0.5 text-sm"
        />
      </td>
      <td className="px-2 py-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ウェルカムメール配信"
          className="w-full border border-ink-200 rounded px-1.5 py-0.5 text-sm"
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="number"
          value={dueOffset}
          onChange={(e) => setDueOffset(e.target.value)}
          className="w-full border border-ink-200 rounded px-1.5 py-0.5 text-sm tabular-nums"
        />
      </td>
      <td className="px-2 py-1 text-center">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
      </td>
      <td className="px-2 py-1">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full text-[11px] border border-ink-200 rounded px-1 py-0.5"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1">
        <select
          value={courseKey}
          onChange={(e) => setCourseKey(e.target.value)}
          disabled={productCourses.length <= 1}
          className="w-full text-[11px] border border-ink-200 rounded px-1 py-0.5"
        >
          <option value="">全コース</option>
          {productCourses.map((c) => (
            <option key={c.key} value={c.key}>
              {c.shortName}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1 text-right space-x-1">
        <button
          type="button"
          onClick={() => {
            const num = Number(dueOffset);
            if (!itemKey || !name || Number.isNaN(num)) return;
            onSubmit({
              itemKey,
              name,
              dueOffsetDays: num,
              required,
              defaultAssigneeRole: (role || null) as "cs" | "pr" | "ops" | "finance" | null,
              courseKey: courseKey || null
            });
          }}
          className="text-[11px] text-white px-2 py-0.5 rounded bg-ink-900"
        >
          追加
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] px-2 py-0.5 rounded border border-ink-200 text-ink-700"
        >
          中止
        </button>
      </td>
    </tr>
  );
}
