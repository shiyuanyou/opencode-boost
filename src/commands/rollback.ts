import { resolveRef } from "../lib/ref.js";
import { readNames, writeNames, readState, writeState, readReflog, writeReflog } from "../lib/store.js";
import { shortId } from "../lib/format.js";
import readline from "readline/promises";

export async function rollbackCommand(
  name: string,
  step: string | undefined,
  cwd: string,
  opts: { force?: boolean }
): Promise<void> {
  const names = await readNames();
  const dirNames = names[cwd] ?? {};
  if (!dirNames[name]) throw new Error(`No session named "${name}"`);

  const reflog = await readReflog();
  const entries = (reflog[cwd] ?? []).filter((e) => e.name === name);

  if (entries.length === 0) throw new Error(`No reflog entries for "${name}"`);

  const targetStep = step ? parseInt(step, 10) : entries.length - 1;
  if (targetStep < 1 || targetStep >= entries.length) {
    throw new Error(`Invalid step ${targetStep}. Valid range: 1-${entries.length - 1}`);
  }

  const currentSid = dirNames[name];
  const targetEntry = entries[targetStep - 1];
  const targetSid = targetEntry.sessionId;

  if (currentSid === targetSid) {
    console.log(`${name} already points to ${shortId(targetSid)}`);
    return;
  }

  if (!opts.force) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      `Rollback ${name}: ${shortId(currentSid)} -> ${shortId(targetSid)}? [y/N] `
    );
    rl.close();
    if (answer.toLowerCase() !== "y") {
      console.log("Aborted.");
      return;
    }
  }

  dirNames[name] = targetSid;
  names[cwd] = dirNames;
  await writeNames(names);

  const state = await readState();
  if (state[cwd]?.current === name) {
    state[cwd].current = name;
    await writeState(state);
  }

  reflog[cwd] = reflog[cwd] ?? [];
  reflog[cwd].push({
    name,
    sessionId: targetSid,
    operation: "rollback",
    from: currentSid,
    timestamp: Date.now(),
  });
  await writeReflog(reflog);

  console.log(`\u2713 ${name} rolled back to ${shortId(targetSid)}`);
  console.log(`  Open session: opencode -s ${targetSid}`);
}
