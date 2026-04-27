import { TtsError } from "../core/errors.js";
import type { AudioFormat, ProviderConfig, SpeechRequest, SpeechResult, TtsProvider, Voice } from "../core/types.js";
import { FetchTransport, requireOkResponse } from "../transport/fetch.js";
import type { TtsTransport } from "../transport/types.js";
import { DEEPGRAM_VOICES, resolveStaticVoice } from "./static-voices.js";

const ENCODING: Partial<Record<AudioFormat, string>> = {
  mp3: "mp3",
  wav: "linear16",
  flac: "flac",
  opus: "opus",
  aac: "aac",
};

const PLAUSIBLE_AURA_MODEL_ID = /^aura(-2)?-[a-z0-9-]+-[a-z]{2}$/i;

export class DeepgramProvider implements TtsProvider {
  readonly name = "deepgram" as const;
  readonly defaultModel = "aura-2-thalia-en";
  readonly defaultVoice = "aura-2-thalia-en";
  readonly supportedFormats: readonly AudioFormat[] = ["mp3", "wav", "flac", "opus", "aac"];

  private readonly apiKey: string;
  private readonly transport: TtsTransport;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) {
      throw new TtsError("API key required for deepgram", "missing_api_key", { provider: this.name, retryable: false });
    }
    this.apiKey = config.apiKey;
    this.transport = config.transport ?? new FetchTransport();
  }

  async synthesize(request: SpeechRequest): Promise<SpeechResult> {
    const voice = await this.resolveVoice(request.voice ?? this.defaultVoice);
    const format = (request.options?.format ?? "mp3") as AudioFormat;
    const encoding = ENCODING[format];
    if (!encoding) {
      throw new TtsError(`Unsupported Deepgram format '${format}'`, "provider_error", { provider: this.name, retryable: false });
    }

    const model = request.model ?? voice;
    const url = new URL("https://api.deepgram.com/v1/speak");
    url.searchParams.set("model", model);
    url.searchParams.set("encoding", encoding);
    if (format === "wav") url.searchParams.set("container", "wav");

    const sampleRate = request.options?.sampleRate ?? request.options?.sample_rate;
    if (typeof sampleRate === "number") url.searchParams.set("sample_rate", String(sampleRate));

    const response = await this.transport.request({
      method: "POST",
      url: url.toString(),
      headers: {
        authorization: `Token ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: { text: request.text },
    });

    requireOkResponse(response, this.name, "speech generation failed");
    const audio = response.body;
    return {
      audio,
      provider: this.name,
      voice,
      model,
      format,
      contentType: response.headers["content-type"] ?? "audio/mpeg",
      streamed: typeof ReadableStream !== "undefined" && audio instanceof ReadableStream,
      textLength: request.text.length,
    };
  }

  async listVoices(): Promise<Voice[]> {
    return DEEPGRAM_VOICES;
  }

  async resolveVoice(voice: string): Promise<string> {
    try {
      return resolveStaticVoice(this.name, DEEPGRAM_VOICES, voice);
    } catch (error) {
      const normalized = voice.trim().toLowerCase();
      if (error instanceof TtsError && error.code === "invalid_voice" && PLAUSIBLE_AURA_MODEL_ID.test(normalized)) {
        return normalized;
      }
      throw error;
    }
  }
}
