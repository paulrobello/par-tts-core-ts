import { TtsError } from "./errors.js";
import type { RetryOptions } from "./types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof TtsError) return error.retryable;
  return true;
}

export function calculateRetryDelay(backoffMs: number, maxBackoffMs: number | undefined, attempt: number): number {
  const baseBackoffMs = Math.max(0, backoffMs);
  const capBackoffMs = Math.max(0, maxBackoffMs ?? Number.POSITIVE_INFINITY);
  return Math.min(capBackoffMs, baseBackoffMs * 2 ** Math.max(0, attempt));
}

export async function runWithRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(0, options.attempts ?? 0);
  const backoffMs = Math.max(0, options.backoffMs ?? 0);
  const maxBackoffMs = Math.max(0, options.maxBackoffMs ?? Number.POSITIVE_INFINITY);

  let lastError: unknown;
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableError(error)) throw error;
      const delay = calculateRetryDelay(backoffMs, maxBackoffMs, attempt);
      if (delay > 0) await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
