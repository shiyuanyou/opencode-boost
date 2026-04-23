import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSessionData, resetReader } from "../../src/lib/data-access.js";

vi.mock("../../src/lib/db-reader.js", () => ({
  openDbReader: vi.fn(),
}));

vi.mock("../../src/lib/retry.js", () => ({
  exportWithRetry: vi.fn(),
}));

import { openDbReader } from "../../src/lib/db-reader.js";
import { exportWithRetry } from "../../src/lib/retry.js";

const fakeSession = {
  info: { id: "ses_123", slug: "", projectID: "", directory: "", title: "", version: "", time: { created: 0, updated: 0 } },
  messages: [],
};

describe("data-access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetReader();
  });

  it("returns session from db-reader when available", async () => {
    const mockReader = {
      getSession: vi.fn().mockReturnValue(fakeSession),
      getMessages: vi.fn().mockReturnValue([]),
      close: vi.fn(),
    };
    vi.mocked(openDbReader).mockReturnValue(mockReader as any);

    const result = await getSessionData("ses_123");
    expect(result).toBe(fakeSession);
    expect(exportWithRetry).not.toHaveBeenCalled();
  });

  it("falls back to exportWithRetry when db-reader returns null", async () => {
    const mockReader = {
      getSession: vi.fn().mockReturnValue(null),
      getMessages: vi.fn().mockReturnValue([]),
      close: vi.fn(),
    };
    vi.mocked(openDbReader).mockReturnValue(mockReader as any);
    vi.mocked(exportWithRetry).mockResolvedValue(fakeSession as any);

    const result = await getSessionData("ses_123");
    expect(result).toBe(fakeSession);
    expect(exportWithRetry).toHaveBeenCalledWith("ses_123");
  });

  it("falls back to exportWithRetry when db-reader is unavailable", async () => {
    vi.mocked(openDbReader).mockReturnValue(null);
    vi.mocked(exportWithRetry).mockResolvedValue(fakeSession as any);

    const result = await getSessionData("ses_123");
    expect(result).toBe(fakeSession);
    expect(exportWithRetry).toHaveBeenCalledWith("ses_123");
  });

  it("caches reader across multiple calls", async () => {
    const mockReader = {
      getSession: vi.fn().mockReturnValue(fakeSession),
      getMessages: vi.fn().mockReturnValue([]),
      close: vi.fn(),
    };
    vi.mocked(openDbReader).mockReturnValue(mockReader as any);

    await getSessionData("ses_1");
    await getSessionData("ses_2");

    expect(openDbReader).toHaveBeenCalledTimes(1);
    expect(mockReader.getSession).toHaveBeenCalledTimes(2);
  });
});
