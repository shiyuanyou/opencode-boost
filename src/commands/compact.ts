import fs from "fs/promises";
import path from "path";
import os from "os";
import { resolveRef } from "../lib/ref.js";
import { readNames, writeNames, readState, writeState, readReflog, writeReflog } from "../lib/store.js";
import { exportSession, forkSession, deleteSession, importSession } from "../lib/opencode.js";
import { shortId } from "../lib/format.js";
import { buildMessageList } from "./show.js";
import { summarizeMessages } from "../lib/summarizer.js";
import { repairChain, rebuildExportJson, type RebaseAction, type RebasePlanEntry } from "../lib/chain.js";

export async function compactCommand(
  ref: string,
  cwd: string,
  opts: { m: string; model?: string; manual?: string }
): Promise<void> {
  const sid = await resolveRef(ref, cwd);
  const names = await readNames();
  const dirNames = names[cwd] ?? {};
  const hasName = Object.entries(dirNames).find(([, s]) => s === sid);
  const name = hasName?.[0] ?? shortId(sid);

  const rangeParts = opts.m.split("-").map((n) => parseInt(n.trim(), 10));
  if (rangeParts.length !== 2 || rangeParts.some(isNaN)) {
    throw new Error("Invalid range. Use format: <from>-<to> (e.g. 3-8)");
  }
  const [from, to] = rangeParts;

  console.log(`\u23f3 Forking ${name} (${shortId(sid)}) -> new session...`);
  const forkResult = await forkSession(sid, "ocb-compact-fork", opts.model);
  const forkSid = forkResult.sessionId;

  try {
    console.log(`\u23f3 Exporting forked session...`);
    let exported;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        exported = await exportSession(forkSid);
        break;
      } catch (err) {
        if (attempt < 2 && (err as Error).message.includes("truncated")) {
          console.log(`  Session still active, waiting... (attempt ${attempt + 1}/3)`);
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        throw err;
      }
    }
    if (!exported) throw new Error("Failed to export session after retries");
    const messages = buildMessageList(exported.messages);

    if (from < 1 || to > messages.length || from > to) {
      throw new Error(`Invalid range ${from}-${to}. Session has ${messages.length} messages.`);
    }

    const toCompact = messages.slice(from - 1, to);

    let summaryText: string;
    if (opts.manual) {
      summaryText = opts.manual;
    } else {
      console.log(`\u23f3 Generating summary (messages ${from}-${to})...`);
      summaryText = await summarizeMessages(toCompact, opts.model);
    }

    const plan: RebasePlanEntry[] = messages.map((m) => ({
      seq: m.seq,
      action: (m.seq >= from && m.seq <= to ? "compact" : "keep") as RebaseAction,
      message: m,
    }));

    const repairedMessages = repairChain(exported.messages, plan);

    for (const msg of repairedMessages) {
      for (const part of msg.parts) {
        if (part.type === "text" && part.text?.startsWith("[OCB \u6458\u8981] ")) {
          part.text = `[OCB \u6458\u8981] ${summaryText}`;
        }
      }
    }

    const rebuilt = rebuildExportJson(exported, repairedMessages);

    const tmpFile = path.join(os.tmpdir(), `ocb-compact-${Date.now()}.json`);
    await fs.writeFile(tmpFile, JSON.stringify(rebuilt, null, 2), "utf-8");

    console.log(`\u23f3 Importing compressed session...`);
    const newSid = await importSession(tmpFile);
    await fs.unlink(tmpFile).catch(() => {});

    const reflog = await readReflog();
    const existingEntries = (reflog[cwd] ?? []).filter(
      (e) => e.name === name && name !== shortId(sid)
    );
    const newName = hasName ? `${name}-c${existingEntries.length + 1}` : undefined;

    if (newName) {
      dirNames[newName] = newSid;
      names[cwd] = dirNames;
      await writeNames(names);

      const state = await readState();
      if (state[cwd]?.current === name) {
        state[cwd].current = newName;
        await writeState(state);
      }
    }

    reflog[cwd] = reflog[cwd] ?? [];
    reflog[cwd].push({
      name: newName ?? name,
      sessionId: newSid,
      operation: "compact",
      from: sid,
      timestamp: Date.now(),
    });
    await writeReflog(reflog);

    console.log(`\u2713 ${name} updated: ${shortId(sid)} -> ${shortId(newSid)} (compressed)`);
    console.log(`  reflog: ${shortId(sid)} (original preserved)`);
    console.log(`  Messages ${from}-${to} compressed to 1 summary`);
    console.log(`  Open session: opencode -s ${newSid}`);
    if (newName) console.log(`  Rollback: ocb rollback ${newName}`);
  } finally {
    try { await deleteSession(forkSid); } catch { /* best effort */ }
  }
}
