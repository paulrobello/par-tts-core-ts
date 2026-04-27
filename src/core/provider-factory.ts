import { applyCallbacks } from "./callbacks.js";
import { TtsError } from "./errors.js";
import { createSpeechPipeline as createPipeline } from "./pipeline.js";
import { PROVIDER_ALIASES, PROVIDER_CLASSES, isProviderAlias } from "./providers.js";
import { runWithRetry } from "./retry.js";
import type {
  ProviderAlias,
  ProviderConfig,
  ProviderName,
  RetryOptions,
  SpeechPipeline,
  SpeechRequest,
  SpeechResult,
  TtsCallbacks,
  TtsProvider,
} from "./types.js";

export type CreateProviderConfig = ProviderConfig;

export interface CreateSpeechPipelineConfig extends CreateProviderConfig {
  provider: ProviderAlias;
}

export interface SynthesizeConfig extends CreateSpeechPipelineConfig {
  text: string;
}

export function normalizeProviderName(provider: ProviderAlias | string): ProviderName {
  if (!isProviderAlias(provider)) {
    throw new TtsError(`Unknown provider '${provider}'`, "invalid_provider", { provider, retryable: false });
  }
  return PROVIDER_ALIASES[provider];
}

export function listProviders(): ProviderName[] {
  return ["deepgram", "elevenlabs", "gemini", "kokoro-onnx", "openai"];
}

export function createProvider(provider: ProviderAlias | string, config: CreateProviderConfig): TtsProvider {
  const normalized = normalizeProviderName(provider);
  if (normalized === "kokoro-onnx") {
    throw new TtsError("Kokoro ONNX is only available from @paulrobello/par-tts-core-ts/node", "unsupported_runtime", { provider: normalized, retryable: false });
  }

  switch (normalized) {
    case "openai":
      return new PROVIDER_CLASSES.openai(config);
    case "elevenlabs":
      return new PROVIDER_CLASSES.elevenlabs(config);
    case "deepgram":
      return new PROVIDER_CLASSES.deepgram(config);
    case "gemini":
      return new PROVIDER_CLASSES.gemini(config);
  }
}

export function createSpeechPipeline(config: CreateSpeechPipelineConfig): SpeechPipeline {
  return createPipeline(createProvider(config.provider, config), config);
}

export async function synthesize(config: SynthesizeConfig): Promise<SpeechResult> {
  const pipeline = createSpeechPipeline(config);
  return pipeline.synthesize(config.text, { voice: config.voice, model: config.model, options: config.options });
}

export async function executeWithPolicies(
  provider: TtsProvider,
  request: SpeechRequest,
  retry?: RetryOptions,
  callbacks?: TtsCallbacks,
): Promise<SpeechResult> {
  try {
    const result = await runWithRetry(() => provider.synthesize(request), retry);
    return await applyCallbacks(result, callbacks);
  } catch (error) {
    await callbacks?.onError?.({ error, provider: provider.name, voice: request.voice, model: request.model, textLength: request.text.length });
    throw error;
  }
}
