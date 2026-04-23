import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/opencode.js", () => ({
  forkSession: vi.fn(),
  deleteSession: vi.fn(),
  importSession: vi.fn(),
}));

vi.mock("../../src/lib/data-access.js", () => ({
  getSessionData: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
  readNames: vi.fn(),
  writeNames: vi.fn(),
  readState: vi.fn(),
  writeState: vi.fn(),
  readReflog: vi.fn(),
  writeReflog: vi.fn(),
}));

vi.mock("../../src/lib/ref.js", () => ({
  resolveRef: vi.fn(),
}));

vi.mock("../../src/lib/summarizer.js", () => ({
  summarizeMessages: vi.fn(),
}));

import { forkSession, deleteSession, importSession } from "../../src/lib/opencode.js";
import { getSessionData } from "../../src/lib/data-access.js";
import { readNames, readState, readReflog } from "../../src/lib/store.js";
import { resolveRef } from "../../src/lib/ref.js";
import { summarizeMessages } from "../../src/lib/summarizer.js";
import { compactCommand } from "../../src/commands/compact.js";

function msg(id: string, parentID: string | undefined, role: "user" | "assistant", text: string) {
  return {
    info: { id, sessionID: "ses_x", parentID, role, time: { created: 1000 } },
    parts: [{ type: "text", text, id: `prt_${id}`, sessionID: "ses_x", messageID: id }],
  };
}

describe("compactCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("compacts a range of messages with LLM summary", async () => {
    vi.mocked(resolveRef).mockResolvedValue("ses_abc");
    vi.mocked(readNames).mockResolvedValue({ "/proj": { "my-sess": "ses_abc" } });
    vi.mocked(forkSession).mockResolvedValue({ sessionId: "ses_fork", text: "" });
    vi.mocked(getSessionData).mockResolvedValue({
      info: { id: "ses_fork" } as any,
      messages: [
        msg("m1", undefined, "user", "hello"),
        msg("m2", "m1", "assistant", "hi"),
        msg("m3", "m2", "user", "world"),
        msg("m4", "m3", "assistant", "done"),
      ],
    });
    vi.mocked(summarizeMessages).mockResolvedValue("summary of 2-3");
    vi.mocked(importSession).mockResolvedValue("ses_new");
    vi.mocked(readState).mockResolvedValue({ "/proj": { current: "my-sess" } });
    vi.mocked(readReflog).mockResolvedValue({});

    await compactCommand("my-sess", "/proj", { m: "2-3" });

    expect(forkSession).toHaveBeenCalledWith("ses_abc", "ocb-compact-fork", undefined);
    expect(getSessionData).toHaveBeenCalledWith("ses_fork");
    expect(summarizeMessages).toHaveBeenCalledTimes(1);
    expect(importSession).toHaveBeenCalledTimes(1);
    expect(deleteSession).toHaveBeenCalledWith("ses_fork");
  });

  it("compacts with manual summary text", async () => {
    vi.mocked(resolveRef).mockResolvedValue("ses_abc");
    vi.mocked(readNames).mockResolvedValue({ "/proj": { "my-sess": "ses_abc" } });
    vi.mocked(forkSession).mockResolvedValue({ sessionId: "ses_fork", text: "" });
    vi.mocked(getSessionData).mockResolvedValue({
      info: { id: "ses_fork" } as any,
      messages: [
        msg("m1", undefined, "user", "hello"),
        msg("m2", "m1", "assistant", "hi"),
      ],
    });
    vi.mocked(importSession).mockResolvedValue("ses_new");
    vi.mocked(readState).mockResolvedValue({ "/proj": { current: "my-sess" } });
    vi.mocked(readReflog).mockResolvedValue({});

    await compactCommand("my-sess", "/proj", { m: "1-2", manual: "my manual summary" });

    expect(summarizeMessages).not.toHaveBeenCalled();
  });

  it("throws on invalid range format", async () => {
    vi.mocked(resolveRef).mockResolvedValue("ses_abc");

    await expect(compactCommand("my-sess", "/proj", { m: "bad" })).rejects.toThrow("Invalid range");
  });

  it("throws on out-of-bounds range", async () => {
    vi.mocked(resolveRef).mockResolvedValue("ses_abc");
    vi.mocked(readNames).mockResolvedValue({ "/proj": { "my-sess": "ses_abc" } });
    vi.mocked(forkSession).mockResolvedValue({ sessionId: "ses_fork", text: "" });
    vi.mocked(getSessionData).mockResolvedValue({
      info: { id: "ses_fork" } as any,
      messages: [msg("m1", undefined, "user", "hello")],
    });

    await expect(compactCommand("my-sess", "/proj", { m: "1-5" })).rejects.toThrow("Invalid range");
  });
});
