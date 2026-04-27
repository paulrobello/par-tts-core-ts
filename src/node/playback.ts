import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { TtsError } from "../core/errors.js";
import type { SpeechResult } from "../core/types.js";
import { saveSpeechResult } from "./file.js";

export interface PlaybackCommand {
  command: string;
  args: string[];
}

export async function commandExists(command: string): Promise<boolean> {
  const path = process.env.PATH;
  if (!path) return false;

  const candidates = path.split(delimiter).filter(Boolean).map((directory) => join(directory, command));
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return true;
    } catch {
      // Continue searching PATH.
    }
  }
  return false;
}

function hasCommand(available: readonly string[] | ReadonlySet<string>, command: string): boolean {
  return Array.from(available).includes(command);
}

export function choosePlaybackCommand(platform: NodeJS.Platform | string, available: readonly string[] | ReadonlySet<string>, filePath: string): PlaybackCommand | undefined {
  if (platform === "darwin" && hasCommand(available, "afplay")) {
    return { command: "afplay", args: [filePath] };
  }

  if (hasCommand(available, "ffplay")) {
    return { command: "ffplay", args: ["-nodisp", "-autoexit", "-loglevel", "quiet", filePath] };
  }

  if (hasCommand(available, "mpg123")) {
    return { command: "mpg123", args: ["-q", filePath] };
  }

  return undefined;
}

async function availablePlaybackCommands(): Promise<string[]> {
  const commands = ["afplay", "ffplay", "mpg123"];
  const available = await Promise.all(commands.map(async (command) => ((await commandExists(command)) ? command : undefined)));
  return available.filter((command): command is string => command !== undefined);
}

export interface PlayFileOptions {
  platform?: NodeJS.Platform | string;
  availableCommands?: readonly string[] | ReadonlySet<string>;
}

export async function playFile(filePath: string, options: PlayFileOptions = {}): Promise<void> {
  const available = options.availableCommands ?? (await availablePlaybackCommands());
  const playbackCommand = choosePlaybackCommand(options.platform ?? process.platform, available, filePath);
  if (!playbackCommand) {
    throw new TtsError("No supported audio playback command found", "playback_error", { retryable: false });
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(playbackCommand.command, playbackCommand.args, { stdio: "ignore" });

    child.once("error", (cause) => {
      reject(new TtsError(`Failed to start audio playback command '${playbackCommand.command}'`, "playback_error", { cause, retryable: false }));
    });

    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const suffix = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new TtsError(`Audio playback command '${playbackCommand.command}' failed with ${suffix}`, "playback_error", { retryable: false }));
    });
  });
}

export async function playSpeechResult(result: SpeechResult, filePath: string, options?: PlayFileOptions): Promise<string> {
  const savedPath = await saveSpeechResult(result, filePath);
  await playFile(savedPath, options);
  return savedPath;
}
