import { listSessions } from "../lib/opencode.js";
import { readNames } from "../lib/store.js";
import { shortId, relativeTime } from "../lib/format.js";

export async function originAvailableCommand(cwd: string): Promise<void> {
  const [sessions, names] = await Promise.all([listSessions(cwd), readNames()]);

  const managedSids = new Set(Object.values(names[cwd] ?? {}));
  const unmanaged = sessions.filter((s) => !managedSids.has(s.id));

  if (unmanaged.length === 0) {
    console.log("All sessions are already managed.");
    return;
  }

  for (const s of unmanaged) {
    const time = relativeTime(s.updated);
    const title = s.title ? `"${s.title}"` : "(no title)";
    console.log(`  ${shortId(s.id).padEnd(20)} ${time.padEnd(12)} ${title}`);
  }
}
