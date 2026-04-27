import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { collectAudio } from "../core/audio.js";
import type { SpeechResult } from "../core/types.js";

export async function saveSpeechResult(result: SpeechResult, filePath: string): Promise<string> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, await collectAudio(result.audio));
  return filePath;
}
