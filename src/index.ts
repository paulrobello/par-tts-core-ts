export { collectAudio } from "./core/audio.js";
export { applyCallbacks } from "./core/callbacks.js";
export { TtsError, sanitizeSecret } from "./core/errors.js";
export { createProvider, createSpeechPipeline, listProviders, normalizeProviderName, synthesize } from "./core/provider-factory.js";
export { runWithRetry } from "./core/retry.js";
export { FetchTransport } from "./transport/fetch.js";
export { createProxyTransport, ProxyTransport } from "./transport/proxy.js";
export type { CreateProviderConfig, CreateSpeechPipelineConfig, SynthesizeConfig } from "./core/provider-factory.js";
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
} from "./core/types.js";
export type { HttpMethod, TtsHttpRequest, TtsHttpResponse, TtsTransport } from "./transport/types.js";
