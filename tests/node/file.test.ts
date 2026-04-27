import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { saveSpeechResult } from "../../src/node/file.js";
import type { SpeechResult } from "../../src/core/types.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("saveSpeechResult", () => {
  it("writes audio bytes to disk", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "par-tts-"));
    const filePath = join(tempDir, "nested", "speech.wav");
    const result: SpeechResult = {
      audio: new Uint8Array([1, 2, 3]),
      provider: "openai",
      voice: "nova",
      model: "gpt-4o-mini-tts",
      format: "wav",
      contentType: "audio/wav",
      streamed: false,
      textLength: 5,
    };

    await expect(saveSpeechResult(result, filePath)).resolves.toBe(filePath);
    await expect(readFile(filePath)).resolves.toEqual(Buffer.from([1, 2, 3]));
  });
});
