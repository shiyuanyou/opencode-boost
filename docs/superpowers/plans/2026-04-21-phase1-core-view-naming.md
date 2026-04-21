# Phase 1: Core View + Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `ocb` CLI tool's Phase 1 commands: project scaffold, opencode CLI wrapper, local JSON data layer, and all read/naming commands (`list`, `origin available`, `show`, `checkout`, `attach`, `rename`, `unmanage`, `delete`).

**Architecture:** TypeScript CLI using Commander.js. All session data comes from `opencode` CLI subprocess calls — never direct DB access. Local state (name mappings, active session) stored in XDG-compliant JSON files keyed by project directory.

**Tech Stack:** TypeScript, Node.js, Commander.js, tsup, Vitest (unit tests), execa (subprocess calls), zod (JSON validation)

---

## Verified opencode CLI behavior (v1.14.19)

`opencode session list --format json` returns an array of objects:
```json
[{
  "id": "ses_xxx",
  "title": "...",
  "updated": 1776774190654,
  "created": 1776772423137,
  "projectId": "696fe769c5d5769bf1d5709627619ece86474316",
  "directory": "/path/to/project"
}]
```

`opencode export <sid>` prints `Exporting session: <sid>` to stdout first, then the JSON. The JSON must be extracted by skipping the first line.

`opencode export` message structure: messages linked via `parentID`. First message has no `parentID`. Parts array contains `type: "text"` parts with the actual content.

---

## File Structure

