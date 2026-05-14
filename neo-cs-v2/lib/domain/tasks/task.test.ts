import { describe, it, expect } from "vitest";
import {
  isOverdue,
  isDueByToday,
  isDueByWeekEnd,
  canTransition,
  sortByDueAsc,
  endOfWeek
} from "./task";

describe("task domain", () => {
  describe("isOverdue", () => {
    it("過去日付かつ未着手なら true", () => {
      expect(isOverdue({ status: "pending", dueDate: "2026-04-20" }, "2026-04-24")).toBe(true);
    });
    it("完了済みなら false", () => {
      expect(isOverdue({ status: "done", dueDate: "2026-04-20" }, "2026-04-24")).toBe(false);
    });
    it("dueDate 無しなら false", () => {
      expect(isOverdue({ status: "pending" }, "2026-04-24")).toBe(false);
    });
    it("当日は overdue ではない", () => {
      expect(isOverdue({ status: "pending", dueDate: "2026-04-24" }, "2026-04-24")).toBe(false);
    });
  });

  describe("isDueByToday", () => {
    it("当日含めて期日切れ未満は true", () => {
      expect(isDueByToday({ status: "pending", dueDate: "2026-04-24" }, "2026-04-24")).toBe(true);
      expect(isDueByToday({ status: "pending", dueDate: "2026-04-23" }, "2026-04-24")).toBe(true);
    });
    it("未来は false", () => {
      expect(isDueByToday({ status: "pending", dueDate: "2026-04-25" }, "2026-04-24")).toBe(false);
    });
  });

  describe("isDueByWeekEnd", () => {
    it("週末以前は true", () => {
      expect(isDueByWeekEnd({ status: "pending", dueDate: "2026-04-26" }, "2026-04-26")).toBe(true);
    });
  });

  describe("canTransition", () => {
    it("pending → in_progress 許可", () => {
      expect(canTransition("pending", "in_progress")).toBe(true);
    });
    it("done → in_progress 不可", () => {
      expect(canTransition("done", "in_progress")).toBe(false);
    });
    it("done → pending 可 (再open)", () => {
      expect(canTransition("done", "pending")).toBe(true);
    });
    it("同一は false", () => {
      expect(canTransition("pending", "pending")).toBe(false);
    });
    it("cancelled → done 不可", () => {
      expect(canTransition("cancelled", "done")).toBe(false);
    });
  });

  describe("sortByDueAsc", () => {
    it("期日昇順、同期日は priority 高い順", () => {
      const list = [
        { dueDate: "2026-04-25", priority: "low" as const },
        { dueDate: "2026-04-20", priority: "med" as const },
        { dueDate: "2026-04-20", priority: "urgent" as const },
        { dueDate: undefined, priority: "high" as const }
      ];
      const sorted = sortByDueAsc(list);
      expect(sorted[0].dueDate).toBe("2026-04-20");
      expect(sorted[0].priority).toBe("urgent");
      expect(sorted[1].priority).toBe("med");
      expect(sorted[2].dueDate).toBe("2026-04-25");
      expect(sorted[3].dueDate).toBeUndefined();
    });
  });

  describe("endOfWeek", () => {
    it("土曜は当日を返す", () => {
      // 2026-04-25 は土曜
      expect(endOfWeek("2026-04-25")).toBe("2026-04-25");
    });
    it("月曜は次の土曜", () => {
      // 2026-04-20 月 → 2026-04-25 土
      expect(endOfWeek("2026-04-20")).toBe("2026-04-25");
    });
  });
});
