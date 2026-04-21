import { describe, it, expect, vi } from "vitest";

// We test the parsing logic, not the subprocess itself
import { parseExportOutput, parseSessionList, parseRunEventStream } from "../../src/lib/opencode.js";

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
