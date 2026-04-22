import { getCurrentSession } from "./opencode.js";
import { readNames, readState, writeState } from "./store.js";

export async function syncStateWithOpencode(cwd: string): Promise<void> {
  const activeSid = await getCurrentSession();
  if (!activeSid) return;

  const names = await readNames();
  const state = await readState();
  const dirNames = names[cwd] ?? {};
  const currentInState = state[cwd]?.current ?? null;

  const nameForSid = Object.entries(dirNames).find(([, sid]) => sid === activeSid)?.[0] ?? null;

  if (currentInState === nameForSid || currentInState === activeSid) return;

  if (!state[cwd]) state[cwd] = { current: null };
  state[cwd].current = nameForSid ?? activeSid;
  await writeState(state);
}
