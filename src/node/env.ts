import { createSpeechPipeline, normalizeProviderName } from "../core/provider-factory.js";
import { createSpeechPipeline as createPipelineForProvider } from "../core/pipeline.js";
import type { CreateSpeechPipelineConfig } from "../core/provider-factory.js";
import type { ProviderAlias, ProviderConfig, SpeechPipeline } from "../core/types.js";
import { KokoroOnnxProvider } from "./kokoro.js";

function envValue(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function providerConfigFromEnv(provider: ProviderAlias): ProviderConfig {
  switch (provider) {
    case "openai":
      return { apiKey: envValue("OPENAI_API_KEY"), voice: envValue("OPENAI_VOICE_ID") };
    case "elevenlabs":
      return { apiKey: envValue("ELEVENLABS_API_KEY"), voice: envValue("ELEVENLABS_VOICE_ID") };
    case "deepgram":
      return { apiKey: envValue("DEEPGRAM_API_KEY") ?? envValue("DG_API_KEY"), voice: envValue("DEEPGRAM_VOICE_ID") };
    case "gemini":
      return { apiKey: envValue("GEMINI_API_KEY") ?? envValue("GOOGLE_API_KEY"), voice: envValue("GEMINI_VOICE_ID") };
    case "kokoro":
    case "kokoro-onnx": {
      const voicePath = envValue("KOKORO_VOICE_PATH");
      return {
        model: envValue("KOKORO_MODEL_PATH"),
        voice: envValue("KOKORO_VOICE_ID"),
        ...(voicePath ? { options: { voicePath } } : {}),
      };
    }
  }
}

export function createSpeechPipelineFromEnv(config: CreateSpeechPipelineConfig): SpeechPipeline {
  const envConfig = providerConfigFromEnv(config.provider);
  const merged: CreateSpeechPipelineConfig = {
    ...config,
    apiKey: config.apiKey ?? envConfig.apiKey,
    model: config.model ?? envConfig.model,
    voice: config.voice ?? envConfig.voice,
    options: { ...(envConfig.options ?? {}), ...(config.options ?? {}) },
  };

  if (normalizeProviderName(config.provider) === "kokoro-onnx") {
    return createPipelineForProvider(new KokoroOnnxProvider(merged), merged);
  }

  return createSpeechPipeline(merged);
}
