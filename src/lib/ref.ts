import { readNames } from "./store.js";
import { listSessions } from "./opencode.js";

export async function resolveRef(ref: string, cwd: string): Promise<string> {
  const names = await readNames();
  const dirNames = names[cwd] ?? {};

  // Try name lookup first
  if (dirNames[ref]) return dirNames[ref];

  // Try as direct session-id
  const sessions = await listSessions();
  const match = sessions.find((s) => s.id === ref);
  if (match) return match.id;

  throw new Error(`No session found for ref "${ref}" in ${cwd}`);
}
