import { describe, expect, it } from "vitest";
import { createProvider, createSpeechPipeline, listProviders, normalizeProviderName, synthesize } from "../../src/core/provider-factory.js";
import { TtsError } from "../../src/core/errors.js";
import { createSpeechPipeline as createPipelineForProvider } from "../../src/core/pipeline.js";
import type { TtsProvider } from "../../src/core/types.js";
import type { TtsHttpRequest, TtsHttpResponse, TtsTransport } from "../../src/transport/types.js";

class MockTransport implements TtsTransport {
  requests: TtsHttpRequest[] = [];
  async request(request: TtsHttpRequest): Promise<TtsHttpResponse> {
    this.requests.push(request);
    return { status: 200, headers: { "content-type": "audio/mpeg" }, body: new Uint8Array([1]) };
  }
}

describe("provider factory", () => {
  it("normalizes provider aliases", () => {
    expect(normalizeProviderName("kokoro")).toBe("kokoro-onnx");
  });

  it("lists canonical providers", () => {
    expect(listProviders()).toEqual(["deepgram", "elevenlabs", "gemini", "kokoro-onnx", "openai"]);
  });

  it("creates providers and pipelines", async () => {
    const transport = new MockTransport();
    const provider = createProvider("openai", { apiKey: "sk", transport });
    expect(provider.name).toBe("openai");
    const pipeline = createSpeechPipeline({ provider: "openai", apiKey: "sk", transport, voice: "nova" });
    const result = await pipeline.synthesize("hello");
    expect(result.provider).toBe("openai");
    expect(transport.requests).toHaveLength(1);
  });

  it("supports one-shot synthesis", async () => {
    const result = await synthesize({ provider: "openai", apiKey: "sk", transport: new MockTransport(), text: "hello", voice: "nova" });
    expect(result.provider).toBe("openai");
  });

  it("lets Deepgram default the model to the resolved pipeline voice", async () => {
    const transport = new MockTransport();
    const pipeline = createSpeechPipeline({ provider: "deepgram", apiKey: "dg", transport, voice: "aura-2-andromeda-en" });

    await pipeline.synthesize("hello");

    expect(transport.requests[0]?.url).toContain("model=aura-2-andromeda-en");
    expect(transport.requests[0]?.url).not.toContain("model=aura-2-thalia-en");
  });

  it("reports Kokoro as Node-only from the browser-safe factory", () => {
    expect(() => createProvider("kokoro", {})).toThrow(TtsError);
  });

  it("emits callbacks through pipelines", async () => {
    const events: string[] = [];
    const pipeline = createSpeechPipeline({
      provider: "openai",
      apiKey: "sk",
      transport: new MockTransport(),
      voice: "nova",
      callbacks: { onStart: () => { events.push("start"); }, onComplete: () => { events.push("complete"); } },
    });
    await pipeline.synthesize("hello");
    expect(events).toEqual(["start", "complete"]);
  });

  it("retries retryable voice resolution failures without emitting onError after recovery", async () => {
    const events: string[] = [];
    let resolveCalls = 0;
    const provider: TtsProvider = {
      name: "openai",
      defaultVoice: "nova",
      defaultModel: "model",
      supportedFormats: ["mp3"],
      async resolveVoice() {
        resolveCalls += 1;
        if (resolveCalls === 1) throw new TtsError("temporary", "transport_error", { retryable: true });
        return "nova";
      },
      async synthesize(request) {
        return {
          audio: new Uint8Array([1]),
          provider: "openai",
          voice: request.voice ?? "nova",
          model: request.model ?? "model",
          format: "mp3",
          contentType: "audio/mpeg",
          streamed: false,
          textLength: request.text.length,
        };
      },
      async listVoices() {
        return [];
      },
    };

    const pipeline = createPipelineForProvider(provider, {
      provider: "openai",
      retry: { attempts: 1, backoffMs: 1 },
      callbacks: { onError: () => { events.push("error"); } },
    });

    await expect(pipeline.synthesize("hello")).resolves.toMatchObject({ voice: "nova" });
    expect(resolveCalls).toBe(2);
    expect(events).toEqual([]);
  });

  it("emits onError once when voice resolution fails finally", async () => {
    const events: string[] = [];
    const provider: TtsProvider = {
      name: "openai",
      defaultVoice: "nova",
      defaultModel: "model",
      supportedFormats: ["mp3"],
      async resolveVoice() {
        throw new TtsError("missing", "invalid_voice", { retryable: false });
      },
      async synthesize(request) {
        return {
          audio: new Uint8Array([1]),
          provider: "openai",
          voice: request.voice ?? "nova",
          model: request.model ?? "model",
          format: "mp3",
          contentType: "audio/mpeg",
          streamed: false,
          textLength: request.text.length,
        };
      },
      async listVoices() {
        return [];
      },
    };

    const pipeline = createPipelineForProvider(provider, {
      provider: "openai",
      retry: { attempts: 1, backoffMs: 1 },
      callbacks: { onError: () => { events.push("error"); } },
    });

    await expect(pipeline.synthesize("hello")).rejects.toMatchObject({ code: "invalid_voice" });
    expect(events).toHaveLength(1);
  });
});
