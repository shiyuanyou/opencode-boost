# Tech Debt & Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all type errors, eliminate code duplication, improve test coverage, and sync dead docs — based on the comprehensive code review of 2026-04-22.

**Architecture:** Pure refactoring — no new features. All changes preserve existing behavior. Tasks are grouped into independent batches that can be executed by sub-agents in parallel.

**Tech Stack:** TypeScript, Node.js, Vitest, tsup, execa

---

## Task Classification

| Mode | Tasks | Rationale |
|------|-------|-----------|
| **Sub-agent** | 1, 2, 3, 4, 5 | Each is self-contained: read code → edit → test → commit. Parallel-safe. |
| **Main thread** | 6 (E2E) | Consumes tokens, needs human attention on failure. |
| **Sub-agent** | 7, 8 | Docs + final cleanup, no code risk. |

---

## Task 1: tsconfig + Type Error Fixes (Sub-agent)

**Sub-agent prompt:**
> Fix two real type errors exposed by `tsc --noEmit`, plus enable `tsc` to actually work by fixing tsconfig.
> 
> Project root: `/Users/shiyuanyou/Library/Mobile Documents/com~apple~CloudDocs/Projects/opencode-boost`
> 
> **Changes:**
> 
> 1. `tsconfig.json` — add `"types": ["node"]` to compilerOptions. Current file is:
> ```json
> {
>   "compilerOptions": {
>     "target": "ES2022",
>     "module": "ESNext",
>     "moduleResolution": "bundler",
>     "strict": true,
>     "outDir": "dist",
>     "rootDir": "src",
>     "declaration": true
>   },
>   "include": ["src"]
> }
> ```
> 
> 2. `src/commands/pick.ts:33-34` — `picked` is `(IndexedMessage | undefined)[]`. Current code:
> ```typescript
> const picked = nums.map((n) => messages.find((m) => m.seq === n));
> const missing = nums.filter((n, i) => !picked[i]);
> if (missing.length > 0) throw new Error(`Messages not found: ${missing.join(", ")}`);
> const validPicked = picked.filter(Boolean);
> const content = extractMessageTexts(validPicked!);
> ```
> Fix: use a type guard instead of `filter(Boolean)`:
> ```typescript
> const picked = nums.map((n) => messages.find((m) => m.seq === n));
> const missing = nums.filter((n, i) => !picked[i]);
> if (missing.length > 0) throw new Error(`Messages not found: ${missing.join(", ")}`);
> const validPicked = picked.filter((m): m is import("../../src/types.js").ExportedMessage => m !== undefined);
> const content = extractMessageTexts(validPicked);
> ```
> Wait — pick.ts imports `IndexedMessage` from show.ts which extends `ExportedMessage`. So the type guard should use the `IndexedMessage` type that's already available via `buildMessageList`. Actually, `extractMessageTexts` accepts `ExportedMessage[]` and `IndexedMessage extends ExportedMessage`, so just narrow to non-undefined. The cleanest fix:
> ```typescript
> const picked = nums
>   .map((n) => messages.find((m) => m.seq === n))
>   .filter((m): m is typeof messages[number] => m !== undefined);
> const missing = nums.filter((n) => !messages.find((m) => m.seq === n));
> if (missing.length > 0) throw new Error(`Messages not found: ${missing.join(", ")}`);
> const content = extractMessageTexts(picked);
> ```
> 
> 3. `src/commands/rebase.ts:103` — passes `RebasePlanEntry[]` to `summarizeMessages()` which expects `ExportedMessage[]`. Current:
> ```typescript
> const summaryText = await summarizeMessages(group, opts.model);
> ```
> Fix: extract `.message` from each entry:
> ```typescript
> const summaryText = await summarizeMessages(
>   group.map((e) => e.message),
>   opts.model
> );
> ```
> 
> 4. `src/commands/rename.ts` — variable `old` on line 108 of index.ts. In `src/index.ts:108` the rename action callback has parameter named `old`. Rename it to `oldName`:
> ```typescript
> // in src/index.ts, the rename action:
> .action(async (oldName: string, newName: string) => {
>   try {
>     await renameCommand(oldName, newName, process.cwd());
>   } catch (err) {
> ```
> 
> **After all edits, verify:**
> ```bash
> npm run build
> npm test
> ```
> Both must pass. Do NOT commit — I will commit together.

