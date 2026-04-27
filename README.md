# @paulrobello/par-tts-core-ts

Provider-neutral TypeScript text-to-speech library for Node, browsers through a proxy, and pi extensions.

## Install

```bash
bun add @paulrobello/par-tts-core-ts
```

## Pipeline-first usage

The root API is browser-safe and does not read `process.env`. In Node/server code, pass credentials explicitly:

```ts
import { createSpeechPipeline } from "@paulrobello/par-tts-core-ts";

const pipeline = createSpeechPipeline({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY!,
});

const result = await pipeline.synthesize("Hello from @paulrobello/par-tts-core-ts", {
  voice: "nova",
  options: { format: "mp3" },
});
```

For browser apps, do not ship provider API keys. Use the proxy transport shown below.

## Node env, save, and playback

Node-only helpers can read provider settings from environment variables, save audio, and play audio with a local command (`afplay`, `ffplay`, or `mpg123`):

```ts
import { createSpeechPipelineFromEnv, saveSpeechResult } from "@paulrobello/par-tts-core-ts/node";
import { playFile, playSpeechResult } from "@paulrobello/par-tts-core-ts/playback";

const pipeline = createSpeechPipelineFromEnv({ provider: "openai" });
const result = await pipeline.synthesize("Saved and played from Node.");

const filePath = await saveSpeechResult(result, "speech.mp3");
await playFile(filePath);

// Or save and play in one call:
await playSpeechResult(result, "speech-again.mp3");
```

## Browser proxy usage

`createTtsProxyHandler` is a low-level transport proxy, not a provider-level synthesis endpoint. Browser code still creates a normal speech pipeline, but sends provider transport requests to your server. The server forwards allowlisted provider requests and injects server-side credentials.

Browser:

```ts
import { createProxyTransport, createSpeechPipeline } from "@paulrobello/par-tts-core-ts";

const pipeline = createSpeechPipeline({
  provider: "openai",
  // Placeholder only: never put a real provider key in browser code.
  apiKey: "proxy",
  transport: createProxyTransport("/api/tts"),
});

const result = await pipeline.synthesize("Hello through a proxy.");
```

Server route:

```ts
import { createTtsProxyHandler } from "@paulrobello/par-tts-core-ts/proxy";

export const POST = createTtsProxyHandler({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
  },
});
```

The proxy strips sensitive client headers, validates upstream provider hosts, and applies the configured server credential for the requested provider.

## pi extension example

See `examples/pi-extension` for a pi extension that registers a `tts_speak` tool. It can be loaded directly during development, or copied into `.pi/extensions/tts` for local pi extension use.

## Providers

Canonical provider names:

- `openai`
- `elevenlabs`
- `deepgram`
- `gemini`
- `kokoro-onnx`

`kokoro` is accepted as an alias for `kokoro-onnx`. Kokoro ONNX support is available from `@paulrobello/par-tts-core-ts/node` and uses the optional `kokoro-js` dependency.

## Environment variables

Cloud providers:

- OpenAI: `OPENAI_API_KEY`, optional `OPENAI_VOICE_ID`
- ElevenLabs: `ELEVENLABS_API_KEY`, optional `ELEVENLABS_VOICE_ID`
- Deepgram: `DEEPGRAM_API_KEY` or `DG_API_KEY`, optional `DEEPGRAM_VOICE_ID`
- Gemini: `GEMINI_API_KEY` or `GOOGLE_API_KEY`, optional `GEMINI_VOICE_ID`

Kokoro ONNX:

- `KOKORO_MODEL_PATH`
- `KOKORO_VOICE_PATH`
- `KOKORO_VOICE_ID`

## Development

```bash
bun install
bun run check
```
