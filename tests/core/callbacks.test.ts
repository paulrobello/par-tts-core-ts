import { describe, expect, it } from "vitest";
import { applyCallbacks } from "../../src/core/callbacks.js";
import type { SpeechResult, TtsCallbacks } from "../../src/core/types.js";

function baseResult(audio: Uint8Array | ReadableStream<Uint8Array>): SpeechResult {
  return {
    audio,
    provider: "openai",
    voice: "nova",
    model: "gpt-4o-mini-tts",
    format: "mp3",
    contentType: "audio/mpeg",
    streamed: audio instanceof ReadableStream,
    textLength: 5,
  };
}

describe("applyCallbacks", () => {
  it("emits start, chunk, and complete for byte results", async () => {
    const events: string[] = [];
    const callbacks: TtsCallbacks = {
      onStart: async () => { events.push("start"); },
      onChunk: async (event) => { events.push(`chunk:${event.chunk.byteLength}`); },
      onComplete: async (event) => { events.push(`complete:${event.bytesGenerated}`); },
    };
    const result = await applyCallbacks(baseResult(new Uint8Array([1, 2, 3])), callbacks);
    expect(result.audio).toBeInstanceOf(Uint8Array);
    expect(events).toEqual(["start", "chunk:3", "complete:3"]);
  });

  it("wraps streams and emits chunk callbacks as the stream is read", async () => {
    const events: string[] = [];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.enqueue(new Uint8Array([2, 3]));
        controller.close();
      },
    });
    const result = await applyCallbacks(baseResult(stream), {
      onStart: async () => { events.push("start"); },
      onChunk: async (event) => { events.push(`chunk:${event.chunk.byteLength}`); },
      onComplete: async (event) => { events.push(`complete:${event.bytesGenerated}`); },
    });
    expect(events).toEqual(["start"]);

    const reader = (result.audio as ReadableStream<Uint8Array>).getReader();
    while (!(await reader.read()).done) {
      // drain stream
    }
    expect(events).toEqual(["start", "chunk:1", "chunk:2", "complete:3"]);
  });

  it("cancels the source stream when the wrapped stream is canceled", async () => {
    let canceledReason: unknown;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
      cancel(reason) {
        canceledReason = reason;
      },
    });

    const result = await applyCallbacks(baseResult(stream), {});
    await (result.audio as ReadableStream<Uint8Array>).cancel("stop");

    expect(canceledReason).toBe("stop");
  });
});
