import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/opencode.js", () => ({
  injectMessage: vi.fn(),
}));

vi.mock("../../src/lib/data-access.js", () => ({
  getSessionData: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
  readState: vi.fn(),
  readNames: vi.fn(),
}));

vi.mock("../../src/lib/ref.js", () => ({
  resolveRef: vi.fn(),
}));

vi.mock("../../src/lib/summarizer.js", () => ({
  extractMessageTexts: vi.fn(),
}));

import { injectMessage } from "../../src/lib/opencode.js";
import { getSessionData } from "../../src/lib/data-access.js";
import { readState, readNames } from "../../src/lib/store.js";
import { resolveRef } from "../../src/lib/ref.js";
import { extractMessageTexts } from "../../src/lib/summarizer.js";
import { pickCommand } from "../../src/commands/pick.js";

function msg(id: string, parentID: string | undefined, role: "user" | "assistant", text: string) {
  return {
    info: { id, sessionID: "ses_src", parentID, role, time: { created: 1000 } },
    parts: [{ type: "text", text, id: `prt_${id}`, sessionID: "ses_src", messageID: id }],
  };
}

describe("pickCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("picks specific messages and injects into current session", async () => {
    vi.mocked(resolveRef).mockResolvedValueOnce("ses_src");
    vi.mocked(readState).mockResolvedValue({ "/proj": { current: "cur" } });
    vi.mocked(readNames).mockResolvedValue({ "/proj": { cur: "ses_cur" } });
    vi.mocked(getSessionData).mockResolvedValue({
      info: { id: "ses_src" } as any,
      messages: [
        msg("m1", undefined, "user", "hello"),
        msg("m2", "m1", "assistant", "hi"),
        msg("m3", "m2", "user", "world"),
      ],
    });
    vi.mocked(extractMessageTexts).mockReturnValue("[User]: hello\n[Assistant]: hi");
    vi.mocked(injectMessage).mockResolvedValue({ sessionId: "ses_cur", text: "" });

    await pickCommand("source", "/proj", { m: "1,2" });

    expect(getSessionData).toHaveBeenCalledWith("ses_src");
    expect(extractMessageTexts).toHaveBeenCalledTimes(1);
    expect(injectMessage).toHaveBeenCalledWith("ses_cur", expect.stringContaining("[User]: hello"));
  });

  it("throws when no current session", async () => {
    vi.mocked(resolveRef).mockResolvedValueOnce("ses_src");
    vi.mocked(readState).mockResolvedValue({});

    await expect(pickCommand("source", "/proj", { m: "1" })).rejects.toThrow("No current session");
  });

  it("throws on invalid message numbers", async () => {
    vi.mocked(resolveRef).mockResolvedValueOnce("ses_src");
    vi.mocked(readState).mockResolvedValue({ "/proj": { current: "cur" } });
    vi.mocked(readNames).mockResolvedValue({ "/proj": { cur: "ses_cur" } });
    vi.mocked(getSessionData).mockResolvedValue({
      info: { id: "ses_src" } as any,
      messages: [msg("m1", undefined, "user", "hello")],
    });

    await expect(pickCommand("source", "/proj", { m: "abc" })).rejects.toThrow("Invalid message numbers");
  });

  it("throws when requested messages not found", async () => {
    vi.mocked(resolveRef).mockResolvedValueOnce("ses_src");
    vi.mocked(readState).mockResolvedValue({ "/proj": { current: "cur" } });
    vi.mocked(readNames).mockResolvedValue({ "/proj": { cur: "ses_cur" } });
    vi.mocked(getSessionData).mockResolvedValue({
      info: { id: "ses_src" } as any,
      messages: [msg("m1", undefined, "user", "hello")],
    });

    await expect(pickCommand("source", "/proj", { m: "99" })).rejects.toThrow("Messages not found: 99");
  });
});
