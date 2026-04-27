import { describe, expect, it, vi } from "vitest";
import { createTtsProxyHandler } from "../../src/proxy/handler.js";
import { ProxyTransport } from "../../src/transport/proxy.js";

describe("createTtsProxyHandler", () => {
  it("rejects non-POST requests", async () => {
    const handler = createTtsProxyHandler({ providers: {} });
    const response = await handler(new Request("https://app.example/api/tts", { method: "GET" }));
    expect(response.status).toBe(405);
  });

  it("rejects unsupported provider requests", async () => {
    const handler = createTtsProxyHandler({ providers: {} });
    const response = await handler(
      new Request("https://app.example/api/tts", {
        method: "POST",
        body: JSON.stringify({ provider: "openai", request: { method: "POST", url: "https://api.openai.com/v1/audio/speech" } }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "invalid_provider" } });
  });

  it("returns a structured transport_error for malformed JSON", async () => {
    const handler = createTtsProxyHandler({ providers: { openai: {} } });
    const response = await handler(
      new Request("https://app.example/api/tts", {
        method: "POST",
        body: "not json",
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "transport_error" } });
  });

  it("rejects provider requests to non-allowlisted URLs without calling upstream fetch", async () => {
    const upstreamFetch = vi.fn(async () => new Response(new Uint8Array([1])));
    const handler = createTtsProxyHandler({
      providers: { openai: { apiKey: "server-key" } },
      fetchImpl: upstreamFetch as unknown as typeof fetch,
    });

    const response = await handler(
      new Request("https://app.example/api/tts", {
        method: "POST",
        body: JSON.stringify({ provider: "openai", request: { method: "POST", url: "https://attacker.example/steal" } }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "transport_error", provider: "openai" } });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("returns a structured transport_error when upstream fetch rejects", async () => {
    const upstreamFetch = vi.fn(async () => {
      throw new Error("network failed with secret details");
    });
    const handler = createTtsProxyHandler({
      providers: { openai: { apiKey: "server-key" } },
      fetchImpl: upstreamFetch as unknown as typeof fetch,
    });

    const response = await handler(
      new Request("https://app.example/api/tts", {
        method: "POST",
        body: JSON.stringify({ provider: "openai", request: { method: "POST", url: "https://api.openai.com/v1/audio/speech" } }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "transport_error", provider: "openai" } });
  });

  it("wires ProxyTransport to the handler with server-side auth injection for allowlisted URLs", async () => {
    const upstreamFetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer server-key");
      expect(headers.get("xi-api-key")).toBeNull();
      return new Response(new Uint8Array([4, 5, 6]), {
        status: 201,
        headers: { "content-type": "audio/mpeg", "x-upstream": "ok" },
      });
    });
    const handler = createTtsProxyHandler({
      providers: { openai: { apiKey: "server-key" } },
      fetchImpl: upstreamFetch as unknown as typeof fetch,
    });
    const proxyFetch = async (_url: RequestInfo | URL, init?: RequestInit) =>
      handler(
        new Request("https://app.example/api/tts", {
          method: init?.method,
          headers: init?.headers,
          body: init?.body,
        }),
      );
    const transport = new ProxyTransport("https://app.example/api/tts", proxyFetch as typeof fetch);

    const response = await transport.request({
      method: "POST",
      url: "https://api.openai.com/v1/audio/speech",
      headers: { authorization: "Bearer client-key", "x-client-safe": "yes" },
      body: { model: "tts-1", input: "hello", voice: "alloy" },
    });

    expect(upstreamFetch).toHaveBeenCalledOnce();
    expect(upstreamFetch.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/audio/speech");
    expect(response.status).toBe(201);
    expect(response.headers).toMatchObject({ "content-type": "audio/mpeg", "x-upstream": "ok" });
    expect(response.body).toEqual(new Uint8Array([4, 5, 6]));
  });
});
