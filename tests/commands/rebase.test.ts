import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/opencode.js", () => ({
  forkSession: vi.fn(),
  deleteSession: vi.fn(),
  importSession: vi.fn(),
  exportSession: vi.fn(),
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

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

vi.mock("fs/promises", () => {
  const fns = {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(""),
    unlink: vi.fn().mockResolvedValue(undefined),
  };
  return { ...fns, default: fns };
});

import { forkSession, deleteSession, importSession, exportSession } from "../../src/lib/opencode.js";
import { readNames, readState, readReflog } from "../../src/lib/store.js";
import { resolveRef } from "../../src/lib/ref.js";
import { rebaseCommand } from "../../src/commands/rebase.js";
import * as fsPromises from "fs/promises";

function msg(id: string, parentID: string | undefined, role: "user" | "assistant", text: string) {
  return {
    info: { id, sessionID: "ses_x", parentID, role, time: { created: 1000 } },
    parts: [{ type: "text", text, id: `prt_${id}`, sessionID: "ses_x", messageID: id }],
  };
}

describe("rebaseCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(fsPromises.readFile).mockResolvedValue("# comments\n");
    vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
    vi.mocked(fsPromises.unlink).mockResolvedValue(undefined);
  });

  it("creates a fork, opens editor, then aborts when plan is empty", async () => {
    vi.mocked(resolveRef).mockResolvedValue("ses_abc");
    vi.mocked(readNames).mockResolvedValue({ "/proj": { "my-sess": "ses_abc" } });
    vi.mocked(forkSession).mockResolvedValue({ sessionId: "ses_fork", text: "" });
    vi.mocked(exportSession).mockResolvedValue({
      info: { id: "ses_fork" } as any,
      messages: [msg("m1", undefined, "user", "hello"), msg("m2", "m1", "assistant", "hi")],
    });

    await rebaseCommand("my-sess", "/proj", {});

    expect(forkSession).toHaveBeenCalledWith("ses_abc", "ocb-rebase-fork", undefined);
    expect(exportSession).toHaveBeenCalledWith("ses_fork");
    expect(importSession).not.toHaveBeenCalled();
    expect(deleteSession).toHaveBeenCalledWith("ses_fork");
  });

  it("throws when session has no messages", async () => {
    vi.mocked(resolveRef).mockResolvedValue("ses_abc");
    vi.mocked(readNames).mockResolvedValue({ "/proj": {} });
    vi.mocked(forkSession).mockResolvedValue({ sessionId: "ses_fork", text: "" });
    vi.mocked(exportSession).mockResolvedValue({
      info: { id: "ses_fork" } as any,
      messages: [],
    });

    await expect(rebaseCommand("ses_abc", "/proj", {})).rejects.toThrow("no messages");
  });
});
