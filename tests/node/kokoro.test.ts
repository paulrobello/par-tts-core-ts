import { writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectAudio } from "../../src/core/audio.js";
import { TtsError } from "../../src/core/errors.js";
import type { KokoroOnnxProvider as KokoroOnnxProviderClass } from "../../src/node/kokoro.js";

const mocks = {
  fromPretrained: vi.fn(),
  generate: vi.fn(),
};

function wavWithPcm(...pcm: number[]): Uint8Array {
  const dataLength = pcm.length;
  const bytes = new Uint8Array(44 + dataLength);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 24_000, true);
  view.setUint32(28, 24_000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeAscii(36, "data");
  view.setUint32(40, dataLength, true);
  bytes.set(pcm, 44);
  return bytes;
}

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

  it("chunks long text before calling kokoro-js to avoid tokenizer truncation", async () => {
    let audioByte = 1;
    mocks.generate.mockImplementation(async () => {
      const wav = wavWithPcm(audioByte++);
      return { save: async (path: string) => writeFile(path, wav) };
    });
    const longText = Array.from({ length: 80 }, (_, index) => `Sentence ${index + 1} has enough words to exercise the chunking path.`).join(" ");

    const result = await (await createProvider()).synthesize({ text: longText, voice: "af_sarah" });

    expect(mocks.generate.mock.calls.length).toBeGreaterThan(1);
    expect(mocks.generate.mock.calls.every(([text]) => typeof text === "string" && text.length <= 500)).toBe(true);
    expect(mocks.generate.mock.calls.map(([, options]) => options)).toEqual(mocks.generate.mock.calls.map(() => ({ voice: "af_sarah", speed: 1 })));
    const audio = await collectAudio(result.audio);
    expect(Array.from(audio.slice(0, 4))).toEqual([82, 73, 70, 70]);
    expect(audio.length).toBe(44 + mocks.generate.mock.calls.length);
    expect(result.textLength).toBe(longText.length);
  });

  it("hard-wraps one overlong sentence into bounded Kokoro chunks", async () => {
    mocks.generate.mockImplementation(async () => ({ save: async (path: string) => writeFile(path, wavWithPcm(7)) }));
    const longSentence = Array.from({ length: 160 }, (_, index) => `word${index}`).join(" ");

    await (await createProvider()).synthesize({ text: longSentence, voice: "af_sarah" });

    expect(mocks.generate.mock.calls.length).toBeGreaterThan(1);
    expect(mocks.generate.mock.calls.every(([text]) => typeof text === "string" && text.length <= 500)).toBe(true);
  });
});
