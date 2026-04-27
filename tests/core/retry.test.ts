import { describe, expect, it } from "vitest";
import { TtsError } from "../../src/core/errors.js";
import { calculateRetryDelay, runWithRetry } from "../../src/core/retry.js";

describe("calculateRetryDelay", () => {
  it("allows max backoff below the initial backoff", () => {
    expect(calculateRetryDelay(10, 5, 0)).toBe(5);
  });

  it("uses uncapped exponential backoff when max backoff is omitted", () => {
    expect(calculateRetryDelay(10, undefined, 2)).toBe(40);
  });
});

describe("runWithRetry", () => {
  it("retries retryable errors and returns the successful value", async () => {
    let calls = 0;
    const result = await runWithRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new TtsError("temporary", "transport_error", { retryable: true });
        return "ok";
      },
      { attempts: 2, backoffMs: 1 },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry missing API key errors", async () => {
    let calls = 0;
    await expect(
      runWithRetry(
        async () => {
          calls += 1;
          throw new TtsError("missing", "missing_api_key", { retryable: false });
        },
        { attempts: 3, backoffMs: 1 },
      ),
    ).rejects.toMatchObject({ code: "missing_api_key" });
    expect(calls).toBe(1);
  });
});
