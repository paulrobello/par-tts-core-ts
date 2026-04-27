import { TtsError, type TtsErrorCode } from "../core/errors.js";
import type { ProviderName } from "../core/types.js";
import type { TtsHttpRequest, TtsHttpResponse, TtsTransport } from "./types.js";

export interface ProxyWireSuccessResponse {
  ok: true;
  status: number;
  headers?: Record<string, string>;
  bodyBase64?: string;
}

export interface ProxyWireErrorResponse {
  ok: false;
  error: {
    code: TtsErrorCode;
    message: string;
    provider?: string;
  };
}

export type ProxyWireResponse = ProxyWireSuccessResponse | ProxyWireErrorResponse;

const sensitiveHeaders = new Set(["authorization", "xi-api-key", "x-goog-api-key", "cookie"]);
const errorCodes = new Set<TtsErrorCode>([
  "missing_api_key",
  "invalid_provider",
  "invalid_voice",
  "provider_error",
  "transport_error",
  "playback_error",
  "unsupported_runtime",
]);

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob !== "function") {
    throw new Error("Base64 decoding requires global atob");
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function inferProviderFromUrl(url: string): ProviderName | undefined {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return undefined;
  }

  switch (hostname) {
    case "api.openai.com":
      return "openai";
    case "api.elevenlabs.io":
      return "elevenlabs";
    case "api.deepgram.com":
      return "deepgram";
    case "generativelanguage.googleapis.com":
      return "gemini";
    default:
      return undefined;
  }
}

function stripSensitiveHeaders(headers: TtsHttpRequest["headers"]): Record<string, string> | undefined {
  if (!headers) return headers;

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.has(key.toLowerCase())) continue;
    sanitized[key] = value;
  }
  return sanitized;
}

function sanitizedRequest(request: TtsHttpRequest): TtsHttpRequest {
  return {
    ...request,
    headers: stripSensitiveHeaders(request.headers),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}

function isErrorCode(value: unknown): value is TtsErrorCode {
  return typeof value === "string" && errorCodes.has(value as TtsErrorCode);
}

function parseWireResponse(value: unknown): ProxyWireResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    throw new TtsError("Invalid proxy response", "transport_error");
  }

  if (value.ok) {
    if (typeof value.status !== "number") {
      throw new TtsError("Invalid proxy response", "transport_error");
    }
    if (value.headers !== undefined && !isStringRecord(value.headers)) {
      throw new TtsError("Invalid proxy response", "transport_error");
    }
    if (value.bodyBase64 !== undefined && typeof value.bodyBase64 !== "string") {
      throw new TtsError("Invalid proxy response", "transport_error");
    }
    return {
      ok: true,
      status: value.status,
      headers: value.headers,
      bodyBase64: value.bodyBase64,
    };
  }

  if (!isRecord(value.error) || !isErrorCode(value.error.code) || typeof value.error.message !== "string") {
    throw new TtsError("Invalid proxy response", "transport_error");
  }
  if (value.error.provider !== undefined && typeof value.error.provider !== "string") {
    throw new TtsError("Invalid proxy response", "transport_error");
  }
  return {
    ok: false,
    error: {
      code: value.error.code,
      message: value.error.message,
      provider: value.error.provider,
    },
  };
}

export class ProxyTransport implements TtsTransport {
  constructor(
    private readonly endpoint: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly provider?: ProviderName,
  ) {}

  async request(request: TtsHttpRequest): Promise<TtsHttpResponse> {
    const provider = this.provider ?? inferProviderFromUrl(request.url);
    if (!provider) {
      throw new TtsError("Unable to infer provider for proxied request", "invalid_provider");
    }

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, request: sanitizedRequest(request) }),
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      throw new TtsError("Invalid JSON proxy response", "transport_error", { cause });
    }

    const wireResponse = parseWireResponse(body);
    if (!wireResponse.ok) {
      throw new TtsError(wireResponse.error.message, wireResponse.error.code, { provider: wireResponse.error.provider });
    }

    return {
      status: wireResponse.status,
      headers: wireResponse.headers ?? {},
      body: wireResponse.bodyBase64 ? base64ToBytes(wireResponse.bodyBase64) : new Uint8Array(),
    };
  }
}

export function createProxyTransport(endpoint: string, fetchImpl?: typeof fetch, provider?: ProviderName): ProxyTransport {
  return new ProxyTransport(endpoint, fetchImpl, provider);
}
