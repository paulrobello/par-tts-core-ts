import { collectAudio } from "../core/audio.js";
import { TtsError } from "../core/errors.js";
import type { AudioFormat, ProviderConfig, SpeechRequest, SpeechResult, TtsProvider, Voice } from "../core/types.js";
import { FetchTransport, requireOkResponse } from "../transport/fetch.js";
import type { TtsTransport } from "../transport/types.js";
import { GEMINI_VOICES, resolveStaticVoice } from "./static-voices.js";

interface GeminiResponsePayload {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
        };
      }>;
    };
  }>;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function wrapPcmAsWav(pcm: Uint8Array, sampleRate = 24_000): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, pcm.byteLength, true);

  const wav = new Uint8Array(44 + pcm.byteLength);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);
  return wav;
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob !== "function") {
    throw new TtsError("Gemini audio decoding requires atob", "unsupported_runtime", { provider: "gemini", retryable: false });
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export class GeminiProvider implements TtsProvider {
  readonly name = "gemini" as const;
  readonly defaultModel = "gemini-2.5-flash-preview-tts";
  readonly defaultVoice = "Kore";
  readonly supportedFormats: readonly AudioFormat[] = ["wav"];

  private readonly apiKey: string;
  private readonly transport: TtsTransport;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) {
      throw new TtsError("API key required for gemini", "missing_api_key", { provider: this.name, retryable: false });
    }
    this.apiKey = config.apiKey;
    this.transport = config.transport ?? new FetchTransport();
  }

  async synthesize(request: SpeechRequest): Promise<SpeechResult> {
    const voice = await this.resolveVoice(request.voice ?? this.defaultVoice);
    const model = request.model ?? this.defaultModel;
    const response = await this.transport.request({
      method: "POST",
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      headers: {
        "x-goog-api-key": this.apiKey,
        "content-type": "application/json",
      },
      body: {
        contents: [{ parts: [{ text: request.text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
        },
      },
    });

    requireOkResponse(response, this.name, "speech generation failed");
    const body = await collectAudio(response.body);
    const payload = JSON.parse(new TextDecoder().decode(body)) as GeminiResponsePayload;
    const data = payload.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!data) {
      throw new TtsError("Unexpected Gemini response shape", "provider_error", { provider: this.name, retryable: false });
    }

    const audio = wrapPcmAsWav(base64ToBytes(data));
    return {
      audio,
      provider: this.name,
      voice,
      model,
      format: "wav",
      contentType: "audio/wav",
      streamed: false,
      textLength: request.text.length,
    };
  }

  async listVoices(): Promise<Voice[]> {
    return GEMINI_VOICES;
  }

  async resolveVoice(voice: string): Promise<string> {
    return resolveStaticVoice(this.name, GEMINI_VOICES, voice);
  }
}
