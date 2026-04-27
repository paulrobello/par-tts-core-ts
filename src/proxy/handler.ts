import { collectAudio } from "../core/audio.js";
import { TtsError } from "../core/errors.js";
import type { ProviderName, ProviderOptions } from "../core/types.js";
import { FetchTransport } from "../transport/fetch.js";
import type { TtsHttpRequest } from "../transport/types.js";

export interface ProxyProviderConfig {
  apiKey?: string;
  model?: string;
  voice?: string;
  options?: ProviderOptions;
}

export interface TtsProxyHandlerOptions {
  providers: Partial<Record<ProviderName, ProxyProviderConfig>>;
  fetchImpl?: typeof fetch;
}

export interface ProxyWireRequest {
  provider: ProviderName;
  request: TtsHttpRequest;
}

type TtsProxyHandler = (request: Request) => Promise<Response>;

const providerNames = new Set<ProviderName>(["elevenlabs", "openai", "kokoro-onnx", "deepgram", "gemini"]);
const sensitiveHeaders = new Set(["authorization", "xi-api-key", "x-goog-api-key", "cookie"]);
const allowedProviderHosts: Partial<Record<ProviderName, string>> = {
  openai: "api.openai.com",
  elevenlabs: "api.elevenlabs.io",
  deepgram: "api.deepgram.com",
  gemini: "generativelanguage.googleapis.com",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(error: TtsError, status: number): Response {
  return jsonResponse(
    {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        provider: error.provider,
      },
    },
    status,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProviderName(value: unknown): value is ProviderName {
  return typeof value === "string" && providerNames.has(value as ProviderName);
}

function isTtsHttpRequest(value: unknown): value is TtsHttpRequest {
  if (!isRecord(value)) return false;
  if (value.method !== "GET" && value.method !== "POST") return false;
  if (typeof value.url !== "string") return false;
  if (value.headers !== undefined) {
    if (!isRecord(value.headers)) return false;
    if (!Object.values(value.headers).every((entry) => typeof entry === "string")) return false;
  }
  return true;
}

function parseWireRequest(value: unknown): ProxyWireRequest | undefined {
  if (!isRecord(value) || !isProviderName(value.provider) || !isTtsHttpRequest(value.request)) return undefined;
  return { provider: value.provider, request: value.request };
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

function authHeaderForProvider(provider: ProviderName, apiKey: string): Record<string, string> {
  switch (provider) {
    case "openai":
      return { authorization: `Bearer ${apiKey}` };
    case "deepgram":
      return { authorization: `Token ${apiKey}` };
    case "elevenlabs":
      return { "xi-api-key": apiKey };
    case "gemini":
      return { "x-goog-api-key": apiKey };
    case "kokoro-onnx":
      return {};
  }
}

function validateUpstreamUrl(requestUrl: string, provider: ProviderName): TtsError | undefined {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return new TtsError("Invalid proxy upstream URL", "transport_error", { provider });
  }

  const allowedHost = allowedProviderHosts[provider];
  if (url.protocol !== "https:" || allowedHost === undefined || url.hostname !== allowedHost) {
    return new TtsError("Proxy upstream URL is not allowlisted for provider", "transport_error", { provider });
  }

  return undefined;
}

function withServerAuth(request: TtsHttpRequest, provider: ProviderName, apiKey?: string): TtsHttpRequest {
  const headers = stripSensitiveHeaders(request.headers) ?? {};
  return {
    ...request,
    headers: apiKey ? { ...headers, ...authHeaderForProvider(provider, apiKey) } : headers,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa !== "function") {
    throw new Error("Base64 encoding requires global btoa");
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function createTtsProxyHandler(options: TtsProxyHandlerOptions): TtsProxyHandler {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return errorResponse(new TtsError("Method not allowed", "transport_error"), 405);
    }

    let rawWireRequest: unknown;
    try {
      rawWireRequest = await request.json();
    } catch {
      return errorResponse(new TtsError("Invalid JSON proxy request", "transport_error"), 400);
    }

    const wireRequest = parseWireRequest(rawWireRequest);
    const provider = isRecord(rawWireRequest) && typeof rawWireRequest.provider === "string" ? rawWireRequest.provider : undefined;
    if (!wireRequest) {
      return errorResponse(new TtsError("Unsupported provider", "invalid_provider", { provider }), 400);
    }

    const providerConfig = options.providers[wireRequest.provider];
    if (providerConfig === undefined) {
      return errorResponse(new TtsError("Unsupported provider", "invalid_provider", { provider: wireRequest.provider }), 400);
    }

    const urlError = validateUpstreamUrl(wireRequest.request.url, wireRequest.provider);
    if (urlError) {
      return errorResponse(urlError, 400);
    }

    try {
      const transport = new FetchTransport(options.fetchImpl);
      const upstreamResponse = await transport.request(withServerAuth(wireRequest.request, wireRequest.provider, providerConfig.apiKey));
      const body = await collectAudio(upstreamResponse.body);

      return jsonResponse(
        {
          ok: true,
          status: upstreamResponse.status,
          headers: upstreamResponse.headers,
          bodyBase64: bytesToBase64(body),
        },
        200,
      );
    } catch (error) {
      return errorResponse(new TtsError("Proxy upstream request failed", "transport_error", { provider: wireRequest.provider, cause: error }), 502);
    }
  };
}
