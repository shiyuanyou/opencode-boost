import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildMessageList, showCommand } from "../../src/commands/show.js";
import type { ExportedMessage } from "../../src/types.js";

vi.mock("../../src/lib/data-access.js", () => ({
  getSessionData: vi.fn(),
}));

vi.mock("../../src/lib/ref.js", () => ({
  resolveRef: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
  readState: vi.fn(),
  readNames: vi.fn(),
}));

import { getSessionData } from "../../src/lib/data-access.js";
import { resolveRef } from "../../src/lib/ref.js";
import { readState } from "../../src/lib/store.js";

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

describe("showCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("defaults to current session when ref is undefined", async () => {
    vi.mocked(readState).mockResolvedValue({ "/proj": { current: "my-sess" } });
    vi.mocked(resolveRef).mockResolvedValue("ses_abc");
    vi.mocked(getSessionData).mockResolvedValue({
      info: { id: "ses_abc" } as any,
      messages: [msg("msg_a", undefined, "user", "hi")],
    });

    await showCommand(undefined, "/proj", {});

    expect(resolveRef).toHaveBeenCalledWith("my-sess", "/proj");
  });

  it("throws when no ref and no current session", async () => {
    vi.mocked(readState).mockResolvedValue({});

    await expect(showCommand(undefined, "/proj", {})).rejects.toThrow("No current session");
  });
});
