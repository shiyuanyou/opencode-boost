import { resolveRef } from "../lib/ref.js";
import { readState, writeState, readNames } from "../lib/store.js";
import { shortId } from "../lib/format.js";

export async function checkoutCommand(ref: string, cwd: string): Promise<void> {
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
