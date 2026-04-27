import { mkdtemp, readFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TtsError } from "../core/errors.js";
import type { AudioFormat, ProviderConfig, SpeechRequest, SpeechResult, TtsProvider, Voice } from "../core/types.js";

export const KOKORO_DEFAULT_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

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
    const tempDir = await mkdtemp(join(tmpdir(), "par-tts-kokoro-"));
    const filePath = join(tempDir, "speech.wav");

    try {
      const audio = await runtime.generate(request.text, { voice, speed });
      await audio.save(filePath);
      const bytes = await readFile(filePath);
      return {
        audio: new Uint8Array(bytes),
        provider: this.name,
        voice,
        model,
        format: "wav",
        contentType: "audio/wav",
        streamed: false,
        textLength: request.text.length,
      };
    } finally {
      await unlink(filePath).catch(() => undefined);
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
