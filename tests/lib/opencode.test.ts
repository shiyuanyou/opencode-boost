import { describe, it, expect, vi, beforeEach } from "vitest";

import { parseExportOutput, parseSessionList, parseRunEventStream, listSessions, parseModelsOutput } from "../../src/lib/opencode.js";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";

describe("parseExportOutput", () => {
  it("strips the 'Exporting session:' prefix line", () => {
    const raw = `Exporting session: ses_abc\n{"info":{"id":"ses_abc"},"messages":[]}`;
    const result = parseExportOutput(raw);
    expect(result.info.id).toBe("ses_abc");
  });

  it("handles output without prefix line", () => {
    const raw = `{"info":{"id":"ses_abc"},"messages":[]}`;
    const result = parseExportOutput(raw);
    expect(result.info.id).toBe("ses_abc");
  });
});

describe("parseSessionList", () => {
  it("parses a valid session list JSON array", () => {
    const raw = JSON.stringify([
      { id: "ses_abc", title: "Test", updated: 1000, created: 900, projectId: "p1", directory: "/proj" },
    ]);
    const sessions = parseSessionList(raw);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe("ses_abc");
  });
});

describe("parseRunEventStream", () => {
  it("extracts session-id and assistant text from event stream", () => {
    const lines = [
      JSON.stringify({ type: "session", session: { id: "ses_new123" } }),
      JSON.stringify({ type: "message", message: { id: "msg_001", role: "user" } }),
      JSON.stringify({ type: "assistant", content: [{ type: "text", text: "Hello " }] }),
      JSON.stringify({ type: "assistant", content: [{ type: "text", text: "world" }] }),
      JSON.stringify({ type: "summary", cost: 0 }),
    ].join("\n");
    const result = parseRunEventStream(lines);
    expect(result.sessionId).toBe("ses_new123");
    expect(result.text).toBe("Hello world");
  });

  it("returns empty text when no assistant events", () => {
    const lines = [
      JSON.stringify({ type: "session", session: { id: "ses_abc" } }),
      JSON.stringify({ type: "summary", cost: 0 }),
    ].join("\n");
    const result = parseRunEventStream(lines);
    expect(result.sessionId).toBe("ses_abc");
    expect(result.text).toBe("");
  });

  it("throws when no session event found", () => {
    const lines = JSON.stringify({ type: "message", message: { id: "msg_001" } });
    expect(() => parseRunEventStream(lines)).toThrow("No session event found");
  });
});

describe("listSessions", () => {
  const sessions = [
    { id: "ses_aaa", title: "A", updated: 1000, created: 900, projectId: "p1", directory: "/proj1" },
    { id: "ses_bbb", title: "B", updated: 2000, created: 800, projectId: "p1", directory: "/proj2" },
    { id: "ses_ccc", title: "C", updated: 3000, created: 700, projectId: "p1", directory: "/proj1" },
  ];

  beforeEach(() => {
    vi.mocked(execa).mockResolvedValue({
      stdout: JSON.stringify(sessions),
    } as Awaited<ReturnType<typeof execa>>);
  });

  it("returns all sessions when no cwd provided", async () => {
    const result = await listSessions();
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.id)).toEqual(["ses_aaa", "ses_bbb", "ses_ccc"]);
  });

  it("filters sessions by cwd when provided", async () => {
    const result = await listSessions("/proj1");
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(["ses_aaa", "ses_ccc"]);
  });

  it("returns empty array when no sessions match cwd", async () => {
    const result = await listSessions("/other");
    expect(result).toHaveLength(0);
  });
});

describe("parseModelsOutput", () => {
  it("parses models verbose output with JSON metadata", () => {
    const raw = [
      "opencode/big-pickle",
      '{"name":"Big Pickle","cost":0}',
      "zai-coding-plan/glm-5.1",
      '{"name":"GLM-5.1","cost":0.5}',
    ].join("\n");

    const models = parseModelsOutput(raw);
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe("opencode/big-pickle");
    expect(models[0].providerID).toBe("opencode");
    expect(models[0].modelID).toBe("big-pickle");
    expect(models[0].name).toBe("Big Pickle");
    expect(models[0].cost).toBe(0);
    expect(models[1].name).toBe("GLM-5.1");
    expect(models[1].cost).toBe(0.5);
  });

  it("uses modelID as name when no JSON metadata", () => {
    const raw = "opencode/some-model\n";
    const models = parseModelsOutput(raw);
    expect(models).toHaveLength(1);
    expect(models[0].name).toBe("some-model");
  });

  it("skips lines without slash", () => {
    const raw = "not-a-model\nopencode/good-one\n";
    const models = parseModelsOutput(raw);
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("opencode/good-one");
  });

  it("returns empty array for empty input", () => {
    expect(parseModelsOutput("")).toHaveLength(0);
  });
});
