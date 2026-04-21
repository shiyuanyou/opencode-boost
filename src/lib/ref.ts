import { readNames } from "./store.js";
import { listSessions } from "./opencode.js";

export async function resolveRef(ref: string, cwd: string): Promise<string> {
  const names = await readNames();
  const dirNames = names[cwd] ?? {};

  if (dirNames[ref]) return dirNames[ref];

  const sessions = await listSessions(cwd);
  const match = sessions.find((s) => s.id === ref);
  if (match) return match.id;

  throw new Error(`No session found for ref "${ref}" in ${cwd}`);
}
