import { resolveRef } from "../lib/ref.js";
import { readNames, readState } from "../lib/store.js";
import { shortId } from "../lib/format.js";
import { execa } from "execa";

export async function openCommand(ref: string | undefined, cwd: string): Promise<void> {
  let sid: string;

  if (!ref) {
    const state = await readState();
    const current = state[cwd]?.current;
    if (!current) throw new Error("No current session. Specify a ref or use `ocb checkout` first.");
    const names = await readNames();
    const dirNames = names[cwd] ?? {};
    sid = dirNames[current] ?? current;
  } else {
    sid = await resolveRef(ref, cwd);
  }

  const names = await readNames();
  const dirNames = names[cwd] ?? {};
  const name = Object.entries(dirNames).find(([, s]) => s === sid)?.[0] ?? null;
  const label = name ? `${name} (${shortId(sid)})` : shortId(sid);
  console.log(`Opening ${label}...`);

  const child = execa("opencode", ["-s", sid], {
    stdio: "inherit",
    timeout: 0,
  });
  await child;
}
