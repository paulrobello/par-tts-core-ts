import { describe, expect, it } from "vitest";

import { ElevenLabsProvider } from "../../src/providers/elevenlabs.js";
import type { TtsHttpRequest, TtsHttpResponse, TtsTransport } from "../../src/transport/types.js";

const jsonBytes = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

class MockTransport implements TtsTransport {
  requests: TtsHttpRequest[] = [];

  constructor(
    private readonly voices = {
      voices: [{ voice_id: "voice-id", name: "Voice ID", labels: {}, category: "generated" }],
    },
  ) {}

  async request(request: TtsHttpRequest): Promise<TtsHttpResponse> {
    this.requests.push(request);
    if (request.method === "GET" && request.url === "https://api.elevenlabs.io/v1/voices") {
      return { status: 200, headers: { "content-type": "application/json" }, body: jsonBytes(this.voices) };
    }

    return { status: 200, headers: { "content-type": "audio/mpeg" }, body: new Uint8Array([4, 5]) };
  }
}

describe("ElevenLabsProvider", () => {
  it("constructs text-to-speech requests", async () => {
    const transport = new MockTransport();
    const provider = new ElevenLabsProvider({ apiKey: "eleven", transport });

    const result = await provider.synthesize({ text: "hello", voice: "voice-id", options: { stability: 0.4, similarityBoost: 0.7 } });

    const post = transport.requests.find((request) => request.method === "POST");
    expect(post?.url).toBe("https://api.elevenlabs.io/v1/text-to-speech/voice-id?output_format=mp3_44100_128");
    expect(post?.headers?.["xi-api-key"]).toBe("eleven");
    expect(post?.body).toMatchObject({ text: "hello", model_id: "eleven_multilingual_v2" });
    expect(result).toMatchObject({ provider: "elevenlabs", voice: "voice-id", format: "mp3" });
  });

  it("resolves ElevenLabs voice names through REST voices", async () => {
    const transport = new MockTransport({
      voices: [{ voice_id: "juniper-id", name: "Juniper", labels: { accent: "American" }, category: "premade" }],
    });
    const provider = new ElevenLabsProvider({ apiKey: "eleven", transport });

    await expect(provider.resolveVoice("Juniper")).resolves.toBe("juniper-id");

    const result = await provider.synthesize({ text: "hello", voice: "Juniper", options: { format: "ulaw" } });

    const post = transport.requests.find((request) => request.method === "POST");
    expect(transport.requests.filter((request) => request.method === "GET")).toHaveLength(1);
    expect(post?.url).toBe("https://api.elevenlabs.io/v1/text-to-speech/juniper-id?output_format=ulaw_8000");
    expect(result).toMatchObject({ provider: "elevenlabs", voice: "juniper-id", format: "ulaw" });
  });

  it("maps ElevenLabs pcm format to output_format", async () => {
    const transport = new MockTransport();
    const provider = new ElevenLabsProvider({ apiKey: "eleven", transport });

    const result = await provider.synthesize({ text: "hello", voice: "voice-id", options: { format: "pcm" } });

    const post = transport.requests.find((request) => request.method === "POST");
    expect(post?.url).toBe("https://api.elevenlabs.io/v1/text-to-speech/voice-id?output_format=pcm_16000");
    expect(result).toMatchObject({ provider: "elevenlabs", voice: "voice-id", format: "pcm" });
  });
});
