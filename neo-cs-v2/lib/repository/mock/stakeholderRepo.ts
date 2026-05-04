import { stakeholders as seed } from "@/lib/mock/cycles";
import { DEFAULT_ORG_ID } from "../types";
import type { Stakeholder, StakeholderRepo, SetEngagementTierInput } from "../types";
import { runAfterWrite } from "../_base";

const store: Stakeholder[] = seed.map((s) => ({ ...s, organizationId: DEFAULT_ORG_ID }));

export const mockStakeholderRepo: StakeholderRepo = {
  async listByCompany(companyId) {
    return store.filter((s) => s.companyId === companyId).map((s) => ({ ...s }));
  },

  async list(filter) {
    return store
      .filter((s) => !filter?.organizationId || s.organizationId === filter.organizationId)
      .map((s) => ({ ...s }));
  },

  async setEngagementTier(id, input: SetEngagementTierInput) {
    const idx = store.findIndex((s) => s.id === id);
    if (idx < 0) throw new Error(`Stakeholder not found: ${id}`);
    const before = { ...store[idx] };
    const now = new Date().toISOString();
    if (input.tier === null) {
      store[idx] = {
        ...store[idx],
        engagementTier: null,
        engagementTierOverriddenBy: undefined,
        engagementTierOverriddenAt: undefined,
        engagementNote: input.note ?? store[idx].engagementNote
      };
    } else {
      store[idx] = {
        ...store[idx],
        engagementTier: input.tier,
        engagementTierOverriddenBy: input.actorUserId,
        engagementTierOverriddenAt: now,
        engagementNote: input.note
      };
    }
    const after = { ...store[idx] };
    await runAfterWrite({
      entityType: "stakeholders",
      entityId: id,
      before,
      after,
      action: "update",
      ctx: {
        actor: {
          userId: input.actorUserId ?? null,
          email: null,
          role: null,
          organizationId: store[idx].organizationId ?? null
        },
        request: { id: "mock", ip: null, userAgent: null }
      }
    });
    return after;
  }
};
