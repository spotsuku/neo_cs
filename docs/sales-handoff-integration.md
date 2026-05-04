# 営業 (neo-sales) → CS (neo-cs) 引継ぎ連携 — 実装設計

最終更新: 2026-05-03 (Phase4-#6)

---

## 1. 連携方針 (確定)

**方針A: Webhook プッシュ (採用)**

- neo-sales 側で「内諾」相当の状態遷移をフックして neo-cs に POST する
- neo-cs 側は受信エンドポイント `/api/integrations/sales/handoff` を稼働済 (本タスクで実装)
- 認証: Bearer トークン (両プロジェクトで共通の secret)

将来 (方針B): neo-cs から定期 pull は今回スコープ外。

---

## 2. neo-sales 側の現状調査

### 2-1. スキーマ (`prisma/schema.prisma`)

- DB は **Postgres** (Prisma + Supabase 想定)。タスク当初の SQLite 想定は更新済
- 主要モデル:
  - `Company` — 顧客企業 (id=cuid)
  - `CompanyProgramDeal` — 案件本体。`status` (text), `priority`, `owner`, `forecastAmount`, `agreedValueOwner/Decider/Effort/Amount/Timing` 等
  - `Contact` — 企業内キーパーソン (`role: decision_maker|executive|contact|other`)
  - `User` — 営業メンバー
  - `Program` — プロダクト (アカデミア/評議会など)
  - `StatusChangeLog` — `entityType='deal'` の status 遷移を記録

### 2-2. 「内諾」を表す状態

スキーマには `CompanyProgramDeal.status` が `text` で定義されているが、**ENUM 値として "内諾" を直接表すものは未確認**。アプリ側で以下のいずれかが想定される:

| 候補 | 判定条件 | 備考 |
|---|---|---|
| (a) `status='accepted'` (or `'won'`/`'closed_won'`) | StatusChangeLog の `toStatus` を hook | アプリ側コード調査が追加で必要 |
| (b) `agreedValueOwner && agreedValueDecider && agreedAmount && agreedTiming` がすべて true | 4合意フラグ揃った瞬間 = 内諾 | スキーマだけで判別可能 |
| (c) `contractDate is not null` | 契約締結日が入った時点 | 内諾より遅い (締結後)。CS 着手は早めたい |

**推奨**: (b) を一次トリガ、(a) を二次補強とする。確定の合意フラグ4種が揃った遷移を内諾と定義。

---

## 3. neo-sales 側に追加する変更案 (未コミット)

> ※ 本タスクでは neo-sales 側に **コミットしない**。下記コードは設計スケッチ。
>   実装する場合は neo-sales リポジトリで別 PR を切る。

### 3-1. 環境変数 (`.env`)

```
NEO_CS_HANDOFF_URL=https://cs.neoacademia.jp/api/integrations/sales/handoff
NEO_CS_HANDOFF_SECRET=<neo-cs 側 SALES_HANDOFF_SECRET と同値>
```

### 3-2. `src/lib/integrations/cs-handoff.ts` (新設)

```ts
import "server-only";
import type { CompanyProgramDeal, Company, Contact, Program, User } from "@prisma/client";

interface HandoffSource {
  deal: CompanyProgramDeal;
  company: Company;
  primaryContact: Contact | null;
  program: Program;
  ownerUser: User | null;
}

const PRODUCT_CODE_BY_PROGRAM_NAME: Record<string, "academia" | "hyogikai" | "aiken" | "commu"> = {
  "アカデミア": "academia",
  "評議会": "hyogikai",
  "AI研": "aiken",
  "コミュ": "commu",
};

export async function dispatchCsHandoff(s: HandoffSource): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = process.env.NEO_CS_HANDOFF_URL;
  const secret = process.env.NEO_CS_HANDOFF_SECRET;
  if (!url || !secret) return { ok: false, status: 0, body: { skipped: "not_configured" } };

  const productCode = PRODUCT_CODE_BY_PROGRAM_NAME[s.program.name] ?? "academia";

  const payload = {
    salesDealId: s.deal.id,
    company: {
      name: s.company.name,
      industry: s.company.industry ?? null,
      size: s.company.employeeSize ?? null,
      website: s.company.website ?? null,
    },
    primaryContact: {
      name: s.primaryContact?.name ?? "(未設定)",
      email: s.primaryContact?.email ?? null,
      role: s.primaryContact?.title ?? null,
      phone: s.primaryContact?.phone ?? null,
    },
    contract: {
      productCode,
      courseCode: null,
      startDate: (s.deal.contractDate ?? s.deal.contractTargetDate ?? new Date()).toISOString().slice(0, 10),
      termMonths: 12,
      amountJpy: s.deal.forecastAmount ?? s.deal.actualAmount ?? null,
    },
    salesOwner: { email: s.ownerUser?.email ?? null },
    notes: s.deal.proposalNote ?? s.deal.issueNote ?? null,
    occurredAt: new Date().toISOString(),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
      "Idempotency-Key": s.deal.id,
    },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => null) };
}
```

### 3-3. 内諾検出フックの設置場所

deal 更新を担う Server Action / API Route で、4合意フラグの遷移を検出して呼び出す:

```ts
// 例: src/app/deals/[id]/actions.ts
import { dispatchCsHandoff } from "@/lib/integrations/cs-handoff";

export async function updateDeal(id: string, patch: ...) {
  const before = await prisma.companyProgramDeal.findUniqueOrThrow({ where: { id } });
  const after = await prisma.companyProgramDeal.update({ where: { id }, data: patch });
  const wasAgreed = before.agreedValueOwner && before.agreedValueDecider && before.agreedAmount && before.agreedTiming;
  const isAgreed  =  after.agreedValueOwner &&  after.agreedValueDecider &&  after.agreedAmount &&  after.agreedTiming;
  if (!wasAgreed && isAgreed) {
    // fire-and-forget。失敗は StatusChangeLog 等に記録しても良い
    void dispatchCsHandoff({
      deal: after,
      company: await prisma.company.findUniqueOrThrow({ where: { id: after.companyId } }),
      primaryContact: await prisma.contact.findFirst({ where: { companyId: after.companyId, role: "decision_maker" } }),
      program: await prisma.program.findUniqueOrThrow({ where: { id: after.programId } }),
      ownerUser: after.owner ? await prisma.user.findFirst({ where: { name: after.owner } }) : null,
    }).catch(console.error);
  }
  return after;
}
```

### 3-4. リトライ / 失敗時挙動

- neo-sales 側は **fire-and-forget** で投げる (UX を阻害しない)
- 失敗時のリトライは neo-cs の `sales_handoffs` テーブルから手動再送 or
  neo-sales 側に `outbox` テーブルを切って async worker から retry する設計が将来案
- neo-cs 側は同 `salesDealId` の二重受信を DB UNIQUE で安全に弾くため、
  neo-sales が二重送信しても副作用は無い

---

## 4. 検証チェックリスト (両側統合)

- [ ] neo-cs で `/api/integrations/sales/handoff` が curl で 200 を返す (本タスクで完了)
- [ ] neo-cs `/sales-handoff` UI に履歴が出る
- [ ] neo-sales 側で `dispatchCsHandoff` を実装
- [ ] dev 環境で内諾フラグを立てて → neo-cs UI に企業/契約が現れることを確認
- [ ] Slack #cs-handoff に通知が届くことを確認
- [ ] 同じ deal を再度内諾化 → 重複が弾かれることを確認 (`status='duplicate'`)

---

## 5. オープン課題

1. **productCode マッピング**: neo-sales `Program.name` が「アカデミア」等の日本語テキストに依存。
   将来は `Program.productCode` を Prisma に追加して厳密化したい。
2. **courseCode**: 現状 null 固定。CS 側 UI で手動補完。
3. **primaryContact 自動選定ロジック**: 上記サンプルは `role='decision_maker'` 1件目を取っているが、
   複数いる場合や役職基準を要相談。
4. **Drive 自動作成**: Phase4-#5 で `sales_handoffs.drive_folder_url` を埋める非同期ジョブを追加予定。
