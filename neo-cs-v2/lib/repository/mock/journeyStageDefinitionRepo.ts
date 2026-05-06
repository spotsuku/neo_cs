// 企業ジャーニー / 事業ジャーニー の「ステージ定義」mock 実装
// 組織単位でカスタム可能な seed をメモリに保持し、CRUD を提供する。

import {
  DEFAULT_BUSINESS_STAGES,
  DEFAULT_COMPANY_STAGES,
  type JourneyStageDefinition,
  type JourneyType
} from "@/lib/mock/journeys";
import type {
  JourneyStageDefinitionRepo,
  JourneyStageUpsertInput
} from "../types";
import { DEFAULT_ORG_ID } from "../types";

const NOW = () => new Date().toISOString();

function buildDefaults(
  organizationId: string,
  journeyType: JourneyType
): JourneyStageDefinition[] {
  const seeds =
    journeyType === "company" ? DEFAULT_COMPANY_STAGES : DEFAULT_BUSINESS_STAGES;
  const now = NOW();
  return seeds.map((s) => ({
    id: `${organizationId}-${journeyType}-${s.stageKey}`,
    organizationId,
    journeyType,
    stageKey: s.stageKey,
    displayOrder: s.displayOrder,
    name: s.name,
    description: s.description,
    color: s.color,
    keyActions: s.keyActions,
    checkpoints: s.checkpoints,
    createdAt: now,
    updatedAt: now
  }));
}

/**
 * Seed バージョン. seed 内容（ステージ名・チェックポイント）を更新したら bump。
 * dev server の HMR で globalThis ストアが残っても、バージョン違いなら再 seed。
 */
const SEED_VERSION = "v3-2026-05";

import { useGlobalStore } from "./_global-store";

// 組織×タイプ単位で初期化済みかを記録 (globalThis 共有)
const initialized = useGlobalStore<Set<string>>(
  "__journeyStageInitialized",
  () => new Set<string>()
);
const store = useGlobalStore<JourneyStageDefinition[]>(
  "__journeyStageDefinitionStore",
  () => []
);

function ensureSeeded(organizationId: string, journeyType: JourneyType) {
  const key = `${organizationId}:${journeyType}:${SEED_VERSION}`;
  if (initialized.has(key)) return;
  // 旧バージョン / 重複 seed (HMR や旧キーで蓄積されたもの) を掃除
  for (let i = store.length - 1; i >= 0; i--) {
    if (
      store[i].organizationId === organizationId &&
      store[i].journeyType === journeyType
    ) {
      store.splice(i, 1);
    }
  }
  // 旧キー (バージョン無し / 別バージョン) もクリーンアップ
  for (const k of [...initialized]) {
    if (k.startsWith(`${organizationId}:${journeyType}`)) initialized.delete(k);
  }
  store.push(...buildDefaults(organizationId, journeyType));
  initialized.add(key);
}

export const mockJourneyStageDefinitionRepo: JourneyStageDefinitionRepo = {
  async list({ organizationId = DEFAULT_ORG_ID, journeyType }) {
    ensureSeeded(organizationId, journeyType);
    // 防御的 dedup: stageKey 単位で1件のみ残す (HMR で旧 seed が混入した場合の保険)
    const seen = new Set<string>();
    return store
      .filter(
        (s) =>
          s.organizationId === organizationId && s.journeyType === journeyType
      )
      .filter((s) => {
        if (seen.has(s.stageKey)) return false;
        seen.add(s.stageKey);
        return true;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((s) => ({ ...s }));
  },

  async upsert(input: JourneyStageUpsertInput) {
    const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
    ensureSeeded(organizationId, input.journeyType);
    const lookupKey = input.previousStageKey ?? input.stageKey;
    const existingIdx = store.findIndex(
      (s) =>
        s.organizationId === organizationId &&
        s.journeyType === input.journeyType &&
        s.stageKey === lookupKey
    );
    const now = NOW();
    if (existingIdx >= 0) {
      const updated: JourneyStageDefinition = {
        ...store[existingIdx],
        stageKey: input.stageKey,
        displayOrder: input.displayOrder,
        name: input.name,
        description: input.description,
        color: input.color,
        keyActions: input.keyActions,
        updatedAt: now
      };
      store[existingIdx] = updated;
      return { ...updated };
    }
    const created: JourneyStageDefinition = {
      id: `${organizationId}-${input.journeyType}-${input.stageKey}-${Date.now()}`,
      organizationId,
      journeyType: input.journeyType,
      stageKey: input.stageKey,
      displayOrder: input.displayOrder,
      name: input.name,
      description: input.description,
      color: input.color,
      keyActions: input.keyActions,
      createdAt: now,
      updatedAt: now
    };
    store.push(created);
    return { ...created };
  },

  async delete({ organizationId = DEFAULT_ORG_ID, journeyType, stageKey }) {
    const idx = store.findIndex(
      (s) =>
        s.organizationId === organizationId &&
        s.journeyType === journeyType &&
        s.stageKey === stageKey
    );
    if (idx >= 0) store.splice(idx, 1);
  },

  async resetToDefaults({ organizationId = DEFAULT_ORG_ID, journeyType }) {
    // 当該組織×タイプの既存定義を全削除して seed を再投入
    for (let i = store.length - 1; i >= 0; i--) {
      const s = store[i];
      if (s.organizationId === organizationId && s.journeyType === journeyType) {
        store.splice(i, 1);
      }
    }
    for (const k of [...initialized]) {
      if (k.startsWith(`${organizationId}:${journeyType}`)) initialized.delete(k);
    }
    ensureSeeded(organizationId, journeyType);
    return store
      .filter(
        (s) =>
          s.organizationId === organizationId && s.journeyType === journeyType
      )
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((s) => ({ ...s }));
  }
};

/** 内部利用: 同期取得 (UI で SSR/CSR 両方で使うため) */
export function getStageDefinitionsSync(
  organizationId: string,
  journeyType: JourneyType
): JourneyStageDefinition[] {
  ensureSeeded(organizationId, journeyType);
  return store
    .filter(
      (s) => s.organizationId === organizationId && s.journeyType === journeyType
    )
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((s) => ({ ...s }));
}
