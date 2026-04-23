---
name: ocb-pipeline
description: >
  ocb (opencode-boost) 开发管线。当用户要求修改 ocb 功能、修 bug、加命令、改命令行为、
  重构 ocb 代码、或提到"修 ocb"、"改 ocb"、"ocb pipeline"、"ocb 管线"时触发。
  也可以用于创建新的实现计划（plan）——当用户说"做个计划"、"规划一下"、"pipeline"时。
  管线覆盖：读实践 → 写计划 → build + 单测 → commit → E2E → 学习 → 循环。
---

# ocb Pipeline

opencode-boost 的标准化开发管线。所有改动走同一套流程。

## 什么时候用

- 用户要求修改、新增、重构 ocb 的任何功能
- 用户要求"做个计划"或"pipeline"
- 用户贴了 ocb 的真实使用输出要求修复

## Phase 0: 文档上下文（每次管线启动必做）

在写任何计划或代码之前，先读取实践知识库，确保不重复犯错：

1. **读取 `docs/practices.md`** — 项目已知的 best practices 和 anti-patterns
2. **检查 `docs/superpowers/plans/` 是否有相关 audit** — 如 UX audit、架构 review
3. **检查 `AGENTS.md` 的架构约束** — 零直写 DB、ESM-only、execa input 等

这一步确保管线不会偏离项目已积累的认知。

## 管线流程

```
Phase 0 读文档 → Phase 1 写计划 → Phase 2 实现 → Phase 3 build+commit
→ Phase 4 E2E → Phase 5 学习(写实践) → 循环
```

### Phase 1: 计划（改动 ≥ 2 文件时必做）

1. 在 `docs/superpowers/plans/` 下创建 `YYYY-MM-DD-<name>.md`
2. 计划格式参考已有文件，包含：
   - 文件结构表（哪些文件要改/创建）
   - 按 Task 拆分，每个 Task 有完整的代码（零 placeholder）
   - 每个 Task 包含：写测试 → 验证失败 → 写实现 → 验证通过 → commit
3. 计划开头标注从 `docs/practices.md` 引用了哪些实践
4. 计划写完立即执行，默认使用 subagent-driven 方式，不暂停等待用户选择

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

commit type：`feat`（新功能）、`fix`（修 bug）、`refactor`（重构）、`test`（补测试）、`docs`（文档）

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

### Phase 5: 学习 — 写实践（每次 debug 后必做）

当管线中遇到以下情况时，将新认知写入 `docs/practices.md`：

**写入 Best Practices 的时机**：
- 发现了一个好的设计模式并验证有效
- 从参考工具（git/gh/docker）中学到了一个可迁移的做法

**写入 Anti-Patterns 的时机**：
- 踩了一个坑并花了 > 5 分钟才定位
- 发现现有代码有一个反复导致问题的模式
- 代码 review 中指出的问题

**写入格式**（每条一行，极简）：
- Best Practice：`- <具体做法>（<原因>）`
- Anti-Pattern：`- <错误做法>（<后果>）`

**去重**：写入前先 grep `docs/practices.md`，已存在的不再重复。

### Phase 6: 推送（管线自动执行）

```bash
git push && git push --tags
```

## Subagent 上下文注入

当使用 subagent 执行 Task 时，每个 subagent prompt 必须包含：

1. **项目根目录路径**
2. **本 Task 涉及的文件列表及变更类型**
3. **相关的 practices 引用**（从 `docs/practices.md` 中 grep 关键词）
4. **验证命令**：`npm run build && npm test`
5. **不要 commit** — 主 agent 统一 commit

这样 subagent 不需要自己翻找文档，直接获得聚焦的上下文。

## 关键架构约束

- **零直写 DB**：所有 opencode 数据操作通过 `execa("opencode", [...])` 子进程
- **ESM-only**：`import { foo } from "./bar.js"`（必须加 `.js` 后缀）
- **execa 必须加 `input: ""`**：opencode 在空 stdin pipe 上阻塞
- **tsconfig 需要 `types: ["node"]`**：否则 `tsc --noEmit` 全是噪音

## 关键文件速查

| 用途 | 文件 |
|------|------|
| 实践知识库 | `docs/practices.md` |
| 开发流程 | `docs/dev-workflow.md` |
| 架构说明 | `AGENTS.md` |
| UX 审计 | `docs/superpowers/plans/2026-04-23-ux-audit.md` |
| 实现计划 | `docs/superpowers/plans/` |
| E2E 脚本 | `tests/e2e/run-e2e.sh` + `tests/e2e/lib.sh` |
| opencode 交互 | `src/lib/opencode.ts` |
| 数据存储 | `src/lib/store.ts` |
| 命令注册 | `src/index.ts` |
| 类型定义 | `src/types.ts` |

## 管线内文档维护规则

1. `docs/practices.md` — 管线运行中持续更新，不单独 commit，随最近的相关 commit 一起提交
2. `docs/dev-workflow.md` — 测试数量变化时同步更新
3. `AGENTS.md` — 架构变化时同步更新
4. `docs/superpowers/plans/*.md` — 计划完成后标记完成状态，不删除（保留历史）
