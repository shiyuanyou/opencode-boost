import { resolveRef } from "../lib/ref.js";
import { readNames, writeNames, readState, writeState } from "../lib/store.js";

export async function unmanageCommand(ref: string, cwd: string): Promise<void> {
  const sid = await resolveRef(ref, cwd);
  const names = await readNames();
  const dirNames = names[cwd] ?? {};

  const entry = Object.entries(dirNames).find(([, s]) => s === sid);
  if (!entry) throw new Error(`Session not managed: ${ref}`);
  const [name] = entry;

  delete dirNames[name];
  names[cwd] = dirNames;
  await writeNames(names);

  const state = await readState();
  if (state[cwd]?.current === name) {
    state[cwd].current = null;
    await writeState(state);
  }

  console.log(`\u2713 Removed ${name} from management (session still exists)`);
}
