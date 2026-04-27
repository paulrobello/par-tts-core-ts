import { describe, expect, it } from "vitest";

import { GeminiProvider } from "../../src/providers/gemini.js";
import type { TtsHttpRequest, TtsHttpResponse, TtsTransport } from "../../src/transport/types.js";

class MockTransport implements TtsTransport {
  requests: TtsHttpRequest[] = [];

  async request(request: TtsHttpRequest): Promise<TtsHttpResponse> {
    this.requests.push(request);
    const payload = {
      candidates: [{ content: { parts: [{ inlineData: { data: "AQID" } }] } }],
    };
    return { status: 200, headers: { "content-type": "application/json" }, body: new TextEncoder().encode(JSON.stringify(payload)) };
  }
}

describe("GeminiProvider", () => {
  it("constructs generateContent requests and wraps PCM as WAV", async () => {
    const transport = new MockTransport();
    const provider = new GeminiProvider({ apiKey: "gem", transport });

    const result = await provider.synthesize({ text: "hello", voice: "kore" });

    expect(transport.requests[0]?.url).toContain("gemini-2.5-flash-preview-tts:generateContent");
    expect(transport.requests[0]?.headers?.["x-goog-api-key"]).toBe("gem");
    expect(result.provider).toBe("gemini");
    expect(result.voice).toBe("Kore");
    expect(result.format).toBe("wav");
    expect((result.audio as Uint8Array).slice(0, 4)).toEqual(new TextEncoder().encode("RIFF"));
  });
});
