// user_gmail_connections (Mock 実装)

import type {
  GmailConnection,
  GmailConnectionRepo,
  GmailConnectionUpsertInput
} from "../types";

type State = { store: GmailConnection[]; counter: number };
const G = globalThis as unknown as { __gmailMock?: State };
if (!G.__gmailMock) G.__gmailMock = { store: [], counter: 1 };
const state = G.__gmailMock!;

export const mockGmailConnectionRepo: GmailConnectionRepo = {
  async getByUserId(userId) {
    const found = state.store.find((r) => r.userId === userId);
    return found ? { ...found } : null;
  },

  async upsert(input: GmailConnectionUpsertInput) {
    const existing = state.store.find((r) => r.userId === input.userId);
    if (existing) {
      Object.assign(existing, input);
      return { ...existing };
    }
    const row: GmailConnection = {
      ...input,
      id: `gmail-${state.counter++}`,
      connectedAt: new Date().toISOString()
    };
    state.store.push(row);
    return { ...row };
  },

  async updateSyncStatus(userId, patch) {
    const row = state.store.find((r) => r.userId === userId);
    if (!row) return;
    if (patch.lastSyncAt !== undefined) row.lastSyncAt = patch.lastSyncAt;
    if (patch.lastSyncStatus !== undefined) row.lastSyncStatus = patch.lastSyncStatus;
    if (patch.lastSyncNote !== undefined) row.lastSyncNote = patch.lastSyncNote;
    if (patch.accessToken !== undefined) row.accessToken = patch.accessToken;
    if (patch.accessTokenExpiresAt !== undefined)
      row.accessTokenExpiresAt = patch.accessTokenExpiresAt;
  },

  async delete(userId) {
    const idx = state.store.findIndex((r) => r.userId === userId);
    if (idx >= 0) state.store.splice(idx, 1);
  }
};
