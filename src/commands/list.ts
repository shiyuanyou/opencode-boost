import { listSessions } from "../lib/opencode.js";
import { readNames, readState } from "../lib/store.js";
import { formatSession, relativeTime } from "../lib/format.js";

export async function listCommand(cwd: string): Promise<void> {
  const [sessions, names, state] = await Promise.all([
    listSessions(cwd),
    readNames(),
    readState(),
  ]);

  const dirNames = names[cwd] ?? {};
  const currentName = state[cwd]?.current ?? null;

  const sidToName = Object.fromEntries(
    Object.entries(dirNames).map(([name, sid]) => [sid, name])
  );

  const managedSids = new Set(Object.values(dirNames));
  const managed = sessions.filter((s) => managedSids.has(s.id));

  if (managed.length === 0) {
    console.log("No managed sessions. Use `ocb attach <name>` to add one.");
    return;
  }

  for (const s of managed) {
    const name = sidToName[s.id] ?? null;
    const isCurrent = name !== null && name === currentName;
    const line = formatSession(name, s.id, isCurrent);
    const time = relativeTime(s.updated);
    console.log(`${line.padEnd(40)} ${time}`);
  }
}
