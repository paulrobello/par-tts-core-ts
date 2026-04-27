import { collectAudio } from "../core/audio.js";
import { TtsError } from "../core/errors.js";
import type { AudioFormat, ProviderConfig, SpeechRequest, SpeechResult, TtsProvider, Voice } from "../core/types.js";
import { FetchTransport, requireOkResponse } from "../transport/fetch.js";
import type { TtsTransport } from "../transport/types.js";

const ELEVENLABS_OUTPUT_FORMAT: Record<string, { query: string; format: AudioFormat }> = {
  mp3: { query: "mp3_44100_128", format: "mp3" },
  pcm: { query: "pcm_16000", format: "pcm" },
  ulaw: { query: "ulaw_8000", format: "ulaw" },
};

interface ElevenLabsVoiceResponse {
  voices?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseLabels(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((label): label is string => typeof label === "string");
  }
  if (isRecord(value)) {
    return Object.values(value).filter((label): label is string => typeof label === "string");
  }
  return undefined;
}

async function parseJsonBody(body: Uint8Array | ReadableStream<Uint8Array>, provider: string): Promise<unknown> {
  try {
    const bytes = await collectAudio(body);
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch (cause) {
    throw new TtsError("Failed to parse ElevenLabs voices response", "provider_error", { provider, cause, retryable: false });
  }
}

function normalizeVoice(value: unknown): Voice | undefined {
  if (!isRecord(value)) return undefined;

  const id = parseString(value.voice_id) ?? parseString(value.id);
  const name = parseString(value.name) ?? id;
  if (!id || !name) return undefined;

  const labels = parseLabels(value.labels);
  const category = parseString(value.category);
  return {
    id,
    name,
    ...(labels && labels.length > 0 ? { labels } : {}),
    ...(category ? { category } : {}),
  };
}

export class ElevenLabsProvider implements TtsProvider {
  readonly name = "elevenlabs" as const;
  readonly defaultModel = "eleven_multilingual_v2";
  readonly defaultVoice = "Juniper";
  readonly supportedFormats: readonly AudioFormat[] = ["mp3", "pcm", "ulaw"];

  private readonly apiKey: string;
  private readonly transport: TtsTransport;
  private voicesPromise?: Promise<Voice[]>;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) {
      throw new TtsError("API key required for elevenlabs", "missing_api_key", { provider: this.name, retryable: false });
    }
    this.apiKey = config.apiKey;
    this.transport = config.transport ?? new FetchTransport();
  }

  async synthesize(request: SpeechRequest): Promise<SpeechResult> {
    const voice = await this.resolveVoice(request.voice ?? this.defaultVoice);
    const model = request.model ?? this.defaultModel;
    const requestedFormat = request.options?.format ?? request.options?.outputFormat ?? "mp3";
    const outputFormat = ELEVENLABS_OUTPUT_FORMAT[String(requestedFormat).toLowerCase()];
    if (!outputFormat) {
      throw new TtsError(`Unsupported ElevenLabs format '${String(requestedFormat)}'`, "provider_error", { provider: this.name, retryable: false });
    }

    const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`);
    url.searchParams.set("output_format", outputFormat.query);

    const response = await this.transport.request({
      method: "POST",
      url: url.toString(),
      headers: {
        "xi-api-key": this.apiKey,
        "content-type": "application/json",
      },
      body: {
        text: request.text,
        model_id: model,
        voice_settings: {
          stability: request.options?.stability ?? 0.5,
          similarity_boost: request.options?.similarityBoost ?? request.options?.similarity_boost ?? 0.5,
        },
      },
    });

    requireOkResponse(response, this.name, "speech generation failed");
    const audio = response.body;
    return {
      audio,
      provider: this.name,
      voice,
      model,
      format: outputFormat.format,
      contentType: response.headers["content-type"] ?? "audio/mpeg",
      streamed: typeof ReadableStream !== "undefined" && audio instanceof ReadableStream,
      textLength: request.text.length,
    };
  }

  async listVoices(): Promise<Voice[]> {
    this.voicesPromise ??= this.fetchVoices();
    return this.voicesPromise;
  }

  async resolveVoice(voice: string): Promise<string> {
    const query = voice.trim().toLowerCase();
    const voices = await this.listVoices();

    const exact = voices.find((candidate) => candidate.id.toLowerCase() === query || candidate.name.toLowerCase() === query);
    if (exact) return exact.id;

    const partial = voices.filter((candidate) => candidate.id.toLowerCase().includes(query) || candidate.name.toLowerCase().includes(query));
    if (partial.length === 1) return partial[0]!.id;
    if (partial.length > 1) {
      throw new TtsError(`Ambiguous voice '${voice}' for elevenlabs: ${partial.map((candidate) => candidate.id).join(", ")}`, "invalid_voice", {
        provider: this.name,
        retryable: false,
      });
    }

    throw new TtsError(`Voice '${voice}' not found for elevenlabs`, "invalid_voice", { provider: this.name, retryable: false });
  }

  private async fetchVoices(): Promise<Voice[]> {
    const response = await this.transport.request({
      method: "GET",
      url: "https://api.elevenlabs.io/v1/voices",
      headers: {
        "xi-api-key": this.apiKey,
      },
    });

    requireOkResponse(response, this.name, "voice listing failed");
    const json = (await parseJsonBody(response.body, this.name)) as ElevenLabsVoiceResponse;
    if (!Array.isArray(json.voices)) {
      throw new TtsError("Invalid ElevenLabs voices response", "provider_error", { provider: this.name, retryable: false });
    }

    return json.voices.map(normalizeVoice).filter((voice): voice is Voice => Boolean(voice));
  }
}
