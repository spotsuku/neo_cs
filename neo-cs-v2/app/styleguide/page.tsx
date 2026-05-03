import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "スタイルガイド | NEO CS",
  description: "デザイントークンとコンポーネント見本"
};

// このページは新画面を書くときの参照ページ。
// 表示されるトークンとコンポーネントだけを使うこと。raw hex / text-[10|11px] は禁止。

// Tailwind は動的クラス名を解析できないので、literal で列挙する。
const SemanticSwatches: { name: string; entries: { cls: string; label: string }[] }[] = [
  {
    name: "success",
    entries: [
      { cls: "bg-success-50",  label: "success-50" },
      { cls: "bg-success-100", label: "success-100" },
      { cls: "bg-success-500", label: "success-500" },
      { cls: "bg-success-600", label: "success-600" },
      { cls: "bg-success-700", label: "success-700" }
    ]
  },
  {
    name: "warning",
    entries: [
      { cls: "bg-warning-50",  label: "warning-50" },
      { cls: "bg-warning-100", label: "warning-100" },
      { cls: "bg-warning-500", label: "warning-500" },
      { cls: "bg-warning-600", label: "warning-600" },
      { cls: "bg-warning-700", label: "warning-700" }
    ]
  },
  {
    name: "danger",
    entries: [
      { cls: "bg-danger-50",  label: "danger-50" },
      { cls: "bg-danger-100", label: "danger-100" },
      { cls: "bg-danger-500", label: "danger-500" },
      { cls: "bg-danger-600", label: "danger-600" },
      { cls: "bg-danger-700", label: "danger-700" }
    ]
  },
  {
    name: "info",
    entries: [
      { cls: "bg-info-50",  label: "info-50" },
      { cls: "bg-info-100", label: "info-100" },
      { cls: "bg-info-500", label: "info-500" },
      { cls: "bg-info-600", label: "info-600" },
      { cls: "bg-info-700", label: "info-700" }
    ]
  },
  {
    name: "neutral (= ink エイリアス)",
    entries: [
      { cls: "bg-neutral-50",  label: "neutral-50" },
      { cls: "bg-neutral-100", label: "neutral-100" },
      { cls: "bg-neutral-300", label: "neutral-300" },
      { cls: "bg-neutral-500", label: "neutral-500" },
      { cls: "bg-neutral-700", label: "neutral-700" },
      { cls: "bg-neutral-900", label: "neutral-900" }
    ]
  }
];

const BrandSwatches = [
  { cls: "bg-brand-pink",   label: "brand-pink" },
  { cls: "bg-brand-orange", label: "brand-orange" },
  { cls: "bg-brand-yellow", label: "brand-yellow" },
  { cls: "bg-brand-green",  label: "brand-green" },
  { cls: "bg-brand-blue",   label: "brand-blue" },
  { cls: "bg-brand-purple", label: "brand-purple" }
];

const ProductSwatches = [
  { cls: "bg-product-academia", label: "product-academia" },
  { cls: "bg-product-hyogikai", label: "product-hyogikai" },
  { cls: "bg-product-aiken",    label: "product-aiken" },
  { cls: "bg-product-commu",    label: "product-commu" }
];

const FontSamples = [
  { cls: "text-metric font-bold",   label: "metric (28px)", note: "KPI数値" },
  { cls: "text-h1 font-bold",       label: "h1 (24px)",     note: "ページタイトル" },
  { cls: "text-h2 font-semibold",   label: "h2 (20px)",     note: "セクション" },
  { cls: "text-h3 font-semibold",   label: "h3 (18px)",     note: "サブセクション" },
  { cls: "text-h4 font-semibold",   label: "h4 (16px)",     note: "カード見出し" },
  { cls: "text-bodyLg",             label: "bodyLg (15px)", note: "本文・強調" },
  { cls: "text-body",               label: "body (14px)",   note: "本文・標準" },
  { cls: "text-caption text-ink-500", label: "caption (12px)", note: "補助・最小ライン" }
];

const Radii = [
  { cls: "rounded-sm",      label: "sm (4px)" },
  { cls: "rounded-md",      label: "md (8px)" },
  { cls: "rounded-lg",      label: "lg (12px)" },
  { cls: "rounded-xl",      label: "xl (16px)" },
  { cls: "rounded-surface", label: "surface (20px)" },
  { cls: "rounded-pill",    label: "pill (full)" }
];

const Shadows = [
  { cls: "shadow-card",      label: "card",      note: "通常カード" },
  { cls: "shadow-cardHover", label: "cardHover", note: "ホバー昇格" }
];

