import { readReflog, readState } from "../lib/store.js";
import { relativeTime } from "../lib/format.js";

export async function reflogCommand(ref: string | undefined, cwd: string): Promise<void> {
  let name = ref;

  if (!name) {
    const state = await readState();
    name = state[cwd]?.current ?? undefined;
    if (!name) {
      console.log("No current session and no name specified.");
      return;
    }
  }

  const reflog = await readReflog();
  const entries = reflog[cwd] ?? [];
  const filtered = entries.filter((e) => e.name === name);

  if (filtered.length === 0) {
    console.log(`No reflog entries for "${name}".`);
    return;
  }

  console.log(`${name} operation history:`);
  for (let i = filtered.length - 1; i >= 0; i--) {
    const entry = filtered[i];
    const step = i + 1;
    const time = relativeTime(entry.timestamp);
    const opLabel = entry.operation === "original" ? "(original)" : entry.operation;
    const fromLabel = entry.from ? `from ${entry.from.slice(0, 15)}` : "";
    console.log(`  [${step}] ${entry.sessionId.slice(0, 15)}  ${opLabel}  ${time}  ${fromLabel}`);
  }

  console.log(`\nRollback: ocb rollback ${name}`);
}
