"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { Company } from "@/lib/mock/entities";
import { useActiveMembers } from "@/lib/hooks/useActiveMembers";
import { updateCompanyBasicInfoAction } from "./edit-actions";
import { DomainChipInput } from "./DomainChipInput";

const LOGO_MAX_BYTES = 1_000_000; // 1MB

export function CompanyEditDialog({
  company,
  onClose
}: {
  company: Company;
  onClose: () => void;
}) {
  const { members, ready: membersReady } = useActiveMembers();
  const [name, setName] = useState(company.name);
  const [kana, setKana] = useState(company.kana ?? "");
  const [industry, setIndustry] = useState(company.industry);
  const [address, setAddress] = useState(company.address ?? "");
  const [ownerName, setOwnerName] = useState(company.ownerName);
  const [driveFolderUrl, setDriveFolderUrl] = useState(company.driveFolderUrl ?? "");
  const [logoUrl, setLogoUrl] = useState(company.logoUrl ?? "");
  const [memo, setMemo] = useState(company.memo ?? "");
  // Gmail 連携用ドメイン: chip 入力で配列管理 (重複・形式不正は DomainChipInput 側で即時拒否)
  const [domains, setDomains] = useState<string[]>(company.domains ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setMounted(true), []);

  const handleLogoFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError(`画像サイズが大きすぎます (1MB以内 / 現在 ${(file.size / 1024).toFixed(0)}KB)`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") setLogoUrl(result);
    };
    reader.onerror = () => setError("画像の読み込みに失敗しました");
    reader.readAsDataURL(file);
  };

  if (!mounted) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateCompanyBasicInfoAction({
        companyId: company.id,
        patch: {
          name,
          kana,
          industry,
          address,
          ownerName,
          driveFolderUrl,
          logoUrl,
          memo,
          domains
        }
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onClose();
    });
  };

  const inputCls =
    "mt-0.5 w-full rounded-lg border border-ink-200 px-2 py-1 text-sm focus:outline-hidden focus:border-ink-400";

  return createPortal(
    <div
      className="fixed inset-0 z-100 bg-ink-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between sticky top-0 -mt-1 pt-1 bg-white">
          <div>
            <div className="text-xs text-ink-500">企業情報を編集</div>
            <div className="text-lg font-semibold text-ink-900">{company.name}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-700 text-lg leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {/* 基本情報 */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-ink-700">基本情報</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[11px] text-ink-500 col-span-2">
              企業名 <span className="text-rose-500">*</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputCls}
              />
            </label>
            <label className="block text-[11px] text-ink-500 col-span-2">
              カナ
              <input
                type="text"
                value={kana}
                onChange={(e) => setKana(e.target.value)}
                placeholder="かぶしきがいしゃ..."
                className={inputCls}
              />
            </label>
            <label className="block text-[11px] text-ink-500 col-span-2">
              業種 <span className="text-rose-500">*</span>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                required
                className={inputCls}
              />
            </label>
            <label className="block text-[11px] text-ink-500 col-span-2">
              所在地
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block text-[11px] text-ink-500 col-span-2">
              CS担当者
              <select
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                disabled={!membersReady}
                className={inputCls}
              >
                <option value="">未割当</option>
                {/* 既存値が members に無い場合も保持できるようフォールバックを追加 */}
                {ownerName &&
                  !members.some((m) => m.name === ownerName) && (
                    <option value={ownerName}>{ownerName}</option>
                  )}
                {members.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* 連携リソース */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-ink-700">連携リソース</div>
          <div className="space-y-2">
            <div className="block text-[11px] text-ink-500">
              対応メールドメイン
              <DomainChipInput
                value={domains}
                onChange={setDomains}
                placeholder="例: example.co.jp"
              />
              <span className="block mt-0.5 text-[10px] text-ink-400">
                Gmail 連携の自動企業マッピングに使用します。Enter / カンマ / 空白で確定。
                登録されていない送信元でも、ここに登録のあるドメインから来た場合は同社の担当者として追加提案します。
              </span>
            </div>
            <label className="block text-[11px] text-ink-500">
              共有Drive URL
              <input
                type="url"
                value={driveFolderUrl}
                onChange={(e) => setDriveFolderUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className={inputCls}
              />
              <span className="block mt-0.5 text-[10px] text-ink-400">
                内諾後に自動生成される共有フォルダURL。手動で差し替えも可能です。
              </span>
            </label>
            <div className="block text-[11px] text-ink-500">
              ロゴ画像
              <div className="mt-1 flex items-start gap-3">
                <div className="w-16 h-16 rounded-lg border border-ink-200 bg-ink-50 flex items-center justify-center overflow-hidden shrink-0">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt="ロゴプレビュー"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-ink-400">未設定</span>
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 rounded-full bg-white border border-ink-200 text-xs text-ink-700 hover:bg-ink-50"
                    >
                      画像をアップロード
                    </button>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoUrl("");
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="text-[11px] text-rose-600 hover:underline"
                      >
                        削除
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleLogoFile(f);
                    }}
                  />
                  <input
                    type="url"
                    value={logoUrl.startsWith("data:") ? "" : logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="または画像URLを直接入力 (https://...)"
                    className={inputCls}
                  />
                  <span className="block text-[10px] text-ink-400">
                    PNG / JPEG / SVG など。1MB以内推奨。
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* メモ */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-ink-700">メモ</div>
          <label className="block text-[11px] text-ink-500">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              placeholder={
                "法人番号 / 従業員規模 / Webサイト / 設立年 など、構造化フィールドが無い情報はここに記録できます。"
              }
              className={`${inputCls} resize-y`}
            />
          </label>
        </div>

        {error && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-2 py-1.5">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-3 py-1.5 rounded-full bg-white border border-ink-200 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={pending}
            className="px-3 py-1.5 rounded-full bg-ink-900 text-white text-xs hover:bg-ink-800 disabled:opacity-50"
          >
            {pending ? "保存中…" : "保存"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