**Files:**
- Modify: `tsconfig.json`
- Modify: `src/commands/pick.ts`
- Modify: `src/commands/rebase.ts`
- Modify: `src/index.ts`

- [ ] Step 1: Add `"types": ["node"]` to tsconfig.json compilerOptions
- [ ] Step 2: Fix pick.ts type narrowing with type guard
- [ ] Step 3: Fix rebase.ts to extract `.message` from plan entries before passing to summarizeMessages
- [ ] Step 4: Rename `old` → `oldName` in index.ts rename action
- [ ] Step 5: Verify `npm run build && npm test` both pass
- [ ] Step 6: Commit: `fix: tsconfig types + pick/rebase type errors + rename param shadow`

---

## Task 2: Extract `exportWithRetry()` Utility (Sub-agent)

**Sub-agent prompt:**
> Extract the duplicated "export with retry on truncated JSON" pattern into a shared utility.
> 
> Project root: `/Users/shiyuanyou/Library/Mobile Documents/com~apple~CloudDocs/Projects/opencode-boost`
> 
> **The pattern appears in two files:**
> 
> 1. `src/commands/checkout.ts:62-74`:
> ```typescript
> let parentExport;
> for (let attempt = 0; attempt < 3; attempt++) {
>   try {
>     parentExport = await exportSession(parentSid);
>     break;
>   } catch (err) {
>     if (attempt < 2 && (err as Error).message.includes("truncated")) {
>       console.log(`  Session still active, waiting... (attempt ${attempt + 1}/3)`);
>       await new Promise((r) => setTimeout(r, 5000));
>       continue;
>     }
>     throw err;
>   }
> }
> if (!parentExport) throw new Error("Failed to export parent session after retries");
> ```
> 
> 2. `src/commands/compact.ts:36-49` — identical pattern.
> 
> **Create `src/lib/retry.ts`:**
> ```typescript
> import { exportSession } from "./opencode.js";
> import type { ExportedSession } from "../types.js";
> 
> export async function exportWithRetry(sid: string): Promise<ExportedSession> {
>   for (let attempt = 0; attempt < 3; attempt++) {
>     try {
>       return await exportSession(sid);
>     } catch (err) {
>       if (attempt < 2 && (err as Error).message.includes("truncated")) {
>         console.log(`  Session still active, waiting... (attempt ${attempt + 1}/3)`);
>         await new Promise((r) => setTimeout(r, 5000));
>         continue;
>       }
>       throw err;
>     }
>   }
>   throw new Error(`Failed to export session ${sid} after retries`);
> }
> ```
> 
> **Update `src/commands/checkout.ts`:**
> - Add `import { exportWithRetry } from "../lib/retry.js";`
> - Replace the retry loop block (lines 62-75) with:
> ```typescript
> const parentExport = await exportWithRetry(parentSid);
> ```
> 
> **Update `src/commands/compact.ts`:**
> - Add `import { exportWithRetry } from "../lib/retry.js";`
> - Remove `import { exportSession, forkSession, deleteSession, importSession } from "../lib/opencode.js";` — replace with only the ones still used: `import { forkSession, deleteSession, importSession } from "../lib/opencode.js";`
> - Replace the retry loop block (lines 36-49) with:
> ```typescript
> const exported = await exportWithRetry(forkSid);
> ```
> 
> **Verify:**
> ```bash
> npm run build && npm test
> ```
> 
> **Commit:** `refactor: extract exportWithRetry from checkout + compact`

**Files:**
- Create: `src/lib/retry.ts`
- Modify: `src/commands/checkout.ts`
- Modify: `src/commands/compact.ts`

- [ ] Step 1: Create `src/lib/retry.ts` with `exportWithRetry()`
- [ ] Step 2: Update `src/commands/checkout.ts` to use it
- [ ] Step 3: Update `src/commands/compact.ts` to use it
- [ ] Step 4: Verify `npm run build && npm test`
- [ ] Step 5: Commit: `refactor: extract exportWithRetry from checkout + compact`

