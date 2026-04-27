import { collectAudio } from "../core/audio.js";
import { TtsError } from "../core/errors.js";
import type { AudioFormat, ProviderConfig, SpeechRequest, SpeechResult, TtsProvider, Voice } from "../core/types.js";
import { FetchTransport, requireOkResponse } from "../transport/fetch.js";
import type { TtsTransport } from "../transport/types.js";
import { OPENAI_VOICES, resolveStaticVoice } from "./static-voices.js";

export class OpenAIProvider implements TtsProvider {
  readonly name = "openai" as const;
  readonly defaultModel = "gpt-4o-mini-tts";
  readonly defaultVoice = "nova";
  readonly supportedFormats: readonly AudioFormat[] = ["mp3", "opus", "aac", "flac", "wav", "pcm"];

  private readonly apiKey: string;
  private readonly transport: TtsTransport;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) {
      throw new TtsError("API key required for openai", "missing_api_key", { provider: this.name, retryable: false });
    }
    this.apiKey = config.apiKey;
    this.transport = config.transport ?? new FetchTransport();
  }

  async synthesize(request: SpeechRequest): Promise<SpeechResult> {
    const voice = await this.resolveVoice(request.voice ?? this.defaultVoice);
    const model = request.model ?? this.defaultModel;
    const format = (request.options?.format ?? request.options?.responseFormat ?? "mp3") as AudioFormat;
    const response = await this.transport.request({
      method: "POST",
      url: "https://api.openai.com/v1/audio/speech",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: {
        model,
        voice,
        input: request.text,
        response_format: format,
        ...(typeof request.options?.speed === "number" ? { speed: request.options.speed } : {}),
        ...(typeof request.options?.instructions === "string" ? { instructions: request.options.instructions } : {}),
      },
    });

    requireOkResponse(response, this.name, "speech generation failed");
    const audio = await collectAudio(response.body);
    return {
      audio,
      provider: this.name,
      voice,
      model,
      format,
      contentType: response.headers["content-type"] ?? "audio/mpeg",
      streamed: false,
      textLength: request.text.length,
    };
  }

  async listVoices(): Promise<Voice[]> {
    return OPENAI_VOICES;
  }

  async resolveVoice(voice: string): Promise<string> {
    return resolveStaticVoice(this.name, OPENAI_VOICES, voice);
  }
}
