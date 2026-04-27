import { TtsError } from "../core/errors.js";
import type { Voice } from "../core/types.js";

export const OPENAI_VOICES: Voice[] = [
  { id: "alloy", name: "Alloy", labels: ["Neutral and balanced"], category: "OpenAI TTS" },
  { id: "ash", name: "Ash", labels: ["Enthusiastic and energetic"], category: "OpenAI TTS" },
  { id: "ballad", name: "Ballad", labels: ["Warm and soulful"], category: "OpenAI TTS" },
  { id: "coral", name: "Coral", labels: ["Friendly and approachable"], category: "OpenAI TTS" },
  { id: "echo", name: "Echo", labels: ["Smooth and articulate"], category: "OpenAI TTS" },
  { id: "fable", name: "Fable", labels: ["Expressive and animated"], category: "OpenAI TTS" },
  { id: "nova", name: "Nova", labels: ["Warm and friendly"], category: "OpenAI TTS" },
  { id: "onyx", name: "Onyx", labels: ["Deep and authoritative"], category: "OpenAI TTS" },
  { id: "sage", name: "Sage", labels: ["Calm and wise"], category: "OpenAI TTS" },
  { id: "shimmer", name: "Shimmer", labels: ["Soft and gentle"], category: "OpenAI TTS" },
  { id: "verse", name: "Verse", labels: ["Clear and melodic"], category: "OpenAI TTS" },
  { id: "marin", name: "Marin", labels: ["Gentle and soothing"], category: "OpenAI TTS" },
  { id: "cedar", name: "Cedar", labels: ["Rich and resonant"], category: "OpenAI TTS" },
];

export const GEMINI_VOICES: Voice[] = [
  { id: "Zephyr", name: "Zephyr", labels: ["Bright"], category: "Gemini TTS" },
  { id: "Puck", name: "Puck", labels: ["Upbeat"], category: "Gemini TTS" },
  { id: "Charon", name: "Charon", labels: ["Informative"], category: "Gemini TTS" },
  { id: "Kore", name: "Kore", labels: ["Firm"], category: "Gemini TTS" },
  { id: "Fenrir", name: "Fenrir", labels: ["Excitable"], category: "Gemini TTS" },
  { id: "Leda", name: "Leda", labels: ["Youthful"], category: "Gemini TTS" },
  { id: "Orus", name: "Orus", labels: ["Firm"], category: "Gemini TTS" },
  { id: "Aoede", name: "Aoede", labels: ["Breezy"], category: "Gemini TTS" },
  { id: "Callirrhoe", name: "Callirrhoe", labels: ["Easy-going"], category: "Gemini TTS" },
  { id: "Autonoe", name: "Autonoe", labels: ["Bright"], category: "Gemini TTS" },
  { id: "Enceladus", name: "Enceladus", labels: ["Breathy"], category: "Gemini TTS" },
  { id: "Iapetus", name: "Iapetus", labels: ["Clear"], category: "Gemini TTS" },
  { id: "Umbriel", name: "Umbriel", labels: ["Easy-going"], category: "Gemini TTS" },
  { id: "Algieba", name: "Algieba", labels: ["Smooth"], category: "Gemini TTS" },
  { id: "Despina", name: "Despina", labels: ["Smooth"], category: "Gemini TTS" },
  { id: "Erinome", name: "Erinome", labels: ["Clear"], category: "Gemini TTS" },
  { id: "Algenib", name: "Algenib", labels: ["Gravelly"], category: "Gemini TTS" },
  { id: "Rasalgethi", name: "Rasalgethi", labels: ["Informative"], category: "Gemini TTS" },
  { id: "Laomedeia", name: "Laomedeia", labels: ["Upbeat"], category: "Gemini TTS" },
  { id: "Achernar", name: "Achernar", labels: ["Soft"], category: "Gemini TTS" },
  { id: "Alnilam", name: "Alnilam", labels: ["Firm"], category: "Gemini TTS" },
  { id: "Schedar", name: "Schedar", labels: ["Even"], category: "Gemini TTS" },
  { id: "Gacrux", name: "Gacrux", labels: ["Mature"], category: "Gemini TTS" },
  { id: "Pulcherrima", name: "Pulcherrima", labels: ["Forward"], category: "Gemini TTS" },
  { id: "Achird", name: "Achird", labels: ["Friendly"], category: "Gemini TTS" },
  { id: "Zubenelgenubi", name: "Zubenelgenubi", labels: ["Casual"], category: "Gemini TTS" },
  { id: "Vindemiatrix", name: "Vindemiatrix", labels: ["Gentle"], category: "Gemini TTS" },
  { id: "Sadachbia", name: "Sadachbia", labels: ["Lively"], category: "Gemini TTS" },
  { id: "Sadaltager", name: "Sadaltager", labels: ["Knowledgeable"], category: "Gemini TTS" },
  { id: "Sulafat", name: "Sulafat", labels: ["Warm"], category: "Gemini TTS" },
];

export const DEEPGRAM_VOICES: Voice[] = [
  {
    id: "aura-2-thalia-en",
    name: "Thalia",
    labels: ["en", "American", "Feminine; clear, confident, energetic"],
    category: "Deepgram Aura-2",
  },
  {
    id: "aura-2-andromeda-en",
    name: "Andromeda",
    labels: ["en", "American", "Feminine; casual, expressive, comfortable"],
    category: "Deepgram Aura-2",
  },
  {
    id: "aura-2-helena-en",
    name: "Helena",
    labels: ["en", "American", "Feminine; caring, natural, friendly"],
    category: "Deepgram Aura-2",
  },
  {
    id: "aura-2-apollo-en",
    name: "Apollo",
    labels: ["en", "American", "Masculine; confident, comfortable, casual"],
    category: "Deepgram Aura-2",
  },
  {
    id: "aura-2-arcas-en",
    name: "Arcas",
    labels: ["en", "American", "Masculine; natural, smooth, clear"],
    category: "Deepgram Aura-2",
  },
  {
    id: "aura-2-aries-en",
    name: "Aries",
    labels: ["en", "American", "Masculine; warm, energetic, caring"],
    category: "Deepgram Aura-2",
  },
  {
    id: "aura-asteria-en",
    name: "Asteria (Aura-1)",
    labels: ["en", "American", "Feminine; clear, confident, knowledgeable"],
    category: "Deepgram Aura-1",
  },
  {
    id: "aura-luna-en",
    name: "Luna (Aura-1)",
    labels: ["en", "American", "Feminine; friendly, natural, engaging"],
    category: "Deepgram Aura-1",
  },
];

export function resolveStaticVoice(provider: string, voices: Voice[], input: string): string {
  const query = input.trim().toLowerCase();
  const exact = voices.find((voice) => voice.id.toLowerCase() === query || voice.name.toLowerCase() === query);
  if (exact) return exact.id;

  const partial = voices.filter((voice) => voice.id.toLowerCase().includes(query) || voice.name.toLowerCase().includes(query));
  if (partial.length === 1) return partial[0]!.id;
  if (partial.length > 1) {
    throw new TtsError(`Ambiguous voice '${input}' for ${provider}: ${partial.map((voice) => voice.id).join(", ")}`, "invalid_voice", {
      provider,
      retryable: false,
    });
  }

  throw new TtsError(`Voice '${input}' not found for ${provider}`, "invalid_voice", { provider, retryable: false });
}
