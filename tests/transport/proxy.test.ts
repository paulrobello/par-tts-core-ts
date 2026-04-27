import { describe, expect, it, vi } from "vitest";
import { TtsError } from "../../src/core/errors.js";
import { ProxyTransport } from "../../src/transport/proxy.js";

describe("ProxyTransport", () => {
  it("posts provider-scoped transport requests to the configured endpoint and decodes audio", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true, status: 200, headers: { "content-type": "audio/mpeg" }, bodyBase64: "AQID" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const transport = new ProxyTransport("/api/tts", fetchMock as unknown as typeof fetch);

    const response = await transport.request({
      method: "POST",
      url: "https://api.openai.com/v1/audio/speech",
      headers: {
        authorization: "Bearer client-key",
        "xi-api-key": "client-elevenlabs-key",
        "x-custom": "safe",
      },
      body: { text: "hi" },
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/tts", expect.objectContaining({ method: "POST" }));
    expect(capturedInit).toBeDefined();
    expect(JSON.parse(capturedInit?.body as string)).toEqual({
      provider: "openai",
      request: {
        method: "POST",
        url: "https://api.openai.com/v1/audio/speech",
        headers: { "x-custom": "safe" },
        body: { text: "hi" },
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers).toEqual({ "content-type": "audio/mpeg" });
    expect(response.body).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("throws invalid_provider when provider cannot be inferred or configured", async () => {
    const fetchMock = vi.fn();
    const transport = new ProxyTransport("/api/tts", fetchMock as unknown as typeof fetch);

    await expect(transport.request({ method: "POST", url: "https://provider.example/tts" })).rejects.toMatchObject({
      name: "TtsError",
      code: "invalid_provider",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws transport_error when the proxy response is not JSON", async () => {
    const fetchMock = vi.fn(async () => new Response("not json", { status: 502, headers: { "content-type": "text/plain" } }));
    const transport = new ProxyTransport("/api/tts", fetchMock as unknown as typeof fetch, "openai");

    await expect(transport.request({ method: "POST", url: "https://proxy-only.example/tts" })).rejects.toBeInstanceOf(TtsError);
    await expect(transport.request({ method: "POST", url: "https://proxy-only.example/tts" })).rejects.toMatchObject({
      code: "transport_error",
    });
  });

  it("throws TtsError from proxy error envelopes", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: { code: "provider_error", message: "upstream failed", provider: "openai" } }), {
        status: 502,
        headers: { "content-type": "application/json" },
      }),
    );
    const transport = new ProxyTransport("/api/tts", fetchMock as unknown as typeof fetch, "openai");

    await expect(transport.request({ method: "POST", url: "https://proxy-only.example/tts" })).rejects.toMatchObject({
      code: "provider_error",
      message: "upstream failed",
      provider: "openai",
    });
  });
});
