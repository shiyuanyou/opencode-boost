import { resolveRef } from "../lib/ref.js";
import { readNames, writeNames, readState, writeState } from "../lib/store.js";
import { deleteSession } from "../lib/opencode.js";
import { shortId } from "../lib/format.js";
import readline from "readline/promises";

export async function deleteCommand(ref: string, cwd: string, opts: { force?: boolean }): Promise<void> {
  const sid = await resolveRef(ref, cwd);

  if (!opts.force) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`\u26A0 Delete session ${shortId(sid)}? This cannot be undone. [y/N] `);
    rl.close();
    if (answer.toLowerCase() !== "y") {
      console.log("Aborted.");
      return;
    }
  }

  await deleteSession(sid);

  const names = await readNames();
  const dirNames = names[cwd] ?? {};
  const entry = Object.entries(dirNames).find(([, s]) => s === sid);
  if (entry) {
    const [name] = entry;
    delete dirNames[name];
    names[cwd] = dirNames;
    await writeNames(names);

    const state = await readState();
    if (state[cwd]?.current === name) {
      state[cwd].current = null;
      await writeState(state);
    }
  }

  console.log(`\u2713 Deleted ${shortId(sid)}`);
}
