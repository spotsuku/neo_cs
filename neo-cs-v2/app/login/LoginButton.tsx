"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export function LoginButton({ redirect }: { redirect: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    setPending(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anon) {
        setError("Supabase 環境変数が未設定です");
        setPending(false);
        return;
      }
      const sb = createBrowserClient(url, anon);
      const callback = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`;
      const hd = process.env.NEXT_PUBLIC_GOOGLE_HOSTED_DOMAIN;
      const { error: e } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback,
          queryParams: hd ? { hd } : undefined
        }
      });
      if (e) {
        setError(e.message);
        setPending(false);
      }
      // 成功時はブラウザがリダイレクトされるのでここで状態解除しない
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:opacity-60"
      >
        <GoogleMark />
        {pending ? "サインイン中…" : "Google でサインイン"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.13 4.13 0 0 1-1.79 2.71v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
