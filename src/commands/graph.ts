import { readNames, readForks, readState } from "../lib/store.js";
import { listSessions } from "../lib/opencode.js";
import { exportWithRetry } from "../lib/retry.js";
import { shortId, relativeTime } from "../lib/format.js";
import { buildMessageList } from "./show.js";
import type { ForkInfo } from "../types.js";

export interface TreeNode {
  sid: string;
  name: string | null;
  isCurrent: boolean;
  updated: number;
  forkLabel: string | null;
  children: TreeNode[];
}

export async function graphCommand(cwd: string): Promise<void> {
  const [names, forks, state, sessions] = await Promise.all([
    readNames(),
    readForks(),
    readState(),
    listSessions(cwd),
  ]);

  const dirNames = names[cwd] ?? {};
  const dirForks = forks[cwd] ?? {};
  const currentName = state[cwd]?.current ?? null;

  const sidToName = new Map(
    Object.entries(dirNames).map(([name, sid]) => [sid, name])
  );

  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  const managedSids = new Set(Object.values(dirNames));

  if (managedSids.size === 0) {
    console.log("No managed sessions. Use `ocb attach <name>` to add one.");
    return;
  }

  const childToParent = new Map<string, ForkInfo>();
  for (const [childSid, info] of Object.entries(dirForks)) {
    if (managedSids.has(childSid)) {
      childToParent.set(childSid, info);
    }
  }

  const forkPositions = new Map<string, string>();
  const parentSidsNeeded = new Set<string>();
  for (const [childSid, info] of childToParent.entries()) {
    parentSidsNeeded.add(info.parentSessionId);
    if (info.parentMessageId) {
      forkPositions.set(childSid, shortId(info.parentMessageId));
    }
  }

  const messageIndexCache = new Map<string, Map<string, number>>();
  for (const parentSid of parentSidsNeeded) {
    try {
      const exported = await exportWithRetry(parentSid);
      const messages = buildMessageList(exported.messages);
      const index = new Map(messages.map((m) => [m.info.id, m.seq]));
      messageIndexCache.set(parentSid, index);
    } catch {
      // parent session may not be exportable, skip
    }
  }

  for (const [childSid, info] of childToParent.entries()) {
    const parentIndex = messageIndexCache.get(info.parentSessionId);
    if (parentIndex && info.parentMessageId) {
      const seq = parentIndex.get(info.parentMessageId);
      if (seq !== undefined) {
        forkPositions.set(childSid, `[${seq}]`);
      }
    }
  }

  const nodes = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const sid of managedSids) {
    const name = sidToName.get(sid) ?? null;
    const session = sessionMap.get(sid);
    const isCurrent = name !== null && name === currentName;
    nodes.set(sid, {
      sid,
      name,
      isCurrent,
      updated: session?.updated ?? 0,
      forkLabel: forkPositions.get(sid) ?? null,
      children: [],
    });
  }

  for (const sid of managedSids) {
    const fork = childToParent.get(sid);
    if (fork && managedSids.has(fork.parentSessionId)) {
      const parentNode = nodes.get(fork.parentSessionId);
      const childNode = nodes.get(sid);
      if (parentNode && childNode) {
        parentNode.children.push(childNode);
      }
    } else {
      const node = nodes.get(sid);
      if (node) roots.push(node);
    }
  }

  for (const root of roots) {
    const marker = root.isCurrent ? "* " : "  ";
    printNode(root, marker, "  ");
  }
}

function formatNodeLabel(node: TreeNode): string {
  const label = node.name
    ? `${node.name} (${shortId(node.sid)})`
    : `(${shortId(node.sid)})`;
  const time = node.updated ? relativeTime(node.updated) : "";
  return `${label} ${time}`;
}

export function printNode(node: TreeNode, linePrefix: string, childPrefix: string): void {
  const forkLabel = node.forkLabel ? `${node.forkLabel} ` : "";
  console.log(`${linePrefix}${forkLabel}${formatNodeLabel(node)}`);

  for (let i = 0; i < node.children.length; i++) {
    const isLast = i === node.children.length - 1;
    const connector = isLast ? "\u2514\u2500\u2500 " : "\u251c\u2500\u2500 ";
    const nextChildPrefix = isLast ? "      " : "\u2502     ";
    printNode(
      node.children[i],
      childPrefix + connector,
      childPrefix + nextChildPrefix,
    );
  }
}
