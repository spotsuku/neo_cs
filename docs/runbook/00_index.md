# Runbook 索引

本ディレクトリは障害対応・バックアップ・リストア・キーローテーション等の運用手順を集約します。

| ファイル | 内容 |
|---|---|
| [01_anthropic_key_rotation.md](01_anthropic_key_rotation.md) | ANTHROPIC_API_KEY のローテーション手順 |
| [02_supabase_backup_restore.md](02_supabase_backup_restore.md) | Supabase バックアップとリストア (PITR含む) |
| [03_incident_response.md](03_incident_response.md) | P0/P1 インシデントの初動・連絡・記録 |
| [04_user_offboarding.md](04_user_offboarding.md) | 退職者・契約終了時のアクセス遮断手順 |
| [05_csp_enforcement.md](05_csp_enforcement.md) | CSP Report-Only → enforce 昇格チェックリスト |
| [06_n_plus_1_audit.md](06_n_plus_1_audit.md) | Server Component の N+1 走査結果と回避規約 |
| [07_churn_notification.md](07_churn_notification.md) | 解約予兆 Slack 通知の運用・検証・dedup 進化計画 |
| [08_rollback.md](08_rollback.md) | デプロイ/DB/シークレット/Cron のロールバック手順 |
| [09_expansion_notification.md](09_expansion_notification.md) | エクスパンション機会 Slack 通知の運用・検証 |
| [10_integration_checklist.md](10_integration_checklist.md) | 中間統合確認チェックリスト + 3 Stage ロールアウト順序 |
| [11_voc_notification.md](11_voc_notification.md) | VOC (Voice of Customer) Slack 通知の運用・検証 |
| (12_audit_review.md) | 月次の audit_logs レビュー手順 (未整備) |

> 各ファイルは「いつ」「誰が」「どのコマンドで」「どこで成功確認するか」を明記。
> 未整備項目は `(stub)` 表記で残し、期日と担当を記す。
