'use client';

import { useState, useTransition } from 'react';
import type { ConsentItem } from '@/lib/consents/registry';
import { setConsent } from './actions';

export function ConsentRow({ item }: { item: ConsentItem }) {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggle(next: boolean) {
    setMessage(null);
    start(async () => {
      const res = await setConsent({
        subjectType: 'organization',
        subjectId: 'self',
        consentType: item.type,
        purposeText: item.purpose,
        granted: next,
      });
      if (res.ok) {
        setGranted(next);
        setMessage(next ? '同意を記録しました' : '撤回を記録しました');
      } else {
        setMessage(res.message ?? '記録に失敗しました');
      }
    });
  }

  return (
    <article className="liquid-surface p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-ink-900">{item.title}</h2>
            {item.required && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                必須
              </span>
            )}
            {item.externalTransfer && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                越境移転 / {item.externalTransfer.jurisdiction}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-600 leading-relaxed">{item.purpose}</p>
          {item.externalTransfer && (
            <p className="mt-1 text-[11px] text-ink-500">
              送信先: {item.externalTransfer.destination}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            type="button"
            disabled={pending}
            onClick={() => toggle(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
          >
            同意する
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => toggle(false)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-ink-200 text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            撤回する
          </button>
        </div>
      </div>
      {(message || granted !== null) && (
        <div className="text-[11px] text-ink-500">
          {granted === true ? '✅ 同意済み' : granted === false ? '↩ 撤回済み' : ''}
          {message ? ` — ${message}` : ''}
        </div>
      )}
    </article>
  );
}
