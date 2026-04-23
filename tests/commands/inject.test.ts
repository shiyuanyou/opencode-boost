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
  extractKnowledge: vi.fn(),
  extractMessageTexts: vi.fn(),
}));

import { injectMessage } from "../../src/lib/opencode.js";
import { getSessionData } from "../../src/lib/data-access.js";
import { readState, readNames } from "../../src/lib/store.js";
import { resolveRef } from "../../src/lib/ref.js";
import { extractKnowledge, extractMessageTexts } from "../../src/lib/summarizer.js";
import { injectCommand } from "../../src/commands/inject.js";

function msg(id: string, parentID: string | undefined, role: "user" | "assistant", text: string) {
  return {
    info: { id, sessionID: "ses_src", parentID, role, time: { created: 1000 } },
    parts: [{ type: "text", text, id: `prt_${id}`, sessionID: "ses_src", messageID: id }],
  };
}

describe("injectCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("extracts knowledge and injects into target session", async () => {
    vi.mocked(resolveRef)
      .mockResolvedValueOnce("ses_src")
      .mockResolvedValueOnce("ses_tgt");
    vi.mocked(getSessionData).mockResolvedValue({
      info: { id: "ses_src" } as any,
      messages: [msg("m1", undefined, "user", "hello")],
    });
    vi.mocked(extractKnowledge).mockResolvedValue("knowledge summary");
    vi.mocked(injectMessage).mockResolvedValue({ sessionId: "ses_tgt", text: "" });

    await injectCommand("source", "target", "/proj", {});

    expect(resolveRef).toHaveBeenCalledWith("source", "/proj");
    expect(resolveRef).toHaveBeenCalledWith("target", "/proj");
    expect(getSessionData).toHaveBeenCalledWith("ses_src");
    expect(extractKnowledge).toHaveBeenCalledTimes(1);
    expect(injectMessage).toHaveBeenCalledWith("ses_tgt", expect.stringContaining("knowledge summary"));
  });

  it("uses raw mode with extractMessageTexts", async () => {
    vi.mocked(resolveRef)
      .mockResolvedValueOnce("ses_src")
      .mockResolvedValueOnce("ses_tgt");
    vi.mocked(getSessionData).mockResolvedValue({
      info: { id: "ses_src" } as any,
      messages: [msg("m1", undefined, "user", "hello")],
    });
    vi.mocked(extractMessageTexts).mockReturnValue("[User]: hello");
    vi.mocked(injectMessage).mockResolvedValue({ sessionId: "ses_tgt", text: "" });

    await injectCommand("source", "target", "/proj", { raw: true });

    expect(extractMessageTexts).toHaveBeenCalledTimes(1);
    expect(extractKnowledge).not.toHaveBeenCalled();
    expect(injectMessage).toHaveBeenCalledWith("ses_tgt", expect.stringContaining("[User]: hello"));
  });

  it("defaults target to current session when targetRef is undefined", async () => {
    vi.mocked(resolveRef).mockResolvedValueOnce("ses_src");
    vi.mocked(readState).mockResolvedValue({ "/proj": { current: "cur" } });
    vi.mocked(readNames).mockResolvedValue({ "/proj": { cur: "ses_cur" } });
    vi.mocked(getSessionData).mockResolvedValue({
      info: { id: "ses_src" } as any,
      messages: [msg("m1", undefined, "user", "hello")],
    });
    vi.mocked(extractKnowledge).mockResolvedValue("summary");
    vi.mocked(injectMessage).mockResolvedValue({ sessionId: "ses_cur", text: "" });

    await injectCommand("source", undefined, "/proj", {});

    expect(injectMessage).toHaveBeenCalledWith("ses_cur", expect.any(String));
  });

  it("throws when no targetRef and no current session", async () => {
    vi.mocked(resolveRef).mockResolvedValueOnce("ses_src");
    vi.mocked(readState).mockResolvedValue({});

    await expect(injectCommand("source", undefined, "/proj", {})).rejects.toThrow("No current session");
  });
});
