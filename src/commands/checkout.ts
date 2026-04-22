import { resolveRef } from "../lib/ref.js";
import { readState, writeState, readNames, writeNames, readForks, writeForks } from "../lib/store.js";
import { forkSession } from "../lib/opencode.js";
import { exportWithRetry } from "../lib/retry.js";
import { shortId } from "../lib/format.js";
import { buildMessageList } from "./show.js";
import type { ForkInfo } from "../types.js";

export async function checkoutCommand(
  ref: string,
  cwd: string,
  opts?: { b?: string; model?: string }
): Promise<void> {
  if (opts?.b) {
    return checkoutFork(opts.b, ref, cwd, opts.model);
  }
  return checkoutSwitch(ref, cwd);
}

async function checkoutSwitch(ref: string, cwd: string): Promise<void> {
  const sid = await resolveRef(ref, cwd);

  const names = await readNames();
  const dirNames = names[cwd] ?? {};
  const name = Object.entries(dirNames).find(([, s]) => s === sid)?.[0] ?? null;

  const state = await readState();
  if (!state[cwd]) state[cwd] = { current: null };
  state[cwd].current = name ?? sid;
  await writeState(state);

  const label = name ? `${name} (${shortId(sid)})` : shortId(sid);
  console.log(`\u2713 Switched to ${label}`);
  console.log(`  Open session: opencode -s ${sid}`);
}

async function checkoutFork(name: string, parentRef: string, cwd: string, model?: string): Promise<void> {
  const names = await readNames();
  const dirNames = names[cwd] ?? {};

  if (dirNames[name]) {
    throw new Error(`Name "${name}" already exists. Use a different name or rename first.`);
  }

  let parentSid: string;
  if (parentRef === "." || parentRef === "") {
    const state = await readState();
    const current = state[cwd]?.current;
    if (!current) throw new Error("No current session. Specify a parent ref explicitly.");
    if (dirNames[current]) {
      parentSid = dirNames[current];
    } else {
      parentSid = current;
    }
  } else {
    parentSid = await resolveRef(parentRef, cwd);
  }

  const parentLabel = Object.entries(dirNames).find(([, s]) => s === parentSid)?.[0] ?? shortId(parentSid);
  console.log(`\u23f3 Forking from ${parentLabel} (${shortId(parentSid)})...`);

  const parentExport = await exportWithRetry(parentSid);

  const parentMessages = buildMessageList(parentExport.messages);
  const lastMsgId = parentMessages.length > 0 ? parentMessages[parentMessages.length - 1].info.id : "";

  const result = await forkSession(parentSid, "ocb-fork", model);

  const newSid = result.sessionId;
  const forkInfo: ForkInfo = {
    parentSessionId: parentSid,
    parentMessageId: lastMsgId,
    timestamp: Date.now(),
  };

  dirNames[name] = newSid;
  names[cwd] = dirNames;
  await writeNames(names);

  const forks = await readForks();
  if (!forks[cwd]) forks[cwd] = {};
  forks[cwd][newSid] = forkInfo;
  await writeForks(forks);

  const state = await readState();
  if (!state[cwd]) state[cwd] = { current: null };
  state[cwd].current = name;
  await writeState(state);

  console.log(`\u2713 Created ${name} (${shortId(newSid)}), switched`);
  console.log(`  Open session: opencode -s ${newSid}`);
}
