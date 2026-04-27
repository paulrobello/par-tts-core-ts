# @paulrobello/par-tts-core-ts pi extension example

This extension registers a `tts_speak` tool that synthesizes text with `@paulrobello/par-tts-core-ts`, saves an audio file, and optionally plays it with Node playback helpers.

Set provider credentials in the environment, for example:

```bash
export OPENAI_API_KEY=...
```

Load with pi:

```bash
pi -e ./examples/pi-extension/index.ts
```
