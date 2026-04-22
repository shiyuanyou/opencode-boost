import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractMessageTexts, resolveModel, ensureModelConfig, summarizeMessages, extractKnowledge } from "../../src/lib/summarizer.js";
import { runSession, deleteSession } from "../../src/lib/opencode.js";
import { readConfig } from "../../src/lib/store.js";
import type { ExportedMessage } from "../../src/types.js";

vi.mock("../../src/lib/opencode.js", () => ({
  runSession: vi.fn(),
  deleteSession: vi.fn(),
  importSession: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
  readConfig: vi.fn(),
  writeConfig: vi.fn(),
}));

function msg(id: string, parentID: string | undefined, role: "user" | "assistant", text: string): ExportedMessage {
  return {
    info: { id, sessionID: "ses_x", parentID, role, time: { created: 1000 } },
    parts: [{ type: "text", text, id: `prt_${id}`, sessionID: "ses_x", messageID: id }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extractMessageTexts", () => {
  it("extracts text from messages with role labels", () => {
    const messages = [
      msg("m1", undefined, "user", "hello"),
      msg("m2", "m1", "assistant", "hi there"),
    ];
    const text = extractMessageTexts(messages);
    expect(text).toContain("[User]: hello");
    expect(text).toContain("[Assistant]: hi there");
  });

  it("skips parts without text", () => {
    const msgWithTool: ExportedMessage = {
      info: { id: "m1", sessionID: "ses_x", role: "assistant", time: { created: 1000 } },
      parts: [
        { type: "tool", id: "prt_tool", sessionID: "ses_x", messageID: "m1", callID: "c1", state: { status: "completed" } },
      ],
    };
    const text = extractMessageTexts([msgWithTool]);
    expect(text).toBe("");
  });
});

describe("resolveModel", () => {
  it("resolves known alias via config.models", async () => {
    vi.mocked(readConfig).mockResolvedValue({
      summarizer: { method: "opencode-run", model: "fast" },
      models: { fast: "provider/model-x" },
    });
    expect(await resolveModel("fast")).toBe("provider/model-x");
  });

  it("passes through raw provider/model string when not an alias", async () => {
    vi.mocked(readConfig).mockResolvedValue({
      summarizer: { method: "opencode-run", model: "fast" },
      models: {},
    });
    expect(await resolveModel("some/model")).toBe("some/model");
  });

  it("reads default model from config when no override", async () => {
    vi.mocked(readConfig).mockResolvedValue({
      summarizer: { method: "opencode-run", model: "fast" },
      models: { fast: "provider/model-x" },
    });
    expect(await resolveModel()).toBe("provider/model-x");
  });

  it("returns undefined when no override and no config", async () => {
    vi.mocked(readConfig).mockResolvedValue(null);
    expect(await resolveModel()).toBeUndefined();
  });
});

describe("ensureModelConfig", () => {
  it("returns resolved model when config has model", async () => {
    vi.mocked(readConfig).mockResolvedValue({
      summarizer: { method: "opencode-run", model: "fast" },
      models: { fast: "provider/model-x" },
    });
    expect(await ensureModelConfig()).toBe("provider/model-x");
  });

  it("returns undefined and prints guidance when no config", async () => {
    vi.mocked(readConfig).mockResolvedValue(null);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await ensureModelConfig()).toBeUndefined();
    expect(spy).toHaveBeenCalledWith("No summarizer model configured.");
    spy.mockRestore();
  });
});

describe("summarizeMessages", () => {
  it("calls runSession, deletes temp session, returns text", async () => {
    vi.mocked(readConfig).mockResolvedValue({
      summarizer: { method: "opencode-run", model: "fast" },
      models: { fast: "provider/m" },
    });
    vi.mocked(runSession).mockResolvedValue({ sessionId: "ses_temp", text: "summary result" });
    vi.mocked(deleteSession).mockResolvedValue(undefined);

    const messages = [msg("m1", undefined, "user", "hello")];
    const result = await summarizeMessages(messages, "fast");

    expect(result).toBe("summary result");
    expect(vi.mocked(deleteSession)).toHaveBeenCalledWith("ses_temp");
  });
});

describe("extractKnowledge", () => {
  it("calls runSession with inject prompt, deletes temp session", async () => {
    vi.mocked(readConfig).mockResolvedValue({
      summarizer: { method: "opencode-run", model: "fast" },
      models: { fast: "provider/m" },
    });
    vi.mocked(runSession).mockResolvedValue({ sessionId: "ses_know", text: "knowledge result" });
    vi.mocked(deleteSession).mockResolvedValue(undefined);

    const messages = [msg("m1", undefined, "user", "hello")];
    const result = await extractKnowledge(messages, "fast");

    expect(result).toBe("knowledge result");
    expect(vi.mocked(runSession)).toHaveBeenCalledTimes(1);
    const prompt = vi.mocked(runSession).mock.calls[0][0];
    expect(prompt).toContain("提取关键知识");
    expect(vi.mocked(deleteSession)).toHaveBeenCalledWith("ses_know");
  });
});