---

## Task 3: Fix inject.ts Dynamic Import + reflog.ts Duplicate Imports (Sub-agent)

**Sub-agent prompt:**
> Fix two minor import issues.
> 
> Project root: `/Users/shiyuanyou/Library/Mobile Documents/com~apple~CloudDocs/Projects/opencode-boost`
> 
> **1. `src/commands/inject.ts:23`** — has a dynamic `await import("../lib/store.js")` inside the function body, but the file already statically imports `readState` from the same module. Fix: add `readNames` to the static import at the top and remove the dynamic import.
> 
> Current top of file:
> ```typescript
> import { resolveRef } from "../lib/ref.js";
> import { exportSession, injectMessage } from "../lib/opencode.js";
> import { readState } from "../lib/store.js";
> ```
> 
> Change to:
> ```typescript
> import { resolveRef } from "../lib/ref.js";
> import { exportSession, injectMessage } from "../lib/opencode.js";
> import { readState, readNames } from "../lib/store.js";
> ```
> 
> Then in the function body (~line 23), replace:
> ```typescript
> const { readNames } = await import("../lib/store.js");
> ```
> with just removing that line (readNames is now in scope from the static import).
> 
> **2. `src/commands/reflog.ts:1-3`** — three separate import lines from the same module:
> ```typescript
> import { readReflog } from "../lib/store.js";
> import { readNames } from "../lib/store.js";
> import { readState } from "../lib/store.js";
> ```
> 
> Merge to one line:
> ```typescript
> import { readReflog, readNames, readState } from "../lib/store.js";
> ```
> 
> Also check if `readNames` is actually used in the file — if not, remove it from the import. (Read the file first.)
> 
> **Verify:**
> ```bash
> npm run build && npm test
> ```
> 
> **Commit:** `fix: remove dynamic import in inject.ts, merge duplicate imports in reflog.ts`

**Files:**
- Modify: `src/commands/inject.ts`
- Modify: `src/commands/reflog.ts`

- [ ] Step 1: Fix inject.ts — add readNames to static import, remove dynamic import line
- [ ] Step 2: Fix reflog.ts — merge imports, remove unused ones
- [ ] Step 3: Verify `npm run build && npm test`
- [ ] Step 4: Commit: `fix: remove dynamic import in inject.ts, merge duplicate imports in reflog.ts`

---

## Task 4: Extract `actionWrapper` for index.ts Error Handling (Sub-agent)

**Sub-agent prompt:**
> Refactor the 15 identical try/catch blocks in `src/index.ts` into a reusable wrapper.
> 
> Project root: `/Users/shiyuanyou/Library/Mobile Documents/com~apple~CloudDocs/Projects/opencode-boost`
> 
> Currently every command action looks like:
> ```typescript
> .action(async (...args) => {
>   try {
>     await someCommand(...);
>   } catch (err) {
>     console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
>     process.exit(1);
>   }
> });
> ```
> 
> **Add a wrapper function near the top of `src/index.ts`, after the imports:**
> ```typescript
> function action(fn: (...args: unknown[]) => Promise<void>) {
>   return async (...args: unknown[]) => {
>     try {
>       await fn(...args);
>     } catch (err) {
>       console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
>       process.exit(1);
>     }
>   };
> }
> ```
> 
> Then replace every `.action(async (...) => { try { ... } catch { ... } })` with `.action(action(async (...) => { ... }))`. The inner function body only contains the command call, no try/catch.
> 
> For example, the `list` command changes from:
> ```typescript
> .action(async () => {
>   try {
>     await listCommand(process.cwd());
>   } catch (err) {
>     console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
>     process.exit(1);
>   }
> })
> ```
> to:
> ```typescript
> .action(action(async () => {
>   await listCommand(process.cwd());
> }))
> ```
> 
> Do this for ALL 16 commands in the file. The parameters of the inner function should keep their typed signatures.
> 
> **Verify:**
> ```bash
> npm run build && npm test
> ```
> 
> **Commit:** `refactor: extract action wrapper to eliminate 15 duplicate try/catch blocks`

