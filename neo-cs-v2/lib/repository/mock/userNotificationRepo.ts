// user_notifications (Mock 実装)
// マイグレーション: supabase/migrations/0041_user_notifications.sql

import type {
  UserNotification,
  UserNotificationCreateInput,
  UserNotificationFilter,
  UserNotificationRepo
} from "../types";

type State = { store: UserNotification[]; counter: number };
const G = globalThis as unknown as { __notifMock?: State };
if (!G.__notifMock) G.__notifMock = { store: [], counter: 1 };
const state = G.__notifMock!;

function newId(): string {
  return `notif-${state.counter++}-${Math.random().toString(36).slice(2, 6)}`;
}

export const mockUserNotificationRepo: UserNotificationRepo = {
  async list(filter) {
    let rows = state.store.slice();
    if (filter.organizationId)
      rows = rows.filter((r) => r.organizationId === filter.organizationId);
    if (filter.userId)
      rows = rows.filter((r) => r.userId === filter.userId || r.userId === undefined);
    if (filter.category) rows = rows.filter((r) => r.category === filter.category);
    if (filter.unreadOnly) rows = rows.filter((r) => !r.readAt);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter.limit) rows = rows.slice(0, filter.limit);
    return rows.map((r) => ({ ...r }));
  },

  async create(input: UserNotificationCreateInput) {
    // dedup: 同じ (userId, sourceType, sourceId) があれば既存を返す
    if (input.userId && input.sourceType && input.sourceId) {
      const existing = state.store.find(
        (r) =>
          r.userId === input.userId &&
          r.sourceType === input.sourceType &&
          r.sourceId === input.sourceId
      );
      if (existing) return { ...existing };
    }
    const row: UserNotification = {
      ...input,
      id: newId(),
      createdAt: new Date().toISOString()
    };
    state.store.push(row);
    return { ...row };
  },

  async markRead(id, userId) {
    const row = state.store.find((r) => r.id === id);
    if (!row) return;
    if (row.userId && row.userId !== userId) return;
    row.readAt = new Date().toISOString();
  },

  async markAllRead(userId) {
    let n = 0;
    for (const r of state.store) {
      if (r.readAt) continue;
      if (r.userId && r.userId !== userId) continue;
      r.readAt = new Date().toISOString();
      n++;
    }
    return n;
  },

  async countUnread(userId) {
    return state.store.filter(
      (r) => !r.readAt && (r.userId === userId || r.userId === undefined)
    ).length;
  }
};

// テスト用: in-memory ストアの参照
export function _mockNotifStore(): UserNotification[] {
  return state.store;
}