const Spacings = [1, 2, 3, 4, 6, 8, 12, 16];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="surface p-6 space-y-4">
      <header className="space-y-1">
        <h2 className="text-h2">{title}</h2>
        {hint ? <p className="text-caption text-ink-500">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Swatch({ bg, label, sub }: { bg: string; label: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className={`h-12 rounded-md border border-ink-100 ${bg}`} />
      <div className="text-caption text-ink-700">{label}</div>
      {sub ? <div className="text-caption text-ink-500">{sub}</div> : null}
    </div>
  );
}

export default function StyleguidePage() {
  return (
    <main id="main" className="mx-auto max-w-[1200px] px-6 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-h1">NEO CS スタイルガイド</h1>
        <p className="text-body text-ink-500">
          新画面はこのページにあるトークン / コンポーネントのみを使う。raw hex と <code className="font-mono text-caption">text-[10|11px]</code> は禁止。
        </p>
      </header>

      {/* ===== Color tokens ===== */}
      <Section title="Color — Semantic" hint="意味論的に使う。新規コードはこちらを優先。">
        <div className="space-y-6">
          {SemanticSwatches.map((g) => (
            <div key={g.name}>
              <div className="text-h4 mb-2">{g.name}</div>
              <div className="grid grid-cols-6 gap-3">
                {g.entries.map((e) => (
                  <Swatch key={e.label} bg={e.cls} label={e.label} />
                ))}
              </div>
            </div>
          ))}
          <div>
            <div className="text-h4 mb-2">Surface / Border / Focus</div>
            <div className="grid grid-cols-6 gap-3">
              <Swatch bg="bg-surface" label="surface" sub="#FFFFFF" />
              <Swatch bg="bg-surface-muted" label="surface-muted" sub="#F7F8FA" />
              <Swatch bg="bg-surface-inverse" label="surface-inverse" sub="#0E0F12" />
              <Swatch bg="bg-borderc" label="borderc" sub="#EEF0F3" />
              <Swatch bg="bg-borderc-strong" label="borderc-strong" sub="#C4C7CD" />
              <Swatch bg="bg-focusring" label="focusring" sub="#3D9EFF" />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Color — Brand / Product" hint="ブランド表現と研修色。意味論的用途には使わない。">
        <div className="space-y-6">
          <div>
            <div className="text-h4 mb-2">Brand</div>
            <div className="grid grid-cols-6 gap-3">
              {BrandSwatches.map((c) => (
                <Swatch key={c.label} bg={c.cls} label={c.label} />
              ))}
            </div>
          </div>
          <div>
            <div className="text-h4 mb-2">Product (研修色)</div>
            <div className="grid grid-cols-4 gap-3">
              {ProductSwatches.map((c) => (
                <Swatch key={c.label} bg={c.cls} label={c.label} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ===== Typography ===== */}
      <Section title="Typography" hint="11px以下は新規禁止。最小は caption (12px)、本文は body (14px)。">
        <div className="space-y-3">
          {FontSamples.map((f) => (
            <div key={f.label} className="flex items-baseline gap-4 border-b border-ink-100 pb-2">
              <div className={`${f.cls} flex-1`}>あア亜The quick brown fox 業務システム</div>
              <div className="text-caption text-ink-500 w-40">{f.label}</div>
              <div className="text-caption text-ink-500 w-32">{f.note}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ===== Spacing ===== */}
      <Section title="Spacing" hint="Tailwind既定の 4px グリッド。">
        <div className="space-y-2">
          {Spacings.map((n) => (
            <div key={n} className="flex items-center gap-3">
              <div className="text-caption text-ink-500 w-16 font-mono">p-{n}</div>
              <div className={`bg-info-100 h-4`} style={{ width: `${n * 4}px` }} />
              <div className="text-caption text-ink-500">{n * 4}px</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ===== Radius ===== */}
      <Section title="Border Radius" hint="新規は sm/md/lg/xl/surface/pill のみ。">
        <div className="grid grid-cols-6 gap-3">
          {Radii.map((r) => (
            <div key={r.label} className="flex flex-col items-center gap-2">
              <div className={`h-16 w-16 bg-info-100 border border-info-500 ${r.cls}`} />
              <div className="text-caption text-ink-700">{r.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ===== Shadow ===== */}
      <Section title="Shadow">
        <div className="grid grid-cols-2 gap-6">
          {Shadows.map((s) => (
            <div key={s.label} className="flex flex-col gap-2">
              <div className={`h-24 rounded-surface bg-white ${s.cls}`} />
              <div className="text-caption text-ink-700">{s.label} <span className="text-ink-500">— {s.note}</span></div>
            </div>
          ))}
        </div>
      </Section>

      {/* ===== Components ===== */}
      <Section title="Button" hint="高さ最小36px、フォーカスリングは focus-ring を必ず付与。">
        <div className="flex flex-wrap gap-3">
          <button className="focus-ring rounded-md bg-ink-900 text-white text-body px-4 py-2 hover:bg-ink-700">
            Primary
          </button>
          <button className="focus-ring rounded-md bg-white border border-ink-300 text-ink-900 text-body px-4 py-2 hover:bg-ink-50">
            Secondary
          </button>
          <button className="focus-ring rounded-md bg-danger-600 text-white text-body px-4 py-2 hover:bg-danger-700">
            Danger
          </button>
          <button className="focus-ring rounded-md text-ink-700 text-body px-4 py-2 hover:bg-ink-50">
            Ghost
          </button>
          <button className="focus-ring rounded-pill bg-info-500 text-white text-body px-4 py-2">
            Pill
          </button>
        </div>
      </Section>

      <Section title="Card / Surface">
        <div className="grid grid-cols-3 gap-4">
          <div className="surface p-4">
            <div className="text-h4">surface</div>
            <p className="text-caption text-ink-500 mt-1">推奨。新規カードはこれ。</p>
          </div>
          <div className="surface-muted p-4">
            <div className="text-h4">surface-muted</div>
            <p className="text-caption text-ink-500 mt-1">セカンダリ背景。</p>
          </div>
          <div className="liquid-surface p-4">
            <div className="text-h4">liquid-surface (互換)</div>
            <p className="text-caption text-ink-500 mt-1">既存コード向け。新規利用非推奨。</p>
          </div>
        </div>
      </Section>

      <Section title="Badge / Status" hint="ステータス表現は色 + アイコン + テキストの3点で意味を持たせる (色のみ禁止)。">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-pill bg-success-50 text-success-700 border border-success-100 px-2.5 py-1 text-caption font-medium">
            <span aria-hidden>●</span>順調
          </span>
          <span className="inline-flex items-center gap-1 rounded-pill bg-warning-50 text-warning-700 border border-warning-100 px-2.5 py-1 text-caption font-medium">
            <span aria-hidden>▲</span>注意
          </span>
          <span className="inline-flex items-center gap-1 rounded-pill bg-danger-50 text-danger-700 border border-danger-100 px-2.5 py-1 text-caption font-medium">
            <span aria-hidden>■</span>要対応
          </span>
          <span className="inline-flex items-center gap-1 rounded-pill bg-info-50 text-info-700 border border-info-100 px-2.5 py-1 text-caption font-medium">
            <span aria-hidden>i</span>情報
          </span>
          <span className="inline-flex items-center gap-1 rounded-pill bg-ink-50 text-ink-700 border border-ink-100 px-2.5 py-1 text-caption font-medium">
            中立
          </span>
        </div>
      </Section>

      <Section title="Input" hint="必ず <label htmlFor> で結ぶ。focus-ring を必ず付与。">
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sg-name" className="text-caption font-medium text-ink-700">企業名</label>
            <input
              id="sg-name"
              className="focus-ring rounded-md border border-ink-100 bg-white text-body text-ink-900 px-3 py-2"
              placeholder="株式会社サンプル"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sg-product" className="text-caption font-medium text-ink-700">研修</label>
            <select
              id="sg-product"
              className="focus-ring rounded-md border border-ink-100 bg-white text-body text-ink-900 px-3 py-2"
            >
              <option>アカデミア</option>
              <option>評議会</option>
              <option>愛犬</option>
              <option>コミュ</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5 col-span-2">
            <label htmlFor="sg-memo" className="text-caption font-medium text-ink-700">メモ</label>
            <textarea
              id="sg-memo"
              rows={3}
              className="focus-ring rounded-md border border-ink-100 bg-white text-body text-ink-900 px-3 py-2 resize-y"
            />
            <p id="sg-memo-help" className="text-caption text-ink-500">補助テキストは aria-describedby で input と結ぶ。</p>
          </div>
        </div>
      </Section>

      <Section title="Modal (簡易見本)" hint="本実装では radix-ui/react-dialog の採用を推奨 (focus trap / Esc / aria-*)">
        <div className="rounded-surface border border-ink-100 bg-ink-50 p-6">
          <div role="dialog" aria-modal="true" aria-labelledby="sg-modal-title" className="surface max-w-md mx-auto p-5">
            <h3 id="sg-modal-title" className="text-h3 mb-2">解約理由を記録</h3>
            <p className="text-body text-ink-700">本物のモーダルは focus trap を実装する。</p>
            <div className="flex justify-end gap-2 mt-4">
              <button className="focus-ring rounded-md text-body text-ink-700 px-3 py-1.5 hover:bg-ink-50">キャンセル</button>
              <button className="focus-ring rounded-md bg-ink-900 text-white text-body px-3 py-1.5 hover:bg-ink-700">保存</button>
            </div>
          </div>
        </div>
      </Section>

      <footer className="text-caption text-ink-500 text-center py-6">
        変更履歴は roadmap/03_デザインUX_完了報告.md を参照。
      </footer>
    </main>
  );
}
