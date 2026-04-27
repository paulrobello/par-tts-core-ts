import type { SpeechAudio } from "./types.js";

export function isReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return typeof ReadableStream !== "undefined" && value instanceof ReadableStream;
}

export async function collectAudio(audio: SpeechAudio): Promise<Uint8Array> {
  if (audio instanceof Uint8Array) return audio;

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = audio.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}
