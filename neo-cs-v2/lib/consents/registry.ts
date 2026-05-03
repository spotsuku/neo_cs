/**
 * 同意項目レジストリ (法務/個情法/GDPR要件)
 *
 *  - terms_of_service     : 利用規約
 *  - privacy_policy       : プライバシーポリシー
 *  - anthropic_processing : Anthropic API への本文送信 (米国法人への越境)
 *  - ai_evaluation        : AI による自動評価 (異議申立フォーム連携)
 *
 * policy_version は更新の度に手で上げる (例: 2026-05-03)。
 * バージョンが変わると過去同意は失効扱いとし、再同意を促す。
 */

export const CURRENT_POLICY_VERSION = '2026-05-03';

export interface ConsentItem {
  type: string;
  title: string;
  purpose: string;
  required: boolean;
  externalTransfer?: { destination: string; jurisdiction: string };
}

export const CONSENT_ITEMS: ConsentItem[] = [
  {
    type: 'terms_of_service',
    title: '利用規約への同意',
    purpose: 'NEO CSポータルの利用にあたり、利用規約の内容に同意いただきます。',
    required: true,
  },
  {
    type: 'privacy_policy',
    title: 'プライバシーポリシーへの同意',
    purpose: '個人情報の取扱方針 (利用目的、保管期間、第三者提供、開示請求) に同意いただきます。',
    required: true,
  },
  {
    type: 'anthropic_processing',
    title: 'Anthropic API への本文送信同意 (越境移転)',
    purpose:
      'メール本文・面談メモの要約等に Anthropic 社 (米国) のAPIを利用するため、当該データを米国法人へ送信することに同意いただきます。',
    required: false,
    externalTransfer: { destination: 'Anthropic, PBC', jurisdiction: 'US' },
  },
  {
    type: 'ai_evaluation',
    title: 'AI による自動評価への同意',
    purpose:
      'CS活動データに基づく解約予兆スコア・健全性スコア等の自動評価を実施します。評価結果には異議申立が可能です。',
    required: false,
  },
];
