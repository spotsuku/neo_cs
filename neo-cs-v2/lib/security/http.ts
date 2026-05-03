/**
 * 外部HTTP呼び出しの安全弁
 *
 * - timeout (デフォルト 15s)
 * - リトライ (idempotent な GET / 5xx / 429 のみ、jitter付き指数バックオフ)
 * - AbortSignal 連結
 * - 失敗は AbortError / FetchError として明示
 *
 * Anthropic / Supabase / Gmail 等、全外部呼び出しはこれを通すこと。
 */

export interface FetchHardOptions extends Omit<RequestInit, 'signal'> {
  timeoutMs?: number;
  retries?: number;       // 試行回数 - 1
  retryOn?: number[];     // ステータスコード
  signal?: AbortSignal;
  retryNonIdempotent?: boolean; // POST等もリトライしてよいか (デフォルト false)
}

export interface FetchHardResult {
  response: Response;
  attempts: number;
  totalMs: number;
}

const DEFAULT_RETRY_ON = [429, 500, 502, 503, 504];

export async function fetchHard(url: string, opts: FetchHardOptions = {}): Promise<FetchHardResult> {
  const {
    timeoutMs = 15_000,
    retries = 2,
    retryOn = DEFAULT_RETRY_ON,
    signal,
    retryNonIdempotent = false,
    ...init
  } = opts;

  const method = (init.method ?? 'GET').toUpperCase();
  const idempotent = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'].includes(method);
  const canRetry = idempotent || retryNonIdempotent;
  const maxAttempts = canRetry ? retries + 1 : 1;

  const start = Date.now();
  let attempt = 0;
  let lastErr: unknown = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    const ac = new AbortController();
    const linked = linkSignals(signal, ac.signal);
    const timer = setTimeout(() => ac.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: linked });
      clearTimeout(timer);

      if (response.ok || !retryOn.includes(response.status) || attempt >= maxAttempts) {
        return { response, attempts: attempt, totalMs: Date.now() - start };
      }

      // 429: Retry-After を尊重
      const ra = response.headers.get('retry-after');
      const waitMs = ra ? Math.min(parseRetryAfter(ra), 8000) : backoff(attempt);
      await sleep(waitMs, signal);
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (signal?.aborted) throw new DOMException('Aborted by caller', 'AbortError');
      if (attempt >= maxAttempts || !canRetry) throw e;
      await sleep(backoff(attempt), signal);
    }
  }

  throw lastErr ?? new Error('fetchHard: exhausted retries');
}

function backoff(attempt: number): number {
  // 200ms, 600ms, 1.4s, 3s … (cap 8s)
  const base = 200 * Math.pow(2, attempt - 1);
  const jitter = Math.random() * base * 0.3;
  return Math.min(8000, base + jitter);
}

function parseRetryAfter(v: string): number {
  const n = Number(v);
  if (Number.isFinite(n)) return n * 1000;
  const t = Date.parse(v);
  if (!Number.isNaN(t)) return Math.max(0, t - Date.now());
  return 1000;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

function linkSignals(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
  if (!a) return b;
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  a.addEventListener('abort', onAbort);
  b.addEventListener('abort', onAbort);
  return ac.signal;
}
