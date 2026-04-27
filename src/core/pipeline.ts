import { applyCallbacks } from "./callbacks.js";
import { runWithRetry } from "./retry.js";
import type { CreateSpeechPipelineConfig } from "./provider-factory.js";
import type { SpeechPipeline, SpeechRequest, SpeechResult, TtsProvider, Voice } from "./types.js";

class DefaultSpeechPipeline implements SpeechPipeline {
  private readonly voiceCache = new Map<string, string>();

  constructor(
    private readonly provider: TtsProvider,
    private readonly config: CreateSpeechPipelineConfig,
  ) {}

  async synthesize(text: string, request: Omit<SpeechRequest, "text"> = {}): Promise<SpeechResult> {
    const requestedVoice = request.voice ?? this.config.voice ?? this.provider.defaultVoice;
    const model = request.model ?? this.config.model;
    const options = { ...(this.config.options ?? {}), ...(request.options ?? {}) };
    let resolvedVoice = requestedVoice;

    try {
      const result = await runWithRetry(async () => {
        resolvedVoice = await this.resolveVoice(requestedVoice);
        return this.provider.synthesize({
          text,
          voice: resolvedVoice,
          model,
          options,
        });
      }, this.config.retry);
      return await applyCallbacks(result, this.config.callbacks);
    } catch (error) {
      await this.config.callbacks?.onError?.({
        error,
        provider: this.provider.name,
        voice: resolvedVoice,
        model,
        textLength: text.length,
      });
      throw error;
    }
  }

  async listVoices(): Promise<Voice[]> {
    return this.provider.listVoices();
  }

  async resolveVoice(voice: string): Promise<string> {
    const cached = this.voiceCache.get(voice);
    if (cached) return cached;
    const resolved = await this.provider.resolveVoice(voice);
    this.voiceCache.set(voice, resolved);
    return resolved;
  }
}

export function createSpeechPipeline(provider: TtsProvider, config: CreateSpeechPipelineConfig): SpeechPipeline {
  return new DefaultSpeechPipeline(provider, config);
}
