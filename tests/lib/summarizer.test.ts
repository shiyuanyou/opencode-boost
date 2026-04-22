import { describe, it, expect } from "vitest";
import { extractMessageTexts } from "../../src/lib/summarizer.js";
import type { ExportedMessage } from "../../src/types.js";

function msg(id: string, parentID: string | undefined, role: "user" | "assistant", text: string): ExportedMessage {
  return {
    info: { id, sessionID: "ses_x", parentID, role, time: { created: 1000 } },
    parts: [{ type: "text", text, id: `prt_${id}`, sessionID: "ses_x", messageID: id }],
  };
}

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
