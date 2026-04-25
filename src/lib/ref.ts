import { readNames } from "./store.js";
import { listSessions } from "./opencode.js";

export async function resolveRef(ref: string, cwd: string): Promise<string> {
  const names = await readNames();
  const dirNames = names[cwd] ?? {};

  if (dirNames[ref]) return dirNames[ref];

  const sessions = await listSessions(cwd);
  const exact = sessions.find((s) => s.id === ref);
  if (exact) return exact.id;

  const prefixMatches = sessions.filter((s) => s.id.startsWith(ref));
  if (prefixMatches.length === 1) return prefixMatches[0].id;
  if (prefixMatches.length > 1) {
    const ids = prefixMatches.map((s) => s.id).join(", ");
    throw new Error(`Ambiguous ref "${ref}" matches ${prefixMatches.length} sessions: ${ids}`);
  }

  throw new Error(`No session found for ref "${ref}" in ${cwd}`);
}
