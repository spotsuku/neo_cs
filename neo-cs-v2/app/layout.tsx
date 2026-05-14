import type { Metadata } from "next";
import "./globals.css";
import { ChatDock } from "@/components/shell/ChatDock";

export const metadata: Metadata = {
  title: "NEO CS 統合ダッシュボード",
  description: "NEO福岡CS 4研修横断管理アプリ"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-white text-ink-900 font-sans relative">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-ink-900 focus:text-white focus:px-3 focus:py-2 focus:text-body"
        >
          メインコンテンツへスキップ
        </a>
        {/* 背景のliquid blob（抑えめ）— P1で限定画面のみへ移設予定 */}
        <div className="liquid-blob bg-brand-green top-[-120px] left-[-60px] w-[360px] h-[360px]" />
        <div className="liquid-blob bg-brand-blue top-[80px] right-[-100px] w-[420px] h-[420px]" />
        <div className="liquid-blob bg-brand-pink bottom-[-160px] left-[30%] w-[420px] h-[420px]" />
        <div className="relative">{children}</div>
        <ChatDock />
      </body>
    </html>
  );
}
