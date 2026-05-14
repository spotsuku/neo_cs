## 概要
<!-- 1〜2 行で「何を」「なぜ」 -->

## 触った範囲
- **Route Group**: <!-- (lifecycle) / (cohort) / (communication) / (relationship) / (analytics) / (self) / (admin) / (system) / 横断 -->
- **lib/**: <!-- domain/<area>, repository, integrations, ai, security, など -->
- **components/**: <!-- ui / company / contract / health / journey / kpi / etc -->
- **DB**: <!-- supabase/migrations/00XX を追加 / なし -->

## 関連する F1〜F7 機能
<!-- F1 オンボ / F2 コホート / F3 Gmail+AI / F4 Drive / F5 関係性 / F6 VoC / F7 アンケート / 横断 -->

## 並行 PR への影響
<!-- 他に走っている PR と競合する可能性。なければ「なし」 -->

## 検証
- [ ] `npm run typecheck` 通過
- [ ] `npm run lint` 通過
- [ ] `npm run test` 通過 (新規/変更ロジックにテスト追加)
- [ ] `SKIP_BUILD_ASSERT=1 npm run build` 通過
- [ ] UI 変更: mock データを **長文 / 空配列 / null** に差し替えて崩れない確認
- [ ] UI 変更: `REPO_DRIVER=supabase` で実 DB に接続した状態でも同じ見た目 (該当時)

## 不可逆アクション
- [ ] メール送信 / 契約変更 / 削除 などの不可逆操作は**人間のクリック + 確認ダイアログ**を介している (該当時)

## スクショ
<!-- UI 変更があれば前後比較 -->

## 補足
<!-- レビュアーに気をつけてほしい点、未解決の懸念、フォローアップ予定など -->
