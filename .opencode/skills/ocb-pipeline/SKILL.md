---
name: ocb-pipeline
description: >
  ocb (opencode-boost) 开发管线。当用户要求修改 ocb 功能、修 bug、加命令、改命令行为、
  重构 ocb 代码、或提到"修 ocb"、"改 ocb"、"ocb pipeline"、"ocb 管线"时触发。
  也可以用于创建新的实现计划（plan）——当用户说"做个计划"、"规划一下"、"pipeline"时。
  管线覆盖：写计划 → build + 单元测试 → commit → E2E → 有问题修代码 → 循环。
---

# ocb Pipeline

opencode-boost 的标准化开发管线。所有改动走同一套流程。

## 什么时候用

- 用户要求修改、新增、重构 ocb 的任何功能
- 用户要求"做个计划"或"pipeline"
- 用户贴了 ocb 的真实使用输出要求修复

## 管线流程

```
写计划 → build + 单测 → commit → E2E → 修代码 → 循环
```

### Phase 1: 计划（可选）

如果改动涉及 2 个以上文件，先写计划。

1. 在 `docs/superpowers/plans/` 下创建 `YYYY-MM-DD-<name>.md`
2. 计划格式参考已有文件，包含：
   - 文件结构表（哪些文件要改/创建）
   - 按 Task 拆分，每个 Task 有完整的代码（零 placeholder）
   - 每个 Task 包含：写测试 → 验证失败 → 写实现 → 验证通过 → commit
3. 计划写完问用户选择执行方式（subagent-driven 或 inline）

### Phase 2: 实现 + 单元测试

对每个 Task：

1. **先写/改测试**（vitest，从 `src/` 直接 import，加 `.js` 后缀）
2. **跑测试确认 fail**：`npx vitest run <test-file>`
3. **写/改实现代码**
4. **跑测试确认 pass**

测试约定：
- mock `../../src/lib/opencode.js`（因为依赖 opencode CLI 子进程）
- mock `../../src/lib/store.js`（因为读写 JSON 文件）
- 不 mock `format.ts`、`ref.ts` 等纯函数
- 新 command 必须补 `tests/commands/<cmd>.test.ts`
- 新 lib 函数必须补 `tests/lib/<name>.test.ts`

### Phase 3: Build + Commit

```bash
npm run build && npm test
```

通过后：
```bash
git add -A && git commit -m "<type>: <描述>"
```

commit type：`feat`（新功能）、`fix`（修 bug）、`refactor`（重构）、`test`（补测试）

### Phase 4: E2E（消耗 token，约 7 次 opencode run）

```bash
npm run build && bash tests/e2e/run-e2e.sh
```

E2E 写新用例的规则（来自 `docs/dev-workflow.md`）：
1. 断言 short ID 而非 title
2. attach 用 `-s` 明确绑定
3. setup 后等 session idle（已内置 `sleep 5`）
4. 空数组用 `${arr[@]+"${arr[@]}"}` 安全语法

E2E 可委托 subagent 执行，prompt 模板：

```
项目根目录: /path/to/opencode-boost
依次执行：
1. npm run build
2. npm test
3. bash tests/e2e/run-e2e.sh（timeout 600s，消耗 token）

每步报告 PASS/FAIL + 错误详情。
返回格式：
BUILD: PASS/FAIL
UNIT: PASS/FAIL (N tests)
E2E: PASS/FAIL (N/M passed)
FAILURES: [test ID + 错误摘要，或 "none"]
```

### Phase 5: 推送（用户确认后）

```bash
git push && git push --tags
```

## 关键架构约束

- **零直写 DB**：所有 opencode 数据操作通过 `execa("opencode", [...])` 子进程
- **ESM-only**：`import { foo } from "./bar.js"`（必须加 `.js` 后缀）
- **execa 必须加 `input: ""`**：opencode 在空 stdin pipe 上阻塞
- **tsconfig 需要 `types: ["node"]`**：否则 `tsc --noEmit` 全是噪音

## 关键文件速查

| 用途 | 文件 |
|------|------|
| 开发流程 | `docs/dev-workflow.md` |
| 架构说明 | `AGENTS.md` |
| E2E 脚本 | `tests/e2e/run-e2e.sh` + `tests/e2e/lib.sh` |
| opencode 交互 | `src/lib/opencode.ts` |
| 数据存储 | `src/lib/store.ts` |
| 命令注册 | `src/index.ts` |
| 类型定义 | `src/types.ts` |
