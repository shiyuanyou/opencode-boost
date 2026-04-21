import { describe, it, expect, vi } from "vitest";

// We test the parsing logic, not the subprocess itself
import { parseExportOutput, parseSessionList } from "../../src/lib/opencode.js";

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
