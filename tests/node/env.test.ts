import { afterEach, describe, expect, it } from "vitest";
import { providerConfigFromEnv } from "../../src/node/env.js";

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_VOICE_ID;
  delete process.env.DEEPGRAM_API_KEY;
  delete process.env.DG_API_KEY;
  delete process.env.DEEPGRAM_VOICE_ID;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_VOICE_ID;
  delete process.env.KOKORO_MODEL_PATH;
  delete process.env.KOKORO_VOICE_PATH;
  delete process.env.KOKORO_VOICE_ID;
});

describe("providerConfigFromEnv", () => {
  it("loads OPENAI_API_KEY and OPENAI_VOICE_ID for openai", () => {
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.OPENAI_VOICE_ID = "openai-voice";

    expect(providerConfigFromEnv("openai")).toMatchObject({
      apiKey: "openai-key",
      voice: "openai-voice",
    });
  });

  it("falls back from DEEPGRAM_API_KEY to DG_API_KEY", () => {
    process.env.DG_API_KEY = "dg-key";
    process.env.DEEPGRAM_VOICE_ID = "deepgram-voice";

    expect(providerConfigFromEnv("deepgram")).toMatchObject({
      apiKey: "dg-key",
      voice: "deepgram-voice",
    });
  });

  it("prefers DEEPGRAM_API_KEY over DG_API_KEY", () => {
    process.env.DEEPGRAM_API_KEY = "deepgram-key";
    process.env.DG_API_KEY = "dg-key";

    expect(providerConfigFromEnv("deepgram").apiKey).toBe("deepgram-key");
  });

  it("falls back from GEMINI_API_KEY to GOOGLE_API_KEY", () => {
    process.env.GOOGLE_API_KEY = "google-key";
    process.env.GEMINI_VOICE_ID = "gemini-voice";

    expect(providerConfigFromEnv("gemini")).toMatchObject({
      apiKey: "google-key",
      voice: "gemini-voice",
    });
  });

  it("prefers GEMINI_API_KEY over GOOGLE_API_KEY", () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GOOGLE_API_KEY = "google-key";

    expect(providerConfigFromEnv("gemini").apiKey).toBe("gemini-key");
  });

  it("loads Kokoro model and voice paths from env", () => {
    process.env.KOKORO_MODEL_PATH = "/models/kokoro.onnx";
    process.env.KOKORO_VOICE_PATH = "/models/voices.bin";

    expect(providerConfigFromEnv("kokoro-onnx")).toMatchObject({
      model: "/models/kokoro.onnx",
      options: { voicePath: "/models/voices.bin" },
    });
  });

  it("keeps Kokoro voice id as voice when provided", () => {
    process.env.KOKORO_VOICE_ID = "af_sarah";

    expect(providerConfigFromEnv("kokoro-onnx")).toMatchObject({
      voice: "af_sarah",
    });
  });
});