**Files:**
- Modify: `src/index.ts`

- [ ] Step 1: Add `action()` wrapper function after imports in index.ts
- [ ] Step 2: Replace all 16 try/catch action handlers with `action(async (...) => ...)`
- [ ] Step 3: Verify `npm run build && npm test`
- [ ] Step 4: Commit: `refactor: extract action wrapper to eliminate duplicate try/catch blocks`

---

## Task 5: Add summarizer.ts Unit Tests (Sub-agent)

**Sub-agent prompt:**
> Add unit tests for `src/lib/summarizer.ts`. Currently only `extractMessageTexts` (a trivial function) has tests. The core logic — `resolveModel`, `ensureModelConfig`, `summarizeMessages`, `extractKnowledge` — has zero coverage.
> 
> Project root: `/Users/shiyuanyou/Library/Mobile Documents/com~apple~CloudDocs/Projects/opencode-boost`
> 
> **Read first:** `src/lib/summarizer.ts`, `tests/lib/summarizer.test.ts`, `src/lib/store.ts`
> 
> **Create new tests in `tests/lib/summarizer.test.ts` (append to existing file):**
> 
> Mock the external dependencies:
> ```typescript
> vi.mock("../../src/lib/opencode.js", () => ({
>   runSession: vi.fn(),
>   deleteSession: vi.fn(),
>   importSession: vi.fn(),
> }));
> vi.mock("../../src/lib/store.js", () => ({
>   readConfig: vi.fn(),
>   writeConfig: vi.fn(),
> }));
> ```
> 
> **Test cases to add:**
> 
> 1. `resolveModel` — with modelOverride that's a known alias → resolves via config.models
> 2. `resolveModel` — with modelOverride that's a raw provider/model string → returns as-is
> 3. `resolveModel` — no override, reads default from config → resolves alias
> 4. `resolveModel` — no override, no config → returns undefined
> 5. `ensureModelConfig` — config has model → returns resolved model (doesn't print)
> 6. `ensureModelConfig` — no config → prints guidance, returns undefined
> 7. `summarizeMessages` — calls runSession with correct prompt, deletes temp session, returns text
> 8. `extractKnowledge` — calls runSession with inject prompt, deletes temp session, returns text
> 
> Follow the existing test style: no comments, concise, use `msg()` helper from the existing test file if needed.
> 
> **Verify:**
> ```bash
> npm test
> ```
> All tests (old + new) must pass.
> 
> **Commit:** `test: add unit tests for summarizer resolveModel/summarizeMessages/extractKnowledge`

**Files:**
- Modify: `tests/lib/summarizer.test.ts`

- [ ] Step 1: Read current test file and summarizer.ts source
- [ ] Step 2: Add mocks for opencode.js and store.js
- [ ] Step 3: Write resolveModel tests (4 cases)
- [ ] Step 4: Write ensureModelConfig tests (2 cases)
- [ ] Step 5: Write summarizeMessages test
- [ ] Step 6: Write extractKnowledge test
- [ ] Step 7: Verify `npm test` passes
- [ ] Step 8: Commit: `test: add unit tests for summarizer resolveModel/summarizeMessages/extractKnowledge`

---

## Task 6: E2E Verification + Git Tag (Main Thread)

Run after Tasks 1-5 are all committed and verified.

- [ ] **Step 1: Build**
```bash
npm run build
```

- [ ] **Step 2: Unit tests**
```bash
npm test
```

- [ ] **Step 3: E2E** (consumes ~7 opencode run tokens)
```bash
bash tests/e2e/run-e2e.sh
```

- [ ] **Step 4: Bump version and tag**
```bash
npm version patch  # 0.2.0 → 0.2.1
git tag v0.2.1
```

---

## Task 7: Sync Dead Docs (Sub-agent)

**Sub-agent prompt:**
> Clean up two dead doc issues.
> 
> Project root: `/Users/shiyuanyou/Library/Mobile Documents/com~apple~CloudDocs/Projects/opencode-boost`
> 
> **1. `tests/e2e/task.json`** is stale — Phase 2 tests still say `"skip": true` but they're actually running in `run-e2e.sh`. Update task.json to match the current reality:
> - Phase 2 tests (T24, T25): remove `"skip": true` and `"skip_reason"`
> - Add Phase 3 tests (T26-T33) that are in `run-e2e.sh` but missing from `task.json`
> - Phase 1 tests (T01-T22): the current task.json references "E2E-PA-S1" markers in assertions, but `run-e2e.sh` uses short SIDs. Update assertions in task.json to match what run-e2e.sh actually asserts. Read `run-e2e.sh` carefully to align.
> 
> **2. `docs/dev-workflow.md:69`** says "当前 49 个测试" — update this number after the new summarizer tests land. Count: existing 49 + new ~8 tests ≈ 57. Update the exact number after counting.
> 
> Also update line 82: "当前 34 个测试" for E2E. Count actual tests in run-e2e.sh.
> 
> **Commit:** `docs: sync task.json with actual E2E, update test counts in dev-workflow`

**Files:**
- Modify: `tests/e2e/task.json`
- Modify: `docs/dev-workflow.md`

- [ ] Step 1: Read run-e2e.sh to understand current E2E test structure
- [ ] Step 2: Update task.json Phase 2/3 tests to match reality
- [ ] Step 3: Update dev-workflow.md test counts
- [ ] Step 4: Commit: `docs: sync task.json with actual E2E, update test counts`

---

## Task 8: Update AGENTS.md (Sub-agent — after all other tasks)

**Sub-agent prompt:**
> Update AGENTS.md to reflect the new workflow and codebase changes.
> 
> Project root: `/Users/shiyuanyou/Library/Mobile Documents/com~apple~CloudDocs/Projects/opencode-boost`
> 
> **Read first:** `AGENTS.md` (current), `docs/dev-workflow.md`
> 
> **Changes to make:**
> 
> 1. In **架构** section, add `lib/retry.ts` to the list:
> ```
>     retry.ts          # Export with retry+backoff for active session truncation
> ```
> 
> 2. In **已知问题** section, add:
> ```
> - **tsconfig 需 `types: ["node"]`**：已修复。如果重新生成 tsconfig 记得加回来，否则 `tsc --noEmit` 全是噪音。
> ```
> 
> 3. In **开发命令** section, add typecheck command:
> ```bash
> npx tsc --noEmit       # 类型检查（不输出文件，只报错）
> ```
> 
> 4. Update **进度** section test counts if they changed.
> 
> 5. In **代码约定** section, add:
> ```
> - 所有 command action 通过 `action()` 包装器统一错误处理（index.ts），不手写 try/catch
> - `exportWithRetry()` 处理活跃会话 export 截断的重试逻辑，compact/checkout 必须使用它而非裸调 exportSession
> ```
> 
> **Commit:** `docs: update AGENTS.md with retry.ts, action wrapper, typecheck convention`

**Files:**
- Modify: `AGENTS.md`

- [ ] Step 1: Read current AGENTS.md
- [ ] Step 2: Add retry.ts to architecture list
- [ ] Step 3: Add tsconfig note to known issues
- [ ] Step 4: Add typecheck to dev commands
- [ ] Step 5: Add action() wrapper + exportWithRetry() conventions
- [ ] Step 6: Commit: `docs: update AGENTS.md with retry.ts, action wrapper, typecheck convention`

---

## Execution Order

```
Task 1 (tsconfig + types)  ──┐
Task 2 (exportWithRetry)    ──┤  ← 4 sub-agents in parallel
Task 3 (imports cleanup)    ──┤
Task 4 (action wrapper)     ──┤
Task 5 (summarizer tests)   ──┘
         │
         ▼
Task 6 (E2E + tag)              ← main thread, after all above
         │
         ▼
Task 7 (dead docs)              ← sub-agent
Task 8 (AGENTS.md)              ← sub-agent, after Task 7
```

**Total: 8 tasks, 6 sub-agent, 1 main thread, 1 final sub-agent wave**
