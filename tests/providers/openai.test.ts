import { describe, expect, it } from "vitest";

import { OpenAIProvider } from "../../src/providers/openai.js";
import type { TtsHttpRequest, TtsHttpResponse, TtsTransport } from "../../src/transport/types.js";

class MockTransport implements TtsTransport {
  requests: TtsHttpRequest[] = [];

  async request(request: TtsHttpRequest): Promise<TtsHttpResponse> {
    this.requests.push(request);
    return { status: 200, headers: { "content-type": "audio/mpeg" }, body: new Uint8Array([1, 2, 3]) };
  }
}

describe("OpenAIProvider", () => {
  it("constructs REST requests and returns normalized results", async () => {
    const transport = new MockTransport();
    const provider = new OpenAIProvider({ apiKey: "sk-test", transport });

    const result = await provider.synthesize({ text: "hello", voice: "nova", options: { format: "mp3", speed: 1.2 } });

    expect(transport.requests[0]).toMatchObject({ method: "POST", url: "https://api.openai.com/v1/audio/speech" });
    expect(transport.requests[0]?.headers?.authorization).toBe("Bearer sk-test");
    expect(transport.requests[0]?.body).toMatchObject({ input: "hello", voice: "nova", response_format: "mp3", speed: 1.2 });
    expect(result).toMatchObject({
      provider: "openai",
      voice: "nova",
      model: "gpt-4o-mini-tts",
      format: "mp3",
      contentType: "audio/mpeg",
    });
  });

  it("resolves OpenAI voices by id or name", async () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test", transport: new MockTransport() });

    await expect(provider.resolveVoice("Nova")).resolves.toBe("nova");
  });
});
