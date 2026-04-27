import { describe, expect, it } from "vitest";

import { DeepgramProvider } from "../../src/providers/deepgram.js";
import type { TtsHttpRequest, TtsHttpResponse, TtsTransport } from "../../src/transport/types.js";

class MockTransport implements TtsTransport {
  requests: TtsHttpRequest[] = [];

  async request(request: TtsHttpRequest): Promise<TtsHttpResponse> {
    this.requests.push(request);
    return { status: 200, headers: { "content-type": "audio/mpeg" }, body: new Uint8Array([6]) };
  }
}

describe("DeepgramProvider", () => {
  it("uses the voice as the Deepgram model", async () => {
    const transport = new MockTransport();
    const provider = new DeepgramProvider({ apiKey: "dg", transport });

    const result = await provider.synthesize({ text: "hello", voice: "aura-2-thalia-en", options: { format: "mp3" } });

    expect(transport.requests[0]?.url).toContain("https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mp3");
    expect(transport.requests[0]?.headers?.authorization).toBe("Token dg");
    expect(result).toMatchObject({ provider: "deepgram", model: "aura-2-thalia-en", voice: "aura-2-thalia-en" });
  });

  it("passes through plausible explicit Aura model IDs not in the static list", async () => {
    const transport = new MockTransport();
    const provider = new DeepgramProvider({ apiKey: "dg", transport });

    const result = await provider.synthesize({ text: "hello", voice: "aura-2-luna-en", options: { format: "mp3" } });

    expect(transport.requests[0]?.url).toContain("model=aura-2-luna-en");
    expect(result).toMatchObject({ provider: "deepgram", model: "aura-2-luna-en", voice: "aura-2-luna-en" });
  });
});
