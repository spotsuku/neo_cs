# VOC タグ辞書 運用ドキュメント

ストリーム02 H項 (`lib/domain/voc.ts`) のキーワード辞書とタグ分類の運用ガイド。
CS担当者が「VOCがうまく拾われない」「逆に拾いすぎる」と感じたときの調整手順。

## 全体像

```
ユーザの自由記述 (アンケート/面談メモ/週次のmore等)
        │
        ▼
extractVocCandidates(inputs)
        │
        ├── REQUEST_KEYWORDS でフィルタ (要望っぽい発言だけ残す)
        │
        ├── inferTags(text) で VocTag を1つ以上付ける
        │
        └── pickExcerpt(text, keyword) で抜粋を切り出し
                │
                ▼
        VocCandidate { excerpt, suggestedTags[], matchedKeywords[] }
```

辞書は `lib/domain/voc.ts` の以下の定数で完結:
- `REQUEST_KEYWORDS` (発火フィルタ)
- `TAG_KEYWORDS` (タグ分類)
- `SENTENCE_MAX` (抜粋の最大長)

## 1. REQUEST_KEYWORDS (発火フィルタ)

このリストのいずれかが本文に含まれた場合のみ「要望候補」として扱う。
**1語でもマッチすれば発火**するので、語彙を増やすほど検知が広く・浅くなる。

| 現行キーワード | 想定する発言 |
|---|---|
| してほしい / して欲しい / してほしかった | "対応してほしい" "返信してほしかった" |
| があれば / が欲しい / があると | "ダッシュボードがあれば嬉しい" |
| を追加 / を導入 | "Slack連携を追加してほしい" |
| が不便 / やりにくい / わかりにくい | "画面遷移がやりにくい" |
| 改善 / 拡張 | "UIを改善" "機能拡張" |
| 対応してほしい | (明示的な要望) |
| あったら嬉しい | "夜間サポートあったら嬉しい" |
| オプション / オプションで | "オプションで料金プラン" |
| 機能を | "管理機能を増やしたい" |

### 拡張する判断基準

**追加していい語**:
- CSが「あ、これ拾い損ねてる」と複数回感じた語彙
- 業界・顧客特有の言い回し (例: 教育系なら「カリキュラムに〜あれば」)

**追加してはいけない語**:
- 「〜だ」「〜です」のような汎用すぎる述語 → 要望でない発言まで拾う
- 「便利」「いい」のような単独ポジティブ語 → ノイズになる
- 否定語と紛らわしい語 (「あった」だけ → 過去形と混同)

### 縮小する判断基準

通知が多すぎる / トリアージが追いつかない場合は、以下を優先削除:
1. 単独で意味が薄い語 (例: 「機能を」のように後ろがないと意味不明な語)
2. ポジティブ表現 (「〜があると嬉しい」は要望弱め、「〜してほしい」は要望強め)

## 2. TAG_KEYWORDS (タグ分類辞書)

`VocTag` ごとにキーワード配列を持ち、本文に1語でも含まれていればそのタグが付く。
複数タグの併用は許容 (例: 「Slack連携の機能を追加」→ `integration` + `feature_request`)。
どのタグにもマッチしなければ `other` が付く。

| VocTag | 表示ラベル | 現行キーワード | 想定 |
|---|---|---|---|
| `feature_request` | 機能要望 | 機能 / 機能を / を追加 / を導入 | 純粋な機能追加要望 |
| `ui_improvement` | UI改善 | UI / 画面 / 見た目 / わかりにくい / 操作 / やりにくい | UX改善 |
| `content_request` | コンテンツ要望 | コンテンツ / 教材 / 資料 / 動画 / 事例 / ケーススタディ | 教材追加・拡充 |
| `scheduling` | 日程・運用 | 日程 / 時間帯 / 夜 / 土日 / オンライン / リスケ | 開催日・運用ルール |
| `pricing` | 価格・プラン | 価格 / 値段 / 費用 / 料金 / プラン / 見積 | 価格交渉・プラン要望 |
| `integration` | 連携 | 連携 / API / Slack / Salesforce / freee / Notion | 外部システム連携 |
| `bug_report` | 不具合報告 | バグ / 不具合 / 動かない / エラー / 落ちる | バグ申告 |
| `other` | その他 | (該当なし時の fallback) | — |

### タグを増やす場合のチェックリスト

1. `lib/domain/voc.ts` の `VocTag` 型に新タグを追加
2. `VOC_TAG_LABEL` (型側) と `TAG_KEYWORDS` (辞書) の両方に追加
3. UI 側 (`app/voc/VocBoard.tsx`、`components/CompanyVocList.tsx` 等) は `VOC_TAG_LABEL` を参照しているので自動で表示される (新規UIコード変更不要)
4. テストデータで自動分類が期待通りか確認 (mock seed でも `extractVocCandidates` が正しいタグを付けるか)

### キーワードの粒度

**良い粒度**:
- 業務語 (Salesforce、Slack、教材、カリキュラム): タグが明確に分かれる
- 動詞・形容詞 (やりにくい、わかりにくい): UI問題を素直に拾う

