import { mkdtemp, readFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TtsError } from "../core/errors.js";
import type { AudioFormat, ProviderConfig, SpeechRequest, SpeechResult, TtsProvider, Voice } from "../core/types.js";

export const KOKORO_DEFAULT_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
export const KOKORO_MAX_CHARS_PER_CHUNK = 450;

export interface KokoroAudio {
  save(path: string): void | Promise<void>;
}

export type KokoroVoiceMetadata = {
  name?: string;
  language?: string;
  gender?: string;
  traits?: string;
  [key: string]: unknown;
};

export interface KokoroRuntime {
  readonly voices: Record<string, KokoroVoiceMetadata>;
  generate(text: string, options: { voice: string; speed?: number }): Promise<KokoroAudio>;
}

type KokoroDtype = "fp32" | "fp16" | "q8" | "q4" | "q4f16";
type KokoroDevice = "wasm" | "webgpu" | "cpu" | null;

export interface KokoroModule {
  KokoroTTS: {
    from_pretrained(modelId: string, options?: { dtype?: KokoroDtype; device?: KokoroDevice; progress_callback?: unknown }): Promise<KokoroRuntime>;
  };
}

export class KokoroOnnxProvider implements TtsProvider {
  readonly name = "kokoro-onnx" as const;
  readonly defaultModel = KOKORO_DEFAULT_MODEL;
  readonly defaultVoice = "af_sarah";
  readonly supportedFormats: readonly AudioFormat[] = ["wav", "flac", "ogg"];

  private runtimePromise?: Promise<KokoroRuntime>;

  constructor(private readonly config: ProviderConfig = {}) {}

  private modelId(): string {
    return this.config.model ?? this.defaultModel;
  }

  private runtime(): Promise<KokoroRuntime> {
    this.runtimePromise ??= this.loadRuntime();
    return this.runtimePromise;
  }

  private async loadRuntime(): Promise<KokoroRuntime> {
    let module: KokoroModule;
    try {
      module = (await import("kokoro-js")) as KokoroModule;
    } catch (cause) {
      throw new TtsError("kokoro-js optional dependency is required for Kokoro ONNX synthesis", "unsupported_runtime", {
        provider: this.name,
        cause,
        retryable: false,
      });
    }

    const dtype = dtypeOption(this.config.options?.dtype, "q8");
    const device = deviceOption(this.config.options?.device, "cpu");
    // KOKORO_VOICE_PATH is preserved in provider options for compatibility, but kokoro-js manages voices internally.
    return module.KokoroTTS.from_pretrained(this.modelId(), { dtype, device });
  }

