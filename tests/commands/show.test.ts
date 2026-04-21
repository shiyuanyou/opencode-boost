import { describe, it, expect } from "vitest";
import { buildMessageList } from "../../src/commands/show.js";
import type { ExportedMessage } from "../../src/types.js";

function msg(id: string, parentID: string | undefined, role: "user" | "assistant", text: string): ExportedMessage {
  return {
    info: { id, sessionID: "ses_x", parentID, role, time: { created: 1000 } },
    parts: [{ type: "text", text, id: "prt_x", sessionID: "ses_x", messageID: id }],
  };
}

describe("buildMessageList", () => {
  it("sorts messages by parentID chain", () => {
    const messages = [
      msg("msg_b", "msg_a", "assistant", "reply"),
      msg("msg_a", undefined, "user", "hello"),
    ];
    const list = buildMessageList(messages);
    expect(list[0].info.id).toBe("msg_a");
    expect(list[1].info.id).toBe("msg_b");
  });

  it("assigns 1-based sequence numbers", () => {
    const messages = [msg("msg_a", undefined, "user", "hello")];
    const list = buildMessageList(messages);
    expect(list[0].seq).toBe(1);
  });
});
