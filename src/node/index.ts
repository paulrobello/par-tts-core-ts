export { collectAudio } from "../core/audio.js";
export { TtsError, sanitizeSecret } from "../core/errors.js";
export { createProvider, createSpeechPipeline, listProviders, normalizeProviderName, synthesize } from "../core/provider-factory.js";
export { runWithRetry } from "../core/retry.js";
export { providerConfigFromEnv, createSpeechPipelineFromEnv } from "./env.js";
export { saveSpeechResult } from "./file.js";
export { KokoroOnnxProvider } from "./kokoro.js";
export { choosePlaybackCommand, commandExists, playFile, playSpeechResult } from "./playback.js";
export type { CreateProviderConfig, CreateSpeechPipelineConfig, SynthesizeConfig } from "../core/provider-factory.js";
export type {
  AudioFormat,
  ChunkEvent,
  CompleteEvent,
  ErrorEvent,
  ProviderAlias,
  ProviderConfig,
  ProviderName,
  ProviderOptions,
  RetryOptions,
  SpeechAudio,
  SpeechPipeline,
  SpeechRequest,
  SpeechResult,
  StartEvent,
  TtsCallbacks,
  TtsProvider,
  Voice,
} from "../core/types.js";
export type { PlaybackCommand, PlayFileOptions } from "./playback.js";
