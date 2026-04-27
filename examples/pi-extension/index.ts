import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createSpeechPipelineFromEnv, saveSpeechResult, type ProviderAlias } from "../../src/node/index.js";
import { playFile } from "../../src/node/playback.js";

interface TtsSpeakParams {
  text: string;
  provider?: string;
  voice?: string;
  play?: boolean;
}

const Type = {
  String(options: Record<string, unknown> = {}) {
    return { type: "string", ...options };
  },
  Boolean(options: Record<string, unknown> = {}) {
    return { type: "boolean", ...options };
  },
  Optional(schema: Record<string, unknown>) {
    return { ...schema, optional: true };
  },
  Object(properties: Record<string, Record<string, unknown>>) {
    const required = Object.entries(properties)
      .filter(([, schema]) => schema.optional !== true)
      .map(([key]) => key);
    const normalizedProperties = Object.fromEntries(
      Object.entries(properties).map(([key, schema]) => {
        const { optional: _optional, ...rest } = schema;
        return [key, rest];
      }),
    );
    return { type: "object", properties: normalizedProperties, required };
  },
};

export default function ttsExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "tts_speak",
    label: "TTS Speak",
    description: "Synthesize speech with @parcom/tts and optionally play it.",
    parameters: Type.Object({
      text: Type.String({ description: "Text to synthesize" }),
      provider: Type.Optional(Type.String({ description: "Provider name; defaults to openai" })),
      voice: Type.Optional(Type.String({ description: "Provider voice" })),
      play: Type.Optional(Type.Boolean({ description: "Play audio after synthesis", default: true })),
    }),
    async execute(_toolCallId, params: TtsSpeakParams) {
      const provider = (params.provider ?? "openai") as ProviderAlias;
      const pipeline = createSpeechPipelineFromEnv({ provider, voice: params.voice });
      const result = await pipeline.synthesize(params.text);
      const outputPath = join(tmpdir(), `parcom-tts-${Date.now()}.${result.format}`);
      await saveSpeechResult(result, outputPath);
      if (params.play ?? true) await playFile(outputPath);
      return {
        content: [{ type: "text", text: `Synthesized ${params.text.length} characters with ${result.provider}/${result.voice}: ${outputPath}` }],
        details: { outputPath, provider: result.provider, voice: result.voice, model: result.model, format: result.format },
      };
    },
  });
}
