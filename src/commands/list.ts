import { listSessions } from "../lib/opencode.js";
import { readNames, readState } from "../lib/store.js";
import { formatSession, relativeTime, shortId } from "../lib/format.js";

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

  if (sessions.length === 0) {
    console.log("No sessions found in this directory.");
    return;
  }

  const managedSids = new Set(Object.values(dirNames));

  const managed = sessions.filter((s) => managedSids.has(s.id));
  const unmanaged = sessions.filter((s) => !managedSids.has(s.id));

  if (managed.length > 0) {
    for (const s of managed) {
      const name = sidToName[s.id] ?? null;
      const isCurrent = name !== null && name === currentName;
      const line = formatSession(name, s.id, isCurrent);
      const time = relativeTime(s.updated);
      console.log(`${line.padEnd(45)} ${time}`);
    }
  }

  if (unmanaged.length > 0) {
    if (managed.length > 0) console.log("");
    console.log("  Unmanaged:");
    for (const s of unmanaged) {
      const time = relativeTime(s.updated);
      const title = s.title ? `"${s.title}"` : "(no title)";
      console.log(`    ${shortId(s.id).padEnd(18)} ${time.padEnd(12)} ${title}`);
    }
    console.log("");
    console.log("  Use `ocb attach <name> -s <session-id>` to manage a session.");
    console.log("  Use `ocb attach --all` to manage all sessions at once.");
  }
}
