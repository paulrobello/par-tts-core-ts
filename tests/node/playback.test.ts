import { describe, expect, it } from "vitest";
import { choosePlaybackCommand } from "../../src/node/playback.js";

describe("choosePlaybackCommand", () => {
  it("uses afplay on darwin when available", () => {
    expect(choosePlaybackCommand("darwin", ["afplay", "ffplay"], "speech.wav")).toEqual({
      command: "afplay",
      args: ["speech.wav"],
    });
  });

  it("uses ffplay on linux when available", () => {
    expect(choosePlaybackCommand("linux", ["ffplay"], "speech.wav")).toEqual({
      command: "ffplay",
      args: ["-nodisp", "-autoexit", "-loglevel", "quiet", "speech.wav"],
    });
  });

  it("falls back to mpg123", () => {
    expect(choosePlaybackCommand("linux", ["mpg123"], "speech.mp3")).toEqual({
      command: "mpg123",
      args: ["-q", "speech.mp3"],
    });
  });

  it("returns undefined when no supported player is available", () => {
    expect(choosePlaybackCommand("linux", [], "speech.mp3")).toBeUndefined();
  });
});
