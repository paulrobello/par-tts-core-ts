export type ProviderName = "elevenlabs" | "openai" | "kokoro-onnx" | "deepgram" | "gemini";
export type ProviderAlias = ProviderName | "kokoro";
export type AudioFormat = "mp3" | "wav" | "opus" | "aac" | "flac" | "pcm" | "ulaw" | "ogg";
export type SpeechAudio = Uint8Array | ReadableStream<Uint8Array>;

export interface Voice {
  id: string;
  name: string;
  labels?: string[];
  category?: string;
}

export interface SpeechResult {
  audio: SpeechAudio;
  provider: ProviderName;
  voice: string;
  model: string;
  format: AudioFormat;
  contentType: string;
  streamed: boolean;
  textLength: number;
}

export interface SpeechRequest {
  text: string;
  voice?: string;
  model?: string;
  options?: ProviderOptions;
}

export type ProviderOptions = Record<string, unknown>;

export interface RetryOptions {
  attempts?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
}

export interface CallbackBaseEvent {
  provider: ProviderName;
  voice: string;
  model: string;
  textLength: number;
}

export interface StartEvent extends CallbackBaseEvent {}

export interface ChunkEvent extends CallbackBaseEvent {
  chunk: Uint8Array;
  bytesGenerated: number;
  chunksGenerated: number;
}

export interface CompleteEvent extends CallbackBaseEvent {
  bytesGenerated: number;
  chunksGenerated: number;
}

export interface ErrorEvent extends Partial<CallbackBaseEvent> {
  error: unknown;
}

export interface TtsCallbacks {
  onStart?: (event: StartEvent) => void | Promise<void>;
  onChunk?: (event: ChunkEvent) => void | Promise<void>;
  onComplete?: (event: CompleteEvent) => void | Promise<void>;
  onError?: (event: ErrorEvent) => void | Promise<void>;
}

export interface ProviderConfig {
  apiKey?: string;
  model?: string;
  voice?: string;
  transport?: import("../transport/types.js").TtsTransport;
  retry?: RetryOptions;
  callbacks?: TtsCallbacks;
  options?: ProviderOptions;
}

export interface TtsProvider {
  readonly name: ProviderName;
  readonly defaultModel: string;
  readonly defaultVoice: string;
  readonly supportedFormats: readonly AudioFormat[];
  synthesize(request: SpeechRequest): Promise<SpeechResult>;
  listVoices(): Promise<Voice[]>;
  resolveVoice(voice: string): Promise<string>;
}

export interface SpeechPipeline {
  synthesize(text: string, request?: Omit<SpeechRequest, "text">): Promise<SpeechResult>;
  listVoices(): Promise<Voice[]>;
  resolveVoice(voice: string): Promise<string>;
}