**悪い粒度**:
- 助詞・助動詞 (の、を、が): 全文にマッチして無意味
- 一般語 (使う、見る): どのタグにも紐付かない

## 3. 運用シナリオ別 調整方法

### シナリオA: 「サーベイで〇〇って言ってたのに VOC に出てこない」

1. その発言文を `lib/domain/voc.ts` の `REQUEST_KEYWORDS` の語彙と突き合わせる
2. どの語にもヒットしないなら、その発言の中核キーワードを `REQUEST_KEYWORDS` に追加候補
3. `git diff lib/domain/voc.ts` で他キーワードへの影響を確認
4. mock seed の他レコードで誤検知 (false positive) が増えないかを `npx next build && /voc` 目視で確認

### シナリオB: 「VOCにノイズが多い」

1. `/voc` の `new` タブを眺め、「これは要望ではない」発言を観察
2. その発言が hit している `matchedKeywords` を逆引き (mock seed の seed inputs で確認)
3. その語が必要な発言と不要な発言の両方を hit させているなら、**より specific な語** に置換 (例: 「あれば」→「があれば」)
4. 単独ポジティブ語 (「便利」「いい」など) は削除

### シナリオC: 「タグが `other` ばかりついて分類されない」

1. 該当 VOC の本文を確認し、キーワード辞書の各タグ行と突き合わせる
2. 業務固有の語彙 (例: NEO ACADEMIA 特有の「評議会」など) を該当タグに追加
3. 同じ語が複数タグで競合する場合、最も適切なタグだけに残す (タグは多すぎると見にくい)

### シナリオD: 「priority=high のものだけ Slack で通知したい」

これは辞書ではなく `lib/notifications/voc.ts` 側の `dispatchPendingVocNotifications` が
priority="high" + unNotifiedOnly でフィルタ済 (実装済)。
priority は `VocBoard.tsx` のセレクトでマネージャーが手動で上げる前提。

将来 `extractVocCandidates` の戻り値に priority 候補を含めて自動付与する場合は、
`lib/domain/voc.ts` に `inferPriority(text, matchedKeywords)` 関数を追加 (例: `バグ`/`動かない`/`不具合` → high)。

## 4. 将来移行 (Anthropic API でセマンティック分類)

mock 時代はキーワード辞書ベース。Supabase 移行 + AI予算が用意できた時点で:

```ts
// lib/domain/voc.ts の extractVocCandidates を差し替え
// I/O 互換のまま、内部実装だけ Anthropic API 呼び出しに
async function extractVocCandidates(
  inputs: VocSourceTextInput[],
  asOf: string = ...
): Promise<VocCandidate[]> {
  // Anthropic に「以下の発言から要望を抽出してJSONで返して」と投げる
  // タグも `VocTag` enum で返してもらう
}
```

呼び出し側 (`mockVocItemRepo` の seed、`VocScanButton` のプレビュー) はインターフェース不変なので変更不要。

辞書は引き続き「pre-filter」として残し、Anthropic 呼び出しコストを下げる役割に縮小:
1. `isLikelyVoc(text)` で粗くフィルタ (キーワード一致のみ)
2. 残ったテキストだけ Anthropic に投げて精度の高い分類

## 5. テスト方法 (将来)

`lib/domain/voc.ts` に対する Vitest テストを追加するなら:

```ts
// lib/domain/voc.test.ts (将来)
describe("extractVocCandidates", () => {
  it("REQUEST_KEYWORDS にヒットするテキストは候補に出る", () => {
    const out = extractVocCandidates([
      { sourceType: "survey_response", sourceId: "s1",
        text: "Slack連携を追加してほしい" }
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].suggestedTags).toContain("integration");
    expect(out[0].suggestedTags).toContain("feature_request");
  });

  it("キーワードが無ければ候補に出ない", () => {
    const out = extractVocCandidates([
      { sourceType: "meeting_log", sourceId: "m1",
        text: "今日は天気がよかったです" }
    ]);
    expect(out).toEqual([]);
  });

  it("excerpt が SENTENCE_MAX を超えない", () => {
    const long = "あ".repeat(500) + "を追加してほしい";
    const out = extractVocCandidates([
      { sourceType: "weekly_review", sourceId: "w1", text: long }
    ]);
    expect(out[0].excerpt.length).toBeLessThanOrEqual(141); // 140 + "…"
  });
});
```

これはストリーム04 のテスト基盤 (Vitest setup) に乗せる前提なので、04 側の `tests/` 配置と整合してから追加する。

## 参考

- 純関数本体: [`lib/domain/voc.ts`](../neo-cs-v2/lib/domain/voc.ts)
- mock seed: [`lib/repository/mock/vocItemRepo.ts`](../neo-cs-v2/lib/repository/mock/vocItemRepo.ts)
- Slack通知: [`lib/notifications/voc.ts`](../neo-cs-v2/lib/notifications/voc.ts)
- 完了報告 H 項: [`roadmap/02_機能改修_完了報告.md`](../roadmap/02_機能改修_完了報告.md)
