import { describe, it, expect } from "vitest";
import { repairChain, rebuildExportJson, type RebasePlanEntry } from "../../src/lib/chain.js";
import type { ExportedMessage, ExportedSession } from "../../src/types.js";

function msg(id: string, parentID: string | undefined, role: "user" | "assistant", text: string): ExportedMessage {
  return {
    info: { id, sessionID: "ses_x", parentID, role, time: { created: 1000 } },
    parts: [{ type: "text", text, id: `prt_${id}`, sessionID: "ses_x", messageID: id }],
  };
}

function makeExport(messages: ExportedMessage[]): ExportedSession {
  return {
    info: { id: "ses_x", slug: "test", projectID: "global", directory: "/proj", title: "test", version: "1.0.0", time: { created: 1000, updated: 1000 } },
    messages,
  };
}

describe("repairChain", () => {
  it("keeps all messages when all actions are keep", () => {
    const messages = [
      msg("m1", undefined, "user", "hello"),
      msg("m2", "m1", "assistant", "hi"),
      msg("m3", "m2", "user", "world"),
    ];
    const plan: RebasePlanEntry[] = messages.map((m, i) => ({
      seq: i + 1,
      action: "keep" as const,
      message: m,
    }));

    const result = repairChain(messages, plan);
    expect(result).toHaveLength(3);
    expect(result[0].info.id).toBe("m1");
    expect(result[2].info.parentID).toBe("m2");
  });

  it("drops messages and repairs chain", () => {
    const messages = [
      msg("m1", undefined, "user", "hello"),
      msg("m2", "m1", "assistant", "hi"),
      msg("m3", "m2", "user", "world"),
    ];
    const plan: RebasePlanEntry[] = [
      { seq: 1, action: "keep", message: messages[0] },
      { seq: 2, action: "drop", message: messages[1] },
      { seq: 3, action: "keep", message: messages[2] },
    ];

    const result = repairChain(messages, plan);
    expect(result).toHaveLength(2);
    expect(result[0].info.id).toBe("m1");
    expect(result[1].info.id).toBe("m3");
    expect(result[1].info.parentID).toBe("m1");
  });

  it("compacts adjacent messages into summary", () => {
    const messages = [
      msg("m1", undefined, "user", "hello"),
      msg("m2", "m1", "assistant", "hi"),
      msg("m3", "m2", "user", "try this"),
      msg("m4", "m3", "assistant", "ok done"),
    ];
    const plan: RebasePlanEntry[] = [
      { seq: 1, action: "keep", message: messages[0] },
      { seq: 2, action: "compact", message: messages[1] },
      { seq: 3, action: "compact", message: messages[2] },
      { seq: 4, action: "keep", message: messages[3] },
    ];

    const result = repairChain(messages, plan);
    expect(result).toHaveLength(3);

    expect(result[0].info.id).toBe("m1");

    expect(result[1].info.id).toMatch(/^msg_ocb_/);
    expect(result[1].info.role).toBe("user");
    expect(result[1].info.parentID).toBe("m1");

    const textPart = result[1].parts.find((p) => p.type === "text");
    expect(textPart?.text).toContain("[OCB \u6458\u8981]");

    expect(result[2].info.id).toBe("m4");
    expect(result[2].info.parentID).toBe(result[1].info.id);
  });

  it("compacts all messages including root", () => {
    const messages = [
      msg("m1", undefined, "user", "hello"),
      msg("m2", "m1", "assistant", "hi"),
    ];
    const plan: RebasePlanEntry[] = [
      { seq: 1, action: "compact", message: messages[0] },
      { seq: 2, action: "compact", message: messages[1] },
    ];

    const result = repairChain(messages, plan);
    expect(result).toHaveLength(1);
    expect(result[0].info.role).toBe("user");
  });

  it("drops root message and keeps child with undefined parent", () => {
    const messages = [
      msg("m1", undefined, "user", "hello"),
      msg("m2", "m1", "assistant", "hi"),
    ];
    const plan: RebasePlanEntry[] = [
      { seq: 1, action: "drop", message: messages[0] },
      { seq: 2, action: "keep", message: messages[1] },
    ];

    const result = repairChain(messages, plan);
    expect(result).toHaveLength(1);
    expect(result[0].info.id).toBe("m2");
  });

  it("handles empty plan", () => {
    const messages = [msg("m1", undefined, "user", "hello")];
    const result = repairChain(messages, []);
    expect(result).toHaveLength(0);
  });
});

describe("rebuildExportJson", () => {
  it("clears session-level id and message-level sessionIDs", () => {
    const messages = [
      msg("m1", undefined, "user", "hello"),
    ];
    const exported = makeExport(messages);

    const rebuilt = rebuildExportJson(exported, messages);
    expect((rebuilt.info as Record<string, unknown>).id).toBeUndefined();
    expect(rebuilt.messages[0].info.sessionID).toBeUndefined();
  });

  it("preserves messages", () => {
    const messages = [
      msg("m1", undefined, "user", "hello"),
      msg("m2", "m1", "assistant", "hi"),
    ];
    const exported = makeExport(messages);
    const rebuilt = rebuildExportJson(exported, messages);
    expect(rebuilt.messages).toHaveLength(2);
  });
});
