import { listSessions } from "../lib/opencode.js";
import { readNames, writeNames } from "../lib/store.js";
import { shortId } from "../lib/format.js";

export async function attachCommand(name: string, cwd: string, opts: { s?: string }): Promise<void> {
  let sid: string;

  if (opts.s) {
    const sessions = await listSessions();
    const found = sessions.find((s) => s.id === opts.s);
    if (!found) throw new Error(`Session ${opts.s} not found`);
    sid = opts.s;
  } else {
    const sessions = await listSessions();
    const dirSessions = sessions
      .filter((s) => s.directory === cwd)
      .sort((a, b) => b.updated - a.updated);
    if (dirSessions.length === 0) throw new Error(`No sessions found in ${cwd}`);
    sid = dirSessions[0].id;
  }

  const names = await readNames();
  if (!names[cwd]) names[cwd] = {};
  names[cwd][name] = sid;
  await writeNames(names);

  console.log(`\u2713 Created: ${name} \u2192 ${shortId(sid)}`);
}
