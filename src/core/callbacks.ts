import { isReadableStream } from "./audio.js";
import type { SpeechResult, TtsCallbacks } from "./types.js";

async function maybeCall<T>(callback: ((event: T) => void | Promise<void>) | undefined, event: T): Promise<void> {
  if (callback) await callback(event);
}

export async function applyCallbacks(result: SpeechResult, callbacks?: TtsCallbacks): Promise<SpeechResult> {
  if (!callbacks) return result;

  const base = {
    provider: result.provider,
    voice: result.voice,
    model: result.model,
    textLength: result.textLength,
  };
  await maybeCall(callbacks.onStart, base);

  if (result.audio instanceof Uint8Array) {
    const bytesGenerated = result.audio.byteLength;
    await maybeCall(callbacks.onChunk, {
      ...base,
      chunk: result.audio,
      bytesGenerated,
      chunksGenerated: 1,
    });
    await maybeCall(callbacks.onComplete, {
      ...base,
      bytesGenerated,
      chunksGenerated: 1,
    });
    return result;
  }

  if (!isReadableStream(result.audio)) return result;

  const audio = result.audio;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let bytesGenerated = 0;
  let chunksGenerated = 0;

  function getReader(): ReadableStreamDefaultReader<Uint8Array> {
    reader ??= audio.getReader();
    return reader;
  }

  function releaseReader(sourceReader: ReadableStreamDefaultReader<Uint8Array>): void {
    if (reader !== sourceReader) return;
    sourceReader.releaseLock();
    reader = undefined;
  }

  const wrapped = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const sourceReader = getReader();
      try {
        const { done, value } = await sourceReader.read();
        if (done) {
          await maybeCall(callbacks.onComplete, {
            ...base,
            bytesGenerated,
            chunksGenerated,
          });
          controller.close();
          releaseReader(sourceReader);
          return;
        }

        bytesGenerated += value.byteLength;
        chunksGenerated += 1;
        await maybeCall(callbacks.onChunk, {
          ...base,
          chunk: value,
          bytesGenerated,
          chunksGenerated,
        });
        controller.enqueue(value);
      } catch (error) {
        try {
          await maybeCall(callbacks.onError, { ...base, error });
        } finally {
          controller.error(error);
          releaseReader(sourceReader);
        }
        throw error;
      }
    },
    async cancel(reason) {
      const sourceReader = getReader();
      try {
        await sourceReader.cancel(reason);
      } catch (error) {
        await maybeCall(callbacks.onError, { ...base, error });
        throw error;
      } finally {
        releaseReader(sourceReader);
      }
    },
  }, { highWaterMark: 0 });

  return { ...result, audio: wrapped };
}
