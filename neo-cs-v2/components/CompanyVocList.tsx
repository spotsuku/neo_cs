"use client";

// 企業カルテ用 VOC 一覧 (open のみ — new/triaged/backlog)
import { useEffect, useState } from "react";
import Link from "next/link";
import { vocItemRepo } from "@/lib/repository";
import type { VocItemRecord } from "@/lib/repository";
import { VOC_TAG_LABEL, type VocTag } from "@/lib/domain/voc";

const STATUS_LABEL: Record<VocItemRecord["status"], string> = {
  new: "新規",
  triaged: "トリアージ済",
  backlog: "バックログ",
  shipped: "リリース済",
  wontfix: "対応せず"
};

const PRIORITY_BADGE: Record<VocItemRecord["priority"], string> = {
  high: "bg-danger-50 text-danger-700 border-danger-100",
  med: "bg-warning-50 text-warning-700 border-warning-100",
  low: "bg-info-50 text-info-700 border-info-100"
};

export function CompanyVocList({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<VocItemRecord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    vocItemRepo
      .list({ companyId, status: ["new", "triaged", "backlog"] })
      .then((list) => {
        if (cancelled) return;
        setItems(list);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (!ready) {
    return <div className="text-caption text-neutral-500">VOC を読み込み中...</div>;
  }
  if (items.length === 0) {
    return (
      <div className="text-caption text-neutral-500">
        この企業の未処理 VOC はありません
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((v) => (
        <li
          key={v.id}
          className="rounded-md border border-neutral-100 bg-surface px-3 py-2 space-y-1"
        >
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className={`inline-flex px-2 py-0.5 rounded-pill border text-caption font-medium ${PRIORITY_BADGE[v.priority]}`}
              >
                {v.priority.toUpperCase()}
              </span>
              <span className="text-caption text-neutral-700">
                {STATUS_LABEL[v.status]}
              </span>
              <span className="text-caption text-neutral-400">
                {v.sourceType === "survey_response"
                  ? "サーベイ"
                  : v.sourceType === "meeting_log"
                  ? "面談"
                  : "週次"}
              </span>
            </div>
            <Link
              href={`/voc#${v.id}`}
              className="text-caption text-info-700 hover:underline focus-ring rounded-sm"
            >
              VOC で開く →
            </Link>
          </div>
          <p className="text-body text-neutral-900">{v.excerpt}</p>
          <div className="flex flex-wrap gap-1">
            {v.tags.map((t) => (
              <span
                key={t}
                className="inline-flex px-1.5 py-0.5 rounded-pill border border-neutral-300 bg-neutral-50 text-caption text-neutral-700"
              >
                {VOC_TAG_LABEL[t as VocTag] ?? t}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
