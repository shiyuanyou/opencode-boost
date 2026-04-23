import { resolveRef } from "../lib/ref.js";
import { injectMessage } from "../lib/opencode.js";
import { readState, readNames } from "../lib/store.js";
import { getSessionData } from "../lib/data-access.js";
import { shortId } from "../lib/format.js";
import { buildMessageList } from "./show.js";
import { extractMessageTexts } from "../lib/summarizer.js";

export async function pickCommand(
  sourceRef: string,
  cwd: string,
  opts: { m: string }
): Promise<void> {
  const sourceSid = await resolveRef(sourceRef, cwd);

  const state = await readState();
  const currentName = state[cwd]?.current;
  if (!currentName) throw new Error("No current session to pick into.");
  const names = await readNames();
  const dirNames = names[cwd] ?? {};
  const targetSid = dirNames[currentName] ?? currentName;

  console.log(`\u23f3 Exporting source session...`);
  const exported = await getSessionData(sourceSid);
  const messages = buildMessageList(exported.messages);

  const nums = opts.m.split(",").map((n) => parseInt(n.trim(), 10));
  if (nums.some(isNaN)) throw new Error("Invalid message numbers. Use comma-separated list (e.g. 3,5,7)");

  const picked = nums
    .map((n) => messages.find((m) => m.seq === n))
    .filter((m): m is typeof messages[number] => m !== undefined);
  const missing = nums.filter((n) => !messages.find((m) => m.seq === n));
  if (missing.length > 0) throw new Error(`Messages not found: ${missing.join(", ")}`);
  const content = extractMessageTexts(picked);

  const injectText = `来自 ${sourceRef} 的参考信息：\n\n${content}`;

  console.log(`\u23f3 Injecting ${picked.length} messages...`);
  await injectMessage(targetSid, injectText);

  console.log(`\u2713 Injected ${picked.length} messages into ${shortId(targetSid)}`);
}
