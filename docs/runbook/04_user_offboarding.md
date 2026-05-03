# 退職者・契約終了時のアクセス遮断手順

**目的**: 退職者・部署異動者・委託契約終了者の本番アクセスを **退職当日中** に遮断し、引継ぎ漏れによる事故とコンプライアンス違反 (個情法・SOC2相当) を防ぐ。
**実行者**: 情シス + 該当者の上長。
**対象**: NEO CSポータルへのログインアクセスを持つ全アカウント (社員・業務委託・インターン)。

---

## 1. トリガと SLA

| トリガ | 受信元 | 遮断 SLA |
|---|---|---|
| 退職届受理 | 人事 → 情シス Slack | **最終出社日の業務時間内** (1日以上の前倒し可) |
| 即日退職 / 解雇 | 人事 → 情シス 直接 (電話) | **30分以内** |
| 業務委託契約終了 | 契約管理者 → 情シス | 契約最終日の翌営業日 9:00 まで |
| 部署異動で本ポータル不要 | 上長 → 情シス | 5営業日以内 |
| 退職者の権限残存を検知 (月次監査) | `audit_logs` 月次レビュー | 検知当日 |

---

## 2. 遮断手順 (チェックリスト)

### Phase A — 本人通告前 / 当日朝に静かに準備

- [ ] 対象者の `app_users.id` を確定
  ```sql
  select id, email, role, last_seen_at, organization_id
    from app_users where email = '<対象>';
  ```
- [ ] 担当顧客の **引継ぎ先**を確定 (上長と合意)
  ```sql
  -- 担当している company / contract / weekly_review の一覧
  select 'company' kind, id, name from companies where owner_user_id = '<id>'
   union all
  select 'contract', id::text, course_key from contracts where owner_user_id = '<id>'
   union all
  select 'weekly',   id::text, week_label from weekly_reviews where author_user_id = '<id>';
  ```

### Phase B — アクセス遮断 (退職時刻ジャスト)

- [ ] **app_users 無効化** (RLS的にこの瞬間から全画面アクセス不可)
  ```sql
  update app_users
     set is_active   = false,
         disabled_at = now(),
         role        = 'viewer'   -- フォールバックでも何も書けない
   where id = '<id>';
  ```
- [ ] **既存セッション失効** (Supabase Admin API)
  ```sh
  # service_role key で実行
  curl -X POST "$SUPABASE_URL/auth/v1/admin/users/<id>/logout" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
  ```
- [ ] **Google OAuth 側のセッション切断** (Workspace 管理コンソール → ユーザー → 全セッションサインアウト)
- [ ] **API トークン / 個人発行キー の失効** (該当者がいる場合のみ)
  - 個人 PAT / Vercel personal token / GitHub Actions secret に対象者個人のものがあれば revoke

### Phase C — 担当の引継ぎ (遮断と同じ日に完了)

- [ ] 担当顧客の `owner_user_id` を引継ぎ先へ更新
  ```sql
  begin;
    update companies      set owner_user_id  = '<succ>' where owner_user_id = '<id>';
    update contracts      set owner_user_id  = '<succ>' where owner_user_id = '<id>';
    update weekly_reviews set author_user_id = '<succ>' where author_user_id = '<id>'
       and updated_at > now() - interval '90 days';   -- 古い著者は履歴として保持
  commit;
  ```
  → 上記は **必ず audit_logs に source='migration', reason='offboarding_<id>'** で残す (DBトリガで自動記録、別途 `recordAudit` ヘルパからアプリ層でも記録)
- [ ] 担当変更を Slack `#cs-team` に投稿
- [ ] 顧客側に担当変更通知が必要なら Comms へ依頼

### Phase D — データの取り扱い (法務確認)

- [ ] 退職者個人のメモ・下書き (`drafts` テーブル) は **本人の業務遂行上のものに限り 30日後自動削除**、それ以外 (顧客対応に必要) は引継ぎ先へ移管
  ```sql
  update drafts set expires_at = now() + interval '30 days'
   where owner_user_id = '<id>';
  ```
- [ ] 退職者が起こしたアクションは **audit_logs に永続保持** (改ざん不可)
- [ ] 個人情報の開示請求が来た場合の手順は法務 Runbook (未整備) を参照

---

## 3. 月次監査 (オフボーディング漏れ検出)

毎月1日に下記を実行し、Slack `#cs-alerts` に投稿:

```sql
-- 90日ログインなしのアクティブユーザー
select id, email, role, last_seen_at
  from app_users
 where is_active = true
   and (last_seen_at is null or last_seen_at < now() - interval '90 days')
 order by last_seen_at nulls first;

-- 担当を持っているのに無効化されたユーザー (引継ぎ漏れ)
select u.id, u.email, count(c.id) orphan_companies
  from app_users u
  left join companies c on c.owner_user_id = u.id
 where u.is_active = false
 group by u.id, u.email
having count(c.id) > 0;
```

**孤児リソースが1件でも残っていたら即時是正**。

---

## 4. 失敗時のロールバック

- 「人違いで遮断してしまった」場合のみ:
  ```sql
  update app_users
     set is_active   = true,
         disabled_at = null,
         role        = '<元のrole>'   -- 復元する元の role を必ず確認
   where id = '<id>';
  ```
- 引継ぎ更新の取消は audit_logs.before_data から手動復元 (自動ロールバックは無い)

---

## 5. 関連

- [00_index.md](00_index.md)
- [03_incident_response.md](03_incident_response.md)
- ストリーム04 G項 (`roadmap/04_運用セキュリティ.md`)
