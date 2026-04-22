import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportWithRetry } from "../../src/lib/retry.js";

vi.mock("../../src/lib/opencode.js", () => ({
  exportSession: vi.fn(),
}));

import { exportSession } from "../../src/lib/opencode.js";

describe("exportWithRetry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retries up to maxAttempts then throws actionable error", async () => {
    vi.mocked(exportSession).mockRejectedValue(new Error("truncated"));
    vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(exportWithRetry("ses_x", 2, 10)).rejects.toThrow("First switch to another session");
    expect(exportSession).toHaveBeenCalledTimes(2);
  });

  it("succeeds on retry", async () => {
    vi.mocked(exportSession)
      .mockRejectedValueOnce(new Error("truncated"))
      .mockResolvedValueOnce({ info: { id: "x" }, messages: [] } as any);
    vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await exportWithRetry("ses_x", 3, 10);
    expect(result.info.id).toBe("x");
  });

  it("passes through non-truncation errors immediately", async () => {
    vi.mocked(exportSession).mockRejectedValue(new Error("some other error"));

    await expect(exportWithRetry("ses_x", 3, 10)).rejects.toThrow("some other error");
    expect(exportSession).toHaveBeenCalledTimes(1);
  });
});
