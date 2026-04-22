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
import { execa } from "execa";

export async function rebaseCommand(
  ref: string,
  cwd: string,
  opts: { model?: string }
): Promise<void> {
  const sid = await resolveRef(ref, cwd);
  const names = await readNames();
  const dirNames = names[cwd] ?? {};
  const hasName = Object.entries(dirNames).find(([, s]) => s === sid);
  const name = hasName?.[0] ?? shortId(sid);

  console.log(`\u23f3 Forking ${name} (${shortId(sid)}) -> new session...`);
  const forkResult = await forkSession(sid, "ocb-rebase-fork");
  const forkSid = forkResult.sessionId;

  try {
    console.log(`\u23f3 Exporting forked session...`);
    const exported = await exportSession(forkSid);
    const messages = buildMessageList(exported.messages);

    if (messages.length === 0) {
      throw new Error("Session has no messages to rebase.");
    }

    const planFile = path.join(os.tmpdir(), `ocb-rebase-plan-${Date.now()}.txt`);
    const planLines: string[] = [
      "# Rebase plan for " + name,
      "# Actions: keep | compact | drop",
      "# Adjacent compact messages will be merged into one summary.",
      "# Save and close to execute. Delete all lines to abort.",
      "",
    ];

    for (const msg of messages) {
      const role = msg.info.role === "user" ? "User     " : "Assistant";
      let text = "";
      for (const part of msg.parts) {
        if (part.type === "text" && part.text) { text = part.text.slice(0, 60); break; }
      }
      planLines.push(`keep\t[${msg.seq}]  [${role}]  "${text}"`);
    }

    await fs.writeFile(planFile, planLines.join("\n"), "utf-8");

    const editor = process.env.EDITOR || process.env.VISUAL || "vi";
    console.log(`Opening rebase plan in ${editor}...`);
    await execa(editor, [planFile], { stdio: "inherit" });

    const edited = await fs.readFile(planFile, "utf-8");
    await fs.unlink(planFile).catch(() => {});

    const plan: RebasePlanEntry[] = [];
    for (const line of edited.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const match = trimmed.match(/^(keep|compact|drop)\t\[(\d+)\]/);
      if (!match) continue;

      const action = match[1] as RebaseAction;
      const seq = parseInt(match[2], 10);
      const msg = messages.find((m) => m.seq === seq);
      if (!msg) continue;

      plan.push({ seq, action, message: msg });
    }

    if (plan.length === 0) {
      console.log("No actions in plan. Aborting.");
      return;
    }

    const compactGroups: RebasePlanEntry[][] = [];
    let currentGroup: RebasePlanEntry[] = [];

    for (const entry of plan) {
      if (entry.action === "compact") {
        currentGroup.push(entry);
      } else {
        if (currentGroup.length > 0) {
          compactGroups.push(currentGroup);
          currentGroup = [];
        }
      }
    }
    if (currentGroup.length > 0) compactGroups.push(currentGroup);

    for (const group of compactGroups) {
      const nums = group.map((g) => g.seq).join(",");
      console.log(`\u23f3 Summarizing messages ${nums}...`);
      const summaryText = await summarizeMessages(group, opts.model);

      for (const entry of group) {
        for (const part of entry.message.parts) {
          if (part.type === "text" && part.text) {
            part.text = `[OCB \u6458\u8981] ${summaryText}`;
            break;
          }
        }
      }
    }

    const repairedMessages = repairChain(exported.messages, plan);
    const rebuilt = rebuildExportJson(exported, repairedMessages);

    const tmpFile = path.join(os.tmpdir(), `ocb-rebase-${Date.now()}.json`);
    await fs.writeFile(tmpFile, JSON.stringify(rebuilt, null, 2), "utf-8");

    console.log(`\u23f3 Importing rebased session...`);
    const newSid = await importSession(tmpFile);
    await fs.unlink(tmpFile).catch(() => {});

    const reflog = await readReflog();
    const existingEntries = (reflog[cwd] ?? []).filter(
      (e) => e.name === name && name !== shortId(sid)
    );
    const newName = hasName ? `${name}-r${existingEntries.length + 1}` : undefined;

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
      operation: "rebase",
      from: sid,
      timestamp: Date.now(),
    });
    await writeReflog(reflog);

    const kept = plan.filter((p) => p.action === "keep").length;
    const compacted = compactGroups.length;
    const dropped = plan.filter((p) => p.action === "drop").length;

    console.log(`\u2713 ${name} rebased: ${shortId(sid)} -> ${shortId(newSid)}`);
    console.log(`  ${kept} kept, ${compacted} compacted, ${dropped} dropped`);
    console.log(`  Open session: opencode -s ${newSid}`);
    if (newName) console.log(`  Rollback: ocb rollback ${newName}`);
  } finally {
    try { await deleteSession(forkSid); } catch { /* best effort */ }
  }
}
