import { listSessions } from "../lib/opencode.js";
import { readNames, writeNames } from "../lib/store.js";
import { shortId } from "../lib/format.js";

function titleToName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "session";
}

function uniqueName(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export async function attachCommand(name: string, cwd: string, opts: { s?: string; all?: boolean }): Promise<void> {
  const sessions = await listSessions(cwd);
  const names = await readNames();
  if (!names[cwd]) names[cwd] = {};

  if (opts.all) {
    const managedSids = new Set(Object.values(names[cwd]));
    const existingNames = new Set(Object.keys(names[cwd]));
    const unmanaged = sessions.filter((s) => !managedSids.has(s.id));

    if (unmanaged.length === 0) {
      console.log("All sessions are already managed.");
      return;
    }

    for (const s of unmanaged) {
      const autoName = uniqueName(titleToName(s.title), existingNames);
      names[cwd][autoName] = s.id;
      existingNames.add(autoName);
      console.log(`\u2713 Created: ${autoName} \u2192 ${shortId(s.id)}`);
    }

    await writeNames(names);
    return;
  }

  let sid: string;
  let resolvedName = name || "";

  if (opts.s) {
    const found = sessions.find((s) => s.id === opts.s);
    if (!found) throw new Error(`Session ${opts.s} not found in ${cwd}`);
    sid = opts.s;
  } else {
    const dirSessions = sessions.sort((a, b) => b.updated - a.updated);
    if (dirSessions.length === 0) throw new Error(`No sessions found in ${cwd}`);
    sid = dirSessions[0].id;
  }

  if (!resolvedName || /^ses_[a-zA-Z0-9]{5,}/.test(resolvedName)) {
    const session = sessions.find((s) => s.id === sid);
    resolvedName = uniqueName(titleToName(session?.title ?? ""), new Set(Object.keys(names[cwd])));
  }

  names[cwd][resolvedName] = sid;
  await writeNames(names);

  console.log(`\u2713 Created: ${resolvedName} \u2192 ${shortId(sid)}`);
}
