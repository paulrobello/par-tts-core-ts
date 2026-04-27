import { TtsError } from "../core/errors.js";
import type { TtsHttpRequest, TtsHttpResponse, TtsTransport } from "./types.js";

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function requestBodyToFetchBody(body: unknown): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return body as BodyInit;
  return JSON.stringify(body);
}

function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

export class FetchTransport implements TtsTransport {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async request(request: TtsHttpRequest): Promise<TtsHttpResponse> {
    const response = await this.fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: requestBodyToFetchBody(request.body),
    });

    return {
      status: response.status,
      headers: headersToRecord(response.headers),
      body: response.body ?? new Uint8Array(await response.arrayBuffer()),
    };
  }

  async stream(request: TtsHttpRequest): Promise<ReadableStream<Uint8Array>> {
    const response = await this.request(request);
    if (response.body instanceof ReadableStream) return response.body;
    return bytesToStream(response.body);
  }
}

export function requireOkResponse(response: TtsHttpResponse, provider: string, message: string): void {
  if (response.status >= 200 && response.status < 300) return;

  throw new TtsError(`${message} (status ${response.status})`, "provider_error", {
    provider,
    retryable: response.status >= 500 || response.status === 429,
  });
}