  async synthesize(request: SpeechRequest): Promise<SpeechResult> {
    const runtime = await this.runtime();
    const voice = await this.resolveVoice(request.voice ?? this.config.voice ?? this.defaultVoice);
    const speed = numericOption(request.options?.speed, numericOption(this.config.options?.speed, 1));
    const model = this.modelId();
    const chunks = chunkKokoroText(request.text);
    const tempDir = await mkdtemp(join(tmpdir(), "par-tts-kokoro-"));

    try {
      const wavChunks: Uint8Array[] = [];
      for (const [index, chunk] of chunks.entries()) {
        const filePath = join(tempDir, `speech-${index}.wav`);
        const audio = await runtime.generate(chunk, { voice, speed });
        await audio.save(filePath);
        wavChunks.push(new Uint8Array(await readFile(filePath)));
        await unlink(filePath).catch(() => undefined);
      }

      return {
        audio: wavChunks.length === 1 ? wavChunks[0]! : concatenateWavChunks(wavChunks),
        provider: this.name,
        voice,
        model,
        format: "wav",
        contentType: "audio/wav",
        streamed: false,
        textLength: request.text.length,
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  async listVoices(): Promise<Voice[]> {
    const runtime = await this.runtime();
    return Object.entries(runtime.voices).map(([id, meta]) => {
      const name = typeof meta.name === "string" ? meta.name : id;
      const labels = Object.entries(meta)
        .filter(([key, value]) => key !== "name" && typeof value === "string" && value.length > 0)
        .map(([, value]) => value as string);
      const category = typeof meta.language === "string" ? meta.language : undefined;
      return {
        id,
        name,
        ...(labels.length > 0 ? { labels } : {}),
        ...(category ? { category } : {}),
      };
    });
  }

  async resolveVoice(voice: string): Promise<string> {
    const normalized = voice.trim().toLowerCase();
    const voices = await this.listVoices();
    const exact = voices.find((candidate) => candidate.id.toLowerCase() === normalized || candidate.name.toLowerCase() === normalized);
    if (exact) return exact.id;

    const partialMatches = voices.filter((candidate) => candidate.id.toLowerCase().includes(normalized) || candidate.name.toLowerCase().includes(normalized));
    if (partialMatches.length === 1) return partialMatches[0]!.id;
    if (partialMatches.length > 1) {
      throw new TtsError(
        `Ambiguous Kokoro voice '${voice}': ${partialMatches.map((candidate) => candidate.id).join(", ")}`,
        "invalid_voice",
        { provider: this.name, retryable: false },
      );
    }

    throw new TtsError(`Unknown Kokoro voice '${voice}'`, "invalid_voice", { provider: this.name, retryable: false });
  }
}

function dtypeOption(value: unknown, fallback: KokoroDtype): KokoroDtype {
  return value === "fp32" || value === "fp16" || value === "q8" || value === "q4" || value === "q4f16" ? value : fallback;
}

function deviceOption(value: unknown, fallback: KokoroDevice): KokoroDevice {
  return value === "wasm" || value === "webgpu" || value === "cpu" || value === null ? value : fallback;
}

function numericOption(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function chunkKokoroText(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= KOKORO_MAX_CHARS_PER_CHUNK) return normalized ? [normalized] : [""];

  const chunks: string[] = [];
  let current = "";
  const sentenceParts = normalized.match(/[^.!?…。？！]+[.!?…。？！]+["')\]]*|[^.!?…。？！]+$/g) ?? [normalized];

  for (const sentence of sentenceParts) {
    for (const part of hardWrapText(sentence.trim(), KOKORO_MAX_CHARS_PER_CHUNK)) {
      if (!part) continue;
      const candidate = current ? `${current} ${part}` : part;
      if (candidate.length <= KOKORO_MAX_CHARS_PER_CHUNK) {
        current = candidate;
      } else {
        if (current) chunks.push(current);
        current = part;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [""];
}

function hardWrapText(text: string, maxLength: number): string[] {
  const parts: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf(" ", maxLength);
    if (splitAt <= 0) splitAt = remaining.indexOf(" ", maxLength);
    if (splitAt <= 0) splitAt = maxLength;

    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) parts.push(remaining);
  return parts;
}

type ParsedWav = {
  readonly fmt: Uint8Array;
  readonly data: Uint8Array;
};

function concatenateWavChunks(chunks: Uint8Array[]): Uint8Array {
  const parsed = chunks.map(parseWav);
  const fmt = parsed[0]!.fmt;
  const sameFormat = parsed.every((chunk) => bytesEqual(chunk.fmt, fmt));
  if (!sameFormat) throw new TtsError("Cannot concatenate Kokoro WAV chunks with different audio formats", "provider_error", { provider: "kokoro-onnx", retryable: false });

  const dataLength = parsed.reduce((total, chunk) => total + chunk.data.length, 0);
  const output = new Uint8Array(12 + 8 + fmt.length + 8 + dataLength);
  const view = new DataView(output.buffer);
  writeAscii(output, 0, "RIFF");
  view.setUint32(4, output.length - 8, true);
  writeAscii(output, 8, "WAVE");
  writeAscii(output, 12, "fmt ");
  view.setUint32(16, fmt.length, true);
  output.set(fmt, 20);
  const dataHeaderOffset = 20 + fmt.length;
  writeAscii(output, dataHeaderOffset, "data");
  view.setUint32(dataHeaderOffset + 4, dataLength, true);

  let offset = dataHeaderOffset + 8;
  for (const chunk of parsed) {
    output.set(chunk.data, offset);
    offset += chunk.data.length;
  }

  return output;
}

function parseWav(bytes: Uint8Array): ParsedWav {
  if (bytes.length < 44 || readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WAVE") {
    throw new TtsError("Kokoro generated an invalid WAV chunk", "provider_error", { provider: "kokoro-onnx", retryable: false });
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let fmt: Uint8Array | undefined;
  let data: Uint8Array | undefined;

  while (offset + 8 <= bytes.length) {
    const id = readAscii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + size;
    if (end > bytes.length) break;

    if (id === "fmt ") fmt = bytes.slice(start, end);
    if (id === "data") data = bytes.slice(start, end);
    offset = end + (size % 2);
  }

  if (!fmt || !data) {
    throw new TtsError("Kokoro generated a WAV chunk without fmt/data sections", "provider_error", { provider: "kokoro-onnx", retryable: false });
  }

  return { fmt, data };
}

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}
