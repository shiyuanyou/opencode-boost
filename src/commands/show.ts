import { getSessionData } from "../lib/data-access.js";
import { resolveRef } from "../lib/ref.js";
import { readState } from "../lib/store.js";
import type { ExportedMessage } from "../types.js";

export interface IndexedMessage extends ExportedMessage {
  seq: number;
}

export function buildMessageList(messages: ExportedMessage[]): IndexedMessage[] {
  const byId = new Map(messages.map((m) => [m.info.id, m]));

  const roots = messages.filter((m) => !m.info.parentID);
  if (roots.length === 0) return [];

  const ordered: ExportedMessage[] = [];
  const byParent = new Map<string, ExportedMessage>();
  for (const m of messages) {
    if (m.info.parentID) byParent.set(m.info.parentID, m);
  }

  let current: ExportedMessage | undefined = roots[0];
  while (current) {
    ordered.push(current);
    current = byParent.get(current.info.id);
  }

  return ordered.map((m, i) => ({ ...m, seq: i + 1 }));
}

function extractText(msg: ExportedMessage): string {
  for (const part of msg.parts) {
    if (part.type === "text" && part.text) return part.text.slice(0, 80);
  }
  return "(no text)";
}

function countToolCalls(msg: ExportedMessage): number {
  return msg.parts.filter((p) => p.type === "tool").length;
}

async function resolveToCurrent(cwd: string): Promise<string> {
  const state = await readState();
  const current = state[cwd]?.current;
  if (!current) throw new Error("No current session. Specify a session ref or use `ocb checkout` first.");
  return current;
}

export async function showCommand(ref: string | undefined, cwd: string, opts: { m?: string; json?: boolean }): Promise<void> {
  const resolved = ref ?? await resolveToCurrent(cwd);
  const sid = await resolveRef(resolved, cwd);
  const exported = await getSessionData(sid);
  const list = buildMessageList(exported.messages);

  if (opts.json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  if (opts.m) {
    const nums = opts.m.split(",").map((n) => parseInt(n.trim(), 10));
    for (const num of nums) {
      const msg = list.find((m) => m.seq === num);
      if (!msg) { console.log(`Message ${num} not found`); continue; }
      console.log(`\n[${msg.seq}] [${msg.info.role}]`);
      for (const part of msg.parts) {
        if (part.type === "text") console.log(part.text);
        else console.log(`<${part.type}>`);
      }
    }
    return;
  }

  for (const msg of list) {
    const role = msg.info.role === "user" ? "User     " : "Assistant";
    const text = extractText(msg);
    const tools = countToolCalls(msg);
    const toolSuffix = tools > 0 ? ` (${tools} tool calls)` : "";
    console.log(`[${String(msg.seq).padStart(3)}]  [${role}]  "${text}"${toolSuffix}`);
  }
}
