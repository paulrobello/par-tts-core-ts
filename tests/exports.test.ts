import { describe, expect, it } from "vitest";
import { createProxyTransport, createSpeechPipeline, listProviders } from "../src/index.js";
import { createTtsProxyHandler } from "../src-proxy.js";
import { choosePlaybackCommand } from "../src/node/playback.js";

describe("exports", () => {
  it("exports browser-safe main APIs", () => {
    expect(typeof createSpeechPipeline).toBe("function");
    expect(typeof createProxyTransport).toBe("function");
    expect(listProviders()).toContain("openai");
  });

  it("exports proxy and playback subpath APIs", () => {
    expect(typeof createTtsProxyHandler).toBe("function");
    expect(typeof choosePlaybackCommand).toBe("function");
  });
});
