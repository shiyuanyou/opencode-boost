import crypto from "crypto";
import type { ExportedMessage, ExportedSession } from "../types.js";

export type RebaseAction = "keep" | "compact" | "drop";

export interface RebasePlanEntry {
  seq: number;
  action: RebaseAction;
  message: ExportedMessage;
}

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function repairChain(
  messages: ExportedMessage[],
  plan: RebasePlanEntry[]
): ExportedMessage[] {
  const ancestorMap = new Map<string, string>();

  const root = messages.find((m) => !m.info.parentID);
  if (!root) return [];

  ancestorMap.set(root.info.id, root.info.id);

  const result: ExportedMessage[] = [];

  let compactGroup: RebasePlanEntry[] = [];

  function flushCompactGroup() {
    if (compactGroup.length === 0) return;

    const firstParentId = compactGroup[0].message.info.parentID;
    let resolvedParent: string | undefined;
    if (firstParentId) {
      const ancestor = ancestorMap.get(firstParentId);
      resolvedParent = ancestor;
    }

    const sessionId = root.info.sessionID;
    const newMsgId = generateId("msg_ocb");
    const newPartId = generateId("prt_ocb");

    const texts: string[] = [];
    for (const entry of compactGroup) {
      for (const part of entry.message.parts) {
        if (part.type === "text" && part.text) texts.push(part.text);
      }
    }

    const summaryText = `[OCB 摘要] ${texts.join("\n")}`;

    const summaryMsg: ExportedMessage = {
      info: {
        id: newMsgId,
        sessionID: sessionId,
        parentID: resolvedParent,
        role: "user",
        time: {
          created: compactGroup[0].message.info.time.created,
          completed: compactGroup[compactGroup.length - 1].message.info.time.created + 1,
        },
      },
      parts: [
        {
          type: "text",
          text: summaryText,
          id: newPartId,
          sessionID: sessionId,
          messageID: newMsgId,
        },
      ],
    };

    for (const entry of compactGroup) {
      ancestorMap.set(entry.message.info.id, newMsgId);
    }

    result.push(summaryMsg);
    ancestorMap.set(newMsgId, newMsgId);
    compactGroup = [];
  }

  for (const entry of plan) {
    if (entry.action === "keep") {
      flushCompactGroup();
      const msg = structuredClone(entry.message);
      const originalParent = msg.info.parentID;
      if (originalParent) {
        const ancestor = ancestorMap.get(originalParent);
        if (ancestor && ancestor !== originalParent) {
          msg.info.parentID = ancestor;
        }
      }
      result.push(msg);
      ancestorMap.set(entry.message.info.id, entry.message.info.id);
    } else if (entry.action === "compact") {
      compactGroup.push(entry);
    } else if (entry.action === "drop") {
      flushCompactGroup();
      const parentId = entry.message.info.parentID;
      if (parentId) {
        const ancestor = ancestorMap.get(parentId);
        if (ancestor) {
          ancestorMap.set(entry.message.info.id, ancestor);
        }
      } else {
        ancestorMap.set(entry.message.info.id, ancestorMap.get(entry.message.info.id) ?? entry.message.info.id);
      }
    }
  }

  flushCompactGroup();

  return result;
}

export function rebuildExportJson(
  original: ExportedSession,
  messages: ExportedMessage[]
): ExportedSession {
  const rebuilt = structuredClone(original);
  rebuilt.messages = messages;

  const newSid = `ses_ocb_${crypto.randomBytes(12).toString("hex")}`;
  rebuilt.info.id = newSid;

  for (const msg of rebuilt.messages) {
    msg.info.sessionID = newSid;
    for (const part of msg.parts) {
      part.sessionID = newSid;
      if ("messageID" in part) {
        part.messageID = msg.info.id;
      }
    }
  }

  return rebuilt;
}
