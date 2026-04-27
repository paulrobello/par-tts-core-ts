export type HttpMethod = "GET" | "POST";

export interface TtsHttpRequest {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface TtsHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array | ReadableStream<Uint8Array>;
}

export interface TtsTransport {
  request(request: TtsHttpRequest): Promise<TtsHttpResponse>;
  stream?(request: TtsHttpRequest): Promise<ReadableStream<Uint8Array>>;
}
