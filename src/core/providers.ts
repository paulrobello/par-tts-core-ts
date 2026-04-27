import type { ProviderAlias, ProviderConfig, ProviderName, TtsProvider } from "./types.js";
import { DeepgramProvider } from "../providers/deepgram.js";
import { ElevenLabsProvider } from "../providers/elevenlabs.js";
import { GeminiProvider } from "../providers/gemini.js";
import { OpenAIProvider } from "../providers/openai.js";

export const PROVIDER_ALIASES: Record<ProviderAlias, ProviderName> = {
  elevenlabs: "elevenlabs",
  openai: "openai",
  "kokoro-onnx": "kokoro-onnx",
  kokoro: "kokoro-onnx",
  deepgram: "deepgram",
  gemini: "gemini",
};

type ProviderConstructor = new (config: ProviderConfig) => TtsProvider;

export const PROVIDER_CLASSES = {
  openai: OpenAIProvider,
  elevenlabs: ElevenLabsProvider,
  deepgram: DeepgramProvider,
  gemini: GeminiProvider,
} as const satisfies Record<Exclude<ProviderName, "kokoro-onnx">, ProviderConstructor>;

export function isProviderAlias(value: string): value is ProviderAlias {
  return Object.hasOwn(PROVIDER_ALIASES, value);
}
