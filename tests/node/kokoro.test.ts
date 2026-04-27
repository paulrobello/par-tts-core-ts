import { writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TtsError } from "../../src/core/errors.js";
import type { KokoroOnnxProvider as KokoroOnnxProviderClass } from "../../src/node/kokoro.js";

const mocks = {
  fromPretrained: vi.fn(),
  generate: vi.fn(),
};

vi.mock("kokoro-js", () => ({
  KokoroTTS: {
    from_pretrained: mocks.fromPretrained,
  },
}));

async function createProvider(config?: ConstructorParameters<typeof KokoroOnnxProviderClass>[0]) {
  const { KokoroOnnxProvider } = await import("../../src/node/kokoro.js");
  return new KokoroOnnxProvider(config);
}

beforeEach(() => {
  mocks.generate.mockReset();
  mocks.generate.mockImplementation(async () => ({
    save: async (path: string) => writeFile(path, new Uint8Array([82, 73, 70, 70])),
  }));

  mocks.fromPretrained.mockReset();
  mocks.fromPretrained.mockResolvedValue({
    voices: {
      af_sarah: { name: "Sarah", language: "en-us", gender: "female", traits: "warm" },
      am_adam: { name: "Adam", language: "en-us", gender: "male" },
    },
    generate: mocks.generate,
  });
});

describe("KokoroOnnxProvider", () => {
  it("loads the kokoro-js README model id by default", async () => {
    await (await createProvider()).listVoices();

    expect(mocks.fromPretrained).toHaveBeenCalledWith("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
  });

  it("lists voices from the runtime voices object with metadata labels", async () => {
    const voices = await (await createProvider()).listVoices();

    expect(voices).toEqual([
      { id: "af_sarah", name: "Sarah", labels: ["en-us", "female", "warm"], category: "en-us" },
      { id: "am_adam", name: "Adam", labels: ["en-us", "male"], category: "en-us" },
    ]);
  });

  it("resolves exact names plus partial names and ids", async () => {
    const provider = await createProvider();

    await expect(provider.resolveVoice("Sarah")).resolves.toBe("af_sarah");
    await expect(provider.resolveVoice("adam")).resolves.toBe("am_adam");
    await expect(provider.resolveVoice("af_sarah")).resolves.toBe("af_sarah");
  });

  it("rejects ambiguous partial voice matches", async () => {
    const provider = await createProvider();

    await expect(provider.resolveVoice("a")).rejects.toMatchObject({
      code: "invalid_voice",
      provider: "kokoro-onnx",
    } satisfies Partial<TtsError>);
  });

  it("synthesizes wav bytes using resolved voice and actual model metadata", async () => {
    const result = await (await createProvider()).synthesize({ text: "hi", voice: "Sarah" });

    expect(mocks.generate).toHaveBeenCalledWith("hi", { voice: "af_sarah", speed: 1 });
    expect(result).toMatchObject({
      audio: new Uint8Array([82, 73, 70, 70]),
      provider: "kokoro-onnx",
      voice: "af_sarah",
      model: "onnx-community/Kokoro-82M-v1.0-ONNX",
      format: "wav",
      contentType: "audio/wav",
      streamed: false,
      textLength: 2,
    });
  });

  it("uses configured model metadata and runtime model id", async () => {
    const result = await (await createProvider({ model: "custom/kokoro" })).synthesize({ text: "hi", voice: "af_sarah" });

    expect(mocks.fromPretrained).toHaveBeenCalledWith("custom/kokoro", { dtype: "q8", device: "cpu" });
    expect(result.model).toBe("custom/kokoro");
  });
});
