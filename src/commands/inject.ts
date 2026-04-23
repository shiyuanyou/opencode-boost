import { resolveRef } from "../lib/ref.js";
import { injectMessage } from "../lib/opencode.js";
import { readState, readNames } from "../lib/store.js";
import { getSessionData } from "../lib/data-access.js";
import { shortId } from "../lib/format.js";
import { buildMessageList } from "./show.js";
import { extractKnowledge, extractMessageTexts } from "../lib/summarizer.js";

export async function injectCommand(
  sourceRef: string,
  targetRef: string | undefined,
  cwd: string,
  opts: { model?: string; raw?: boolean }
): Promise<void> {
  const sourceSid = await resolveRef(sourceRef, cwd);

  let targetSid: string;
  if (targetRef) {
    targetSid = await resolveRef(targetRef, cwd);
  } else {
    const state = await readState();
    const currentName = state[cwd]?.current;
    if (!currentName) throw new Error("No current session. Specify a target ref.");
    const names = await readNames();
    const dirNames = names[cwd] ?? {};
    targetSid = dirNames[currentName] ?? currentName;
  }

  console.log(`\u23f3 Exporting source session...`);
  const exported = await getSessionData(sourceSid);
  const messages = buildMessageList(exported.messages);

  let content: string;
  if (opts.raw) {
    content = extractMessageTexts(messages);
  } else {
    console.log(`\u23f3 Extracting key knowledge...`);
    content = await extractKnowledge(messages, opts.model);
  }

  const sourceName = sourceRef;
  const injectMessage_text = `以下是来自会话 ${sourceName} 的关键知识：\n\n${content}`;

  console.log(`\u23f3 Injecting into target session...`);
  await injectMessage(targetSid, injectMessage_text);

  console.log(`\u2713 Injected ${sourceName} knowledge into ${shortId(targetSid)}`);
  console.log(`  Summary length: ~${content.length} chars`);
}
