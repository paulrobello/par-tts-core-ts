import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "node/index": "src/node/index.ts",
    "node/playback": "src/node/playback.ts",
    "src-proxy": "src-proxy.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: "es2022",
  platform: "neutral",
  external: ["kokoro-js"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
