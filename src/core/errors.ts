export type TtsErrorCode =
  | "missing_api_key"
  | "invalid_provider"
  | "invalid_voice"
  | "provider_error"
  | "transport_error"
  | "playback_error"
  | "unsupported_runtime";

export interface TtsErrorOptions {
  provider?: string;
  cause?: unknown;
  retryable?: boolean;
}

export class TtsError extends Error {
  readonly code: TtsErrorCode;
  readonly provider?: string;
  readonly retryable: boolean;
  override readonly cause?: unknown;

  constructor(message: string, code: TtsErrorCode, options: TtsErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "TtsError";
    this.code = code;
    this.provider = options.provider;
    this.cause = options.cause;
    this.retryable = options.retryable ?? code === "transport_error";
  }
}

export function sanitizeSecret(value: string, secrets: Array<string | undefined>): string {
  let sanitized = value;
  for (const secret of secrets) {
    if (!secret) continue;
    sanitized = sanitized.split(secret).join("[REDACTED]");
  }
  return sanitized;
}