```
src/
  index.ts                  # CLI entry point, registers all commands
  commands/
    list.ts                 # ocb list
    origin.ts               # ocb origin available
    show.ts                 # ocb show <ref> [-m <nums>]
    checkout.ts             # ocb checkout <ref>
    attach.ts               # ocb attach <name> [-s <sid>]
    rename.ts               # ocb rename <old> <new>
    unmanage.ts             # ocb unmanage <ref>
    delete.ts               # ocb delete <ref>
  lib/
    opencode.ts             # Subprocess wrapper for opencode CLI calls
    store.ts                # Read/write names.json, state.json
    ref.ts                  # Resolve <ref> → session-id
    paths.ts                # XDG data/config directory paths
    format.ts               # Display formatting helpers
  types.ts                  # Shared TypeScript types
tests/
  lib/
    opencode.test.ts
    store.test.ts
    ref.test.ts
    paths.test.ts
  commands/
    list.test.ts
    show.test.ts
package.json
tsconfig.json
tsup.config.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `src/index.ts`
- Create: `src/types.ts`

- [x] **Step 1: Initialize package**

```bash
cd "/Users/shiyuanyou/Library/Mobile Documents/com~apple~CloudDocs/Projects/opencode-boost"
npm init -y
```

- [x] **Step 2: Install dependencies**

```bash
npm install commander execa zod
npm install -D typescript @types/node tsup vitest
```

- [x] **Step 3: Write `package.json`** (replace the generated one)

```json
{
  "name": "opencode-boost",
  "version": "0.1.0",
  "description": "opencode session manager",
  "bin": {
    "ocb": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "execa": "^9.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

- [x] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
```

- [x] **Step 5: Write `tsup.config.ts`**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
});
```

- [x] **Step 6: Write `src/types.ts`**

```typescript
export interface SessionInfo {
  id: string;
  title: string;
  updated: number;
  created: number;
  projectId: string;
  directory: string;
}

export interface ExportedSession {
  info: {
    id: string;
    slug: string;
    projectID: string;
    directory: string;
    title: string;
    version: string;
    time: { created: number; updated: number };
    [key: string]: unknown;
  };
  messages: ExportedMessage[];
}

export interface ExportedMessage {
  info: {
    id: string;
    sessionID: string;
    parentID?: string;
    role: "user" | "assistant";
    time: { created: number; completed?: number };
    [key: string]: unknown;
  };
  parts: MessagePart[];
}

export interface MessagePart {
  type: string;
  text?: string;
  id: string;
  sessionID: string;
  messageID: string;
  [key: string]: unknown;
}

// Local store types
export interface NamesStore {
  [directory: string]: {
    [name: string]: string; // name → session-id
  };
}

export interface StateStore {
  [directory: string]: {
    current: string | null; // name of active session
  };
}
```

- [x] **Step 7: Write `src/index.ts`** (minimal, commands added later)

```typescript
import { Command } from "commander";

const program = new Command();

program
  .name("ocb")
  .description("opencode session manager")
  .version("0.1.0");

program.parse();
```

- [x] **Step 8: Build and verify**

```bash
npm run build
node dist/index.js --version
```

Expected output: `0.1.0`

- [x] **Step 9: Commit**

```bash
git add package.json tsconfig.json tsup.config.ts src/
git commit -m "feat: project scaffold"
```

---

## Task 2: XDG Paths + Store Layer

**Files:**
- Create: `src/lib/paths.ts`
- Create: `src/lib/store.ts`
- Create: `tests/lib/paths.test.ts`
- Create: `tests/lib/store.test.ts`

- [x] **Step 1: Write failing test for paths**

```typescript
// tests/lib/paths.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { getDataDir, getConfigDir } from "../../src/lib/paths.js";
import path from "path";
import os from "os";

describe("paths", () => {
  it("returns XDG_DATA_HOME based dir when env is set", () => {
    process.env.XDG_DATA_HOME = "/custom/data";
    const dir = getDataDir();
    expect(dir).toBe("/custom/data/opencode-boost");
    delete process.env.XDG_DATA_HOME;
  });

  it("falls back to ~/.local/share when XDG_DATA_HOME not set", () => {
    delete process.env.XDG_DATA_HOME;
    const dir = getDataDir();
    expect(dir).toBe(path.join(os.homedir(), ".local/share/opencode-boost"));
  });

  it("returns XDG_CONFIG_HOME based dir when env is set", () => {
    process.env.XDG_CONFIG_HOME = "/custom/config";
    const dir = getConfigDir();
    expect(dir).toBe("/custom/config/opencode-boost");
    delete process.env.XDG_CONFIG_HOME;
  });
});
```

- [x] **Step 2: Run test — expect FAIL**

```bash
npm test -- tests/lib/paths.test.ts
```

Expected: FAIL — module not found

- [x] **Step 3: Write `src/lib/paths.ts`**

```typescript
import path from "path";
import os from "os";

export function getDataDir(): string {
  const xdg = process.env.XDG_DATA_HOME;
  const base = xdg ?? path.join(os.homedir(), ".local/share");
  return path.join(base, "opencode-boost");
}

export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg ?? path.join(os.homedir(), ".config");
  return path.join(base, "opencode-boost");
}
```

- [x] **Step 4: Run test — expect PASS**

```bash
npm test -- tests/lib/paths.test.ts
```

- [x] **Step 5: Write failing test for store**

```typescript
// tests/lib/store.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readNames, writeNames, readState, writeState } from "../../src/lib/store.js";
import fs from "fs";
import os from "os";
import path from "path";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ocb-test-"));
  process.env.XDG_DATA_HOME = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
  delete process.env.XDG_DATA_HOME;
});

describe("store", () => {
  it("returns empty names store when file does not exist", async () => {
    const names = await readNames();
    expect(names).toEqual({});
  });

  it("writes and reads names", async () => {
    await writeNames({ "/proj": { "fix-auth": "ses_abc" } });
    const names = await readNames();
    expect(names["/proj"]["fix-auth"]).toBe("ses_abc");
  });

  it("returns empty state when file does not exist", async () => {
    const state = await readState();
    expect(state).toEqual({});
  });

  it("writes and reads state", async () => {
    await writeState({ "/proj": { current: "fix-auth" } });
    const state = await readState();
    expect(state["/proj"].current).toBe("fix-auth");
  });
});
```

- [x] **Step 6: Run test — expect FAIL**

```bash
npm test -- tests/lib/store.test.ts
```

- [x] **Step 7: Write `src/lib/store.ts`**

```typescript
import fs from "fs/promises";
import path from "path";
import { getDataDir } from "./paths.js";
import type { NamesStore, StateStore } from "../types.js";

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function namesPath() {
  return path.join(getDataDir(), "names.json");
}

function statePath() {
  return path.join(getDataDir(), "state.json");
}

export async function readNames(): Promise<NamesStore> {
  return readJson<NamesStore>(namesPath(), {});
}

export async function writeNames(data: NamesStore): Promise<void> {
  return writeJson(namesPath(), data);
}

export async function readState(): Promise<StateStore> {
  return readJson<StateStore>(statePath(), {});
}

export async function writeState(data: StateStore): Promise<void> {
  return writeJson(statePath(), data);
}
```

- [x] **Step 8: Run test — expect PASS**

```bash
npm test -- tests/lib/store.test.ts
```

- [x] **Step 9: Commit**

```bash
git add src/lib/paths.ts src/lib/store.ts tests/
git commit -m "feat: XDG paths and JSON store layer"
```

---

## Task 3: opencode CLI Wrapper

**Files:**
- Create: `src/lib/opencode.ts`
- Create: `tests/lib/opencode.test.ts`

- [x] **Step 1: Write failing test**

```typescript
// tests/lib/opencode.test.ts
import { describe, it, expect, vi } from "vitest";

// We test the parsing logic, not the subprocess itself
import { parseExportOutput, parseSessionList } from "../../src/lib/opencode.js";

describe("parseExportOutput", () => {
  it("strips the 'Exporting session:' prefix line", () => {
    const raw = `Exporting session: ses_abc\n{"info":{"id":"ses_abc"},"messages":[]}`;
    const result = parseExportOutput(raw);
    expect(result.info.id).toBe("ses_abc");
  });

  it("handles output without prefix line", () => {
    const raw = `{"info":{"id":"ses_abc"},"messages":[]}`;
    const result = parseExportOutput(raw);
    expect(result.info.id).toBe("ses_abc");
  });
});

describe("parseSessionList", () => {
  it("parses a valid session list JSON array", () => {
    const raw = JSON.stringify([
      { id: "ses_abc", title: "Test", updated: 1000, created: 900, projectId: "p1", directory: "/proj" },
    ]);
    const sessions = parseSessionList(raw);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe("ses_abc");
  });
});
```

- [x] **Step 2: Run test — expect FAIL**

```bash
npm test -- tests/lib/opencode.test.ts
```

- [x] **Step 3: Write `src/lib/opencode.ts`**

```typescript
import { execa } from "execa";
import type { SessionInfo, ExportedSession } from "../types.js";

export function parseExportOutput(raw: string): ExportedSession {
  const lines = raw.split("\n");
  // Skip lines until we find the JSON start
  const jsonStart = lines.findIndex((l) => l.trimStart().startsWith("{"));
  if (jsonStart === -1) throw new Error("No JSON found in export output");
  const jsonStr = lines.slice(jsonStart).join("\n");
  return JSON.parse(jsonStr) as ExportedSession;
}

export function parseSessionList(raw: string): SessionInfo[] {
  return JSON.parse(raw) as SessionInfo[];
}

export async function listSessions(): Promise<SessionInfo[]> {
  const { stdout } = await execa("opencode", ["session", "list", "--format", "json"]);
  return parseSessionList(stdout);
}

export async function exportSession(sid: string): Promise<ExportedSession> {
  const { stdout } = await execa("opencode", ["export", sid]);
  return parseExportOutput(stdout);
}

export async function deleteSession(sid: string): Promise<void> {
  await execa("opencode", ["session", "delete", sid]);
}
```

- [x] **Step 4: Run test — expect PASS**

```bash
npm test -- tests/lib/opencode.test.ts
```

- [x] **Step 5: Commit**

```bash
git add src/lib/opencode.ts tests/lib/opencode.test.ts
git commit -m "feat: opencode CLI subprocess wrapper"
```

---

## Task 4: Ref Resolution

**Files:**
- Create: `src/lib/ref.ts`
- Create: `tests/lib/ref.test.ts`

- [x] **Step 1: Write failing test**

```typescript
// tests/lib/ref.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveRef } from "../../src/lib/ref.js";

vi.mock("../../src/lib/store.js", () => ({
  readNames: vi.fn(),
}));
vi.mock("../../src/lib/opencode.js", () => ({
  listSessions: vi.fn(),
}));

import { readNames } from "../../src/lib/store.js";
import { listSessions } from "../../src/lib/opencode.js";

describe("resolveRef", () => {
  beforeEach(() => {
    vi.mocked(readNames).mockResolvedValue({
      "/proj": { "fix-auth": "ses_abc123" },
    });
    vi.mocked(listSessions).mockResolvedValue([
      { id: "ses_abc123", title: "Fix auth", updated: 1000, created: 900, projectId: "p1", directory: "/proj" },
      { id: "ses_def456", title: "Other", updated: 1000, created: 900, projectId: "p1", directory: "/proj" },
    ]);
  });

  it("resolves a name to session-id", async () => {
    const sid = await resolveRef("fix-auth", "/proj");
    expect(sid).toBe("ses_abc123");
  });

  it("resolves a session-id directly if it exists", async () => {
    const sid = await resolveRef("ses_def456", "/proj");
    expect(sid).toBe("ses_def456");
  });

  it("throws if ref not found", async () => {
    await expect(resolveRef("nonexistent", "/proj")).rejects.toThrow();
  });
});
```

- [x] **Step 2: Run test — expect FAIL**

```bash
npm test -- tests/lib/ref.test.ts
```

- [x] **Step 3: Write `src/lib/ref.ts`**

```typescript
import { readNames } from "./store.js";
import { listSessions } from "./opencode.js";

export async function resolveRef(ref: string, cwd: string): Promise<string> {
  const names = await readNames();
  const dirNames = names[cwd] ?? {};

  // Try name lookup first
  if (dirNames[ref]) return dirNames[ref];

  // Try as direct session-id
  const sessions = await listSessions();
  const match = sessions.find((s) => s.id === ref);
  if (match) return match.id;

  throw new Error(`No session found for ref "${ref}" in ${cwd}`);
}
```

- [x] **Step 4: Run test — expect PASS**

```bash
npm test -- tests/lib/ref.test.ts
```

- [x] **Step 5: Commit**

```bash
git add src/lib/ref.ts tests/lib/ref.test.ts
git commit -m "feat: ref resolution (name or session-id)"
```

---

## Task 5: Format Helpers

**Files:**
- Create: `src/lib/format.ts`

- [x] **Step 1: Write `src/lib/format.ts`**

```typescript
export function shortId(sid: string): string {
  // "ses_abc12345678" → "ses_abc12345"
  return sid.slice(0, 15);
}

export function formatSession(name: string | null, sid: string, isCurrent: boolean): string {
  const marker = isCurrent ? "*" : " ";
  const label = name ? `${name} (${shortId(sid)})` : `(${shortId(sid)})`;
  return `${marker} ${label}`;
}

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

- [x] **Step 2: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat: display formatting helpers"
```

---

## Task 6: `ocb list` command

**Files:**
- Create: `src/commands/list.ts`
- Modify: `src/index.ts`

- [x] **Step 1: Write `src/commands/list.ts`**

```typescript
import { listSessions } from "../lib/opencode.js";
import { readNames, readState } from "../lib/store.js";
import { formatSession, relativeTime } from "../lib/format.js";

export async function listCommand(cwd: string): Promise<void> {
  const [sessions, names, state] = await Promise.all([
    listSessions(),
    readNames(),
    readState(),
  ]);

  const dirSessions = sessions.filter((s) => s.directory === cwd);
  const dirNames = names[cwd] ?? {};
  const currentName = state[cwd]?.current ?? null;

  // Build reverse map: sid → name
  const sidToName = Object.fromEntries(
    Object.entries(dirNames).map(([name, sid]) => [sid, name])
  );

  // Find managed sessions (those with a name)
  const managedSids = new Set(Object.values(dirNames));
  const managed = dirSessions.filter((s) => managedSids.has(s.id));

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
```

- [x] **Step 2: Register command in `src/index.ts`**

```typescript
import { Command } from "commander";
import { listCommand } from "./commands/list.js";

const program = new Command();

program
  .name("ocb")
  .description("opencode session manager")
  .version("0.1.0");

program
  .command("list")
  .description("List managed sessions for current directory")
  .action(async () => {
    await listCommand(process.cwd());
  });

program.parse();
```

- [x] **Step 3: Build and manual test**

```bash
npm run build
node dist/index.js list
```

Expected: either "No managed sessions." message or a list (if you've already run `attach`).

- [x] **Step 4: Commit**

```bash
git add src/commands/list.ts src/index.ts
git commit -m "feat: ocb list command"
```

---

## Task 7: `ocb origin available` command

**Files:**
- Create: `src/commands/origin.ts`
- Modify: `src/index.ts`

- [x] **Step 1: Write `src/commands/origin.ts`**

```typescript
import { listSessions } from "../lib/opencode.js";
import { readNames } from "../lib/store.js";
import { shortId, relativeTime } from "../lib/format.js";

export async function originAvailableCommand(cwd: string): Promise<void> {
  const [sessions, names] = await Promise.all([listSessions(), readNames()]);

  const dirSessions = sessions.filter((s) => s.directory === cwd);
  const managedSids = new Set(Object.values(names[cwd] ?? {}));
  const unmanaged = dirSessions.filter((s) => !managedSids.has(s.id));

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
```

- [x] **Step 2: Add to `src/index.ts`**

```typescript
import { originAvailableCommand } from "./commands/origin.js";

// after existing commands:
const origin = program.command("origin").description("Origin session commands");

origin
  .command("available")
  .description("List unmanaged sessions in current directory")
  .action(async () => {
    await originAvailableCommand(process.cwd());
  });
```

- [x] **Step 3: Build and manual test**

```bash
npm run build
node dist/index.js origin available
```

Expected: list of unmanaged sessions, including the current opencode session.

- [x] **Step 4: Commit**

```bash
git add src/commands/origin.ts src/index.ts
git commit -m "feat: ocb origin available command"
```

---

## Task 8: `ocb show` command

**Files:**
- Create: `src/commands/show.ts`
- Modify: `src/index.ts`

- [x] **Step 1: Write failing test**

```typescript
// tests/commands/show.test.ts
import { describe, it, expect } from "vitest";
import { buildMessageList } from "../../src/commands/show.js";
import type { ExportedMessage } from "../../src/types.js";

function msg(id: string, parentID: string | undefined, role: "user" | "assistant", text: string): ExportedMessage {
  return {
    info: { id, sessionID: "ses_x", parentID, role, time: { created: 1000 } },
    parts: [{ type: "text", text, id: "prt_x", sessionID: "ses_x", messageID: id }],
  };
}

describe("buildMessageList", () => {
  it("sorts messages by parentID chain", () => {
    const messages = [
      msg("msg_b", "msg_a", "assistant", "reply"),
      msg("msg_a", undefined, "user", "hello"),
    ];
    const list = buildMessageList(messages);
    expect(list[0].info.id).toBe("msg_a");
    expect(list[1].info.id).toBe("msg_b");
  });

  it("assigns 1-based sequence numbers", () => {
    const messages = [msg("msg_a", undefined, "user", "hello")];
    const list = buildMessageList(messages);
    expect(list[0].seq).toBe(1);
  });
});
```

- [x] **Step 2: Run test — expect FAIL**

```bash
npm test -- tests/commands/show.test.ts
```

- [x] **Step 3: Write `src/commands/show.ts`**

```typescript
import { exportSession } from "../lib/opencode.js";
import { resolveRef } from "../lib/ref.js";
import type { ExportedMessage } from "../types.js";

export interface IndexedMessage extends ExportedMessage {
  seq: number;
}

export function buildMessageList(messages: ExportedMessage[]): IndexedMessage[] {
  // Build map id → message
  const byId = new Map(messages.map((m) => [m.info.id, m]));

  // Find root (no parentID)
  const roots = messages.filter((m) => !m.info.parentID);
  if (roots.length === 0) return [];

  // Walk chain from root
  const ordered: ExportedMessage[] = [];
  const byParent = new Map<string, ExportedMessage>();
  for (const m of messages) {
    if (m.info.parentID) byParent.set(m.info.parentID, m);
  }

  let current: ExportedMessage | undefined = roots[0];
  while (current) {
    ordered.push(current);
    current = byParent.get(current.info.id);
  }

  return ordered.map((m, i) => ({ ...m, seq: i + 1 }));
}

function extractText(msg: ExportedMessage): string {
  for (const part of msg.parts) {
    if (part.type === "text" && part.text) return part.text.slice(0, 80);
  }
  return "(no text)";
}

function countToolCalls(msg: ExportedMessage): number {
  return msg.parts.filter((p) => p.type === "tool").length;
}

export async function showCommand(ref: string, cwd: string, opts: { m?: string; json?: boolean }): Promise<void> {
  const sid = await resolveRef(ref, cwd);
  const exported = await exportSession(sid);
  const list = buildMessageList(exported.messages);

  if (opts.json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  // Specific message detail mode
  if (opts.m) {
    const nums = opts.m.split(",").map((n) => parseInt(n.trim(), 10));
    for (const num of nums) {
      const msg = list.find((m) => m.seq === num);
      if (!msg) { console.log(`Message ${num} not found`); continue; }
      console.log(`\n[${msg.seq}] [${msg.info.role}]`);
      for (const part of msg.parts) {
        if (part.type === "text") console.log(part.text);
        else console.log(`<${part.type}>`);
      }
    }
    return;
  }

  // Default: summary list
  for (const msg of list) {
    const role = msg.info.role === "user" ? "User     " : "Assistant";
    const text = extractText(msg);
    const tools = countToolCalls(msg);
    const toolSuffix = tools > 0 ? ` (${tools} tool calls)` : "";
    console.log(`[${String(msg.seq).padStart(3)}]  [${role}]  "${text}"${toolSuffix}`);
  }
}
```

- [x] **Step 4: Run test — expect PASS**

```bash
npm test -- tests/commands/show.test.ts
```

- [x] **Step 5: Add to `src/index.ts`**

```typescript
import { showCommand } from "./commands/show.js";

program
  .command("show <ref>")
  .description("Show session message list")
  .option("-m <nums>", "Show specific message(s) detail, comma-separated")
  .option("--json", "Output raw JSON")
  .action(async (ref, opts) => {
    await showCommand(ref, process.cwd(), opts);
  });
```

- [x] **Step 6: Build and manual test**

```bash
npm run build
node dist/index.js show ses_2501c621effebHqPhFWqvvfguF
```

Expected: numbered message list of the current session.

- [x] **Step 7: Commit**

```bash
git add src/commands/show.ts tests/commands/show.test.ts src/index.ts
git commit -m "feat: ocb show command"
```

---

## Task 9: `ocb attach` command

**Files:**
- Create: `src/commands/attach.ts`
- Modify: `src/index.ts`

- [x] **Step 1: Write `src/commands/attach.ts`**

```typescript
import { listSessions } from "../lib/opencode.js";
import { readNames, writeNames } from "../lib/store.js";
import { shortId } from "../lib/format.js";

export async function attachCommand(name: string, cwd: string, opts: { s?: string }): Promise<void> {
  let sid: string;

  if (opts.s) {
    // Validate provided session-id exists
    const sessions = await listSessions();
    const found = sessions.find((s) => s.id === opts.s);
    if (!found) throw new Error(`Session ${opts.s} not found`);
    sid = opts.s;
  } else {
    // Use most recent session in current directory
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

  console.log(`✓ Created: ${name} → ${shortId(sid)}`);
}
```

- [x] **Step 2: Add to `src/index.ts`**

```typescript
import { attachCommand } from "./commands/attach.js";

program
  .command("attach <name>")
  .description("Create alias for a session")
  .option("-s <sid>", "Session ID to attach (default: most recent)")
  .action(async (name, opts) => {
    await attachCommand(name, process.cwd(), opts);
  });
```

- [x] **Step 3: Build and manual test**

```bash
npm run build
node dist/index.js attach current-session
node dist/index.js list
```

Expected: `current-session` appears in list.

- [x] **Step 4: Commit**

```bash
git add src/commands/attach.ts src/index.ts
git commit -m "feat: ocb attach command"
```

---

## Task 10: `ocb checkout` command

**Files:**
- Create: `src/commands/checkout.ts`
- Modify: `src/index.ts`

- [x] **Step 1: Write `src/commands/checkout.ts`**

```typescript
import { resolveRef } from "../lib/ref.js";
import { readState, writeState } from "../lib/store.js";
import { readNames } from "../lib/store.js";
import { shortId } from "../lib/format.js";

export async function checkoutCommand(ref: string, cwd: string): Promise<void> {
  const sid = await resolveRef(ref, cwd);

  // Find the name for this sid (if managed)
  const names = await readNames();
  const dirNames = names[cwd] ?? {};
  const name = Object.entries(dirNames).find(([, s]) => s === sid)?.[0] ?? null;

  const state = await readState();
  if (!state[cwd]) state[cwd] = { current: null };
  state[cwd].current = name ?? sid;
  await writeState(state);

  const label = name ? `${name} (${shortId(sid)})` : shortId(sid);
  console.log(`✓ Switched to ${label}`);
  console.log(`  Open session: opencode -s ${sid}`);
}
```

- [x] **Step 2: Add to `src/index.ts`**

```typescript
import { checkoutCommand } from "./commands/checkout.js";

program
  .command("checkout <ref>")
  .description("Switch active session")
  .action(async (ref) => {
    await checkoutCommand(ref, process.cwd());
  });
```

- [x] **Step 3: Build and manual test**

```bash
npm run build
node dist/index.js checkout current-session
node dist/index.js list
```

Expected: `*` marker on `current-session`.

- [x] **Step 4: Commit**

```bash
git add src/commands/checkout.ts src/index.ts
git commit -m "feat: ocb checkout command"
```

---

## Task 11: `ocb rename`, `ocb unmanage`, `ocb delete` commands

**Files:**
- Create: `src/commands/rename.ts`
- Create: `src/commands/unmanage.ts`
- Create: `src/commands/delete.ts`
- Modify: `src/index.ts`

- [x] **Step 1: Write `src/commands/rename.ts`**

```typescript
import { readNames, writeNames, readState, writeState } from "../lib/store.js";

export async function renameCommand(oldName: string, newName: string, cwd: string): Promise<void> {
  const names = await readNames();
  const dirNames = names[cwd] ?? {};
  if (!dirNames[oldName]) throw new Error(`No session named "${oldName}"`);
  if (dirNames[newName]) throw new Error(`Name "${newName}" already exists`);

  dirNames[newName] = dirNames[oldName];
  delete dirNames[oldName];
  names[cwd] = dirNames;
  await writeNames(names);

  // Update state if current was the old name
  const state = await readState();
  if (state[cwd]?.current === oldName) {
    state[cwd].current = newName;
    await writeState(state);
  }

  console.log(`✓ Renamed: ${oldName} → ${newName}`);
}
```

- [x] **Step 2: Write `src/commands/unmanage.ts`**

```typescript
import { resolveRef } from "../lib/ref.js";
import { readNames, writeNames, readState, writeState } from "../lib/store.js";

export async function unmanageCommand(ref: string, cwd: string): Promise<void> {
  const sid = await resolveRef(ref, cwd);
  const names = await readNames();
  const dirNames = names[cwd] ?? {};

  const entry = Object.entries(dirNames).find(([, s]) => s === sid);
  if (!entry) throw new Error(`Session not managed: ${ref}`);
  const [name] = entry;

  delete dirNames[name];
  names[cwd] = dirNames;
  await writeNames(names);

  // Clear state if current was this session
  const state = await readState();
  if (state[cwd]?.current === name) {
    state[cwd].current = null;
    await writeState(state);
  }

  console.log(`✓ Removed ${name} from management (session still exists)`);
}
```

- [x] **Step 3: Write `src/commands/delete.ts`**

```typescript
import { resolveRef } from "../lib/ref.js";
import { readNames, writeNames, readState, writeState } from "../lib/store.js";
import { deleteSession } from "../lib/opencode.js";
import readline from "readline/promises";

export async function deleteCommand(ref: string, cwd: string, opts: { force?: boolean }): Promise<void> {
  const sid = await resolveRef(ref, cwd);

  if (!opts.force) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`⚠ Delete session ${sid}? This cannot be undone. [y/N] `);
    rl.close();
    if (answer.toLowerCase() !== "y") {
      console.log("Aborted.");
      return;
    }
  }

  await deleteSession(sid);

  // Clean up local state
  const names = await readNames();
  const dirNames = names[cwd] ?? {};
  const entry = Object.entries(dirNames).find(([, s]) => s === sid);
  if (entry) {
    const [name] = entry;
    delete dirNames[name];
    names[cwd] = dirNames;
    await writeNames(names);

    const state = await readState();
    if (state[cwd]?.current === name) {
      state[cwd].current = null;
      await writeState(state);
    }
  }

  console.log(`✓ Deleted ${sid}`);
}
```

- [x] **Step 4: Add all three to `src/index.ts`**

```typescript
import { renameCommand } from "./commands/rename.js";
import { unmanageCommand } from "./commands/unmanage.js";
import { deleteCommand } from "./commands/delete.js";

program
  .command("rename <old> <new>")
  .description("Rename a session alias")
  .action(async (old, newName) => {
    await renameCommand(old, newName, process.cwd());
  });

program
  .command("unmanage <ref>")
  .description("Remove session from ocb management (session is not deleted)")
  .action(async (ref) => {
    await unmanageCommand(ref, process.cwd());
  });

program
  .command("delete <ref>")
  .description("Delete a session permanently")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (ref, opts) => {
    await deleteCommand(ref, process.cwd(), opts);
  });
```

- [x] **Step 5: Build and smoke test**

```bash
npm run build
node dist/index.js rename current-session my-session
node dist/index.js list
node dist/index.js unmanage my-session
node dist/index.js list
```

Expected: name changes, then session disappears from managed list.

- [x] **Step 6: Commit**

```bash
git add src/commands/rename.ts src/commands/unmanage.ts src/commands/delete.ts src/index.ts
git commit -m "feat: ocb rename, unmanage, delete commands"
```

---

## Task 12: Error Handling + Global Error Wrapper

**Files:**
- Modify: `src/index.ts`

- [x] **Step 1: Add global error handler to `src/index.ts`**

Wrap the `program.parse()` call:

```typescript
// Replace `program.parse();` at the bottom with:
program.parseAsync().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
```

Also, update each `.action(async (...) => { ... })` to propagate errors by wrapping the body:

```typescript
// Pattern for every command action:
.action(async (ref, opts) => {
  try {
    await showCommand(ref, process.cwd(), opts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
});
```

Apply this try/catch pattern to all command actions in `src/index.ts`.

- [x] **Step 2: Build and verify error output**

```bash
npm run build
node dist/index.js show nonexistent-ref
```

Expected: `Error: No session found for ref "nonexistent-ref" in ...`

- [x] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: global error handling for all commands"
```

---

## Task 13: Phase 1 Verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: End-to-end smoke test with real opencode sessions**

```bash
npm run build

# See all unmanaged sessions
node dist/index.js origin available

# Attach the current opencode session
node dist/index.js attach current-work

# List managed sessions
node dist/index.js list

# Show messages
node dist/index.js show current-work

# Show a specific message
node dist/index.js show current-work -m 1

# Switch to it
node dist/index.js checkout current-work

# List again — should show * marker
node dist/index.js list

# Rename it
node dist/index.js rename current-work my-work

# List
node dist/index.js list

# Unmanage
node dist/index.js unmanage my-work

# Confirm it's gone from list but still in origin available
node dist/index.js list
node dist/index.js origin available
```

All steps should produce expected output without errors.

- [ ] **Step 3: Link globally for convenience**

```bash
npm link
ocb list
ocb origin available
```

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: Phase 1 complete — core view and naming commands"
```
