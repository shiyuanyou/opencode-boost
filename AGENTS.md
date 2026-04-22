# AGENTS.md — opencode-boost (ocb)

opencode 会话管理 CLI。通过 opencode 官方 CLI 子进程管理会话的命名、切换、分叉、压缩和跨会话复用。

**开发前必读**：`docs/dev-workflow.md` — 完整的开发测试流程、opencode CLI 已知坑、E2E 断言规则。

设计文档：`docs/superpowers/specs/2026-04-20-ocb-new.md`。

## 不可违反

**零直写 DB**：禁止直接读写 opencode 的 SQLite。所有操作通过 `opencode` CLI 子进程（`execa`）完成。

## 开发命令

```bash
npm run build          # tsup → dist/index.js (ESM, 含 shebang)
npm run dev            # tsup --watch
npm test               # vitest run（单元测试，不需要 opencode）
npm run test:watch     # vitest watch
```

E2E（每次改动后必跑，消耗约 7 次 `opencode run` 的 token）：

```bash
npm run build && bash tests/e2e/run-e2e.sh
```

E2E 使用 `minimax-cn-coding-plan/MiniMax-M2.7` 便宜模型创建测试 session。

没有配置 lint / typecheck 脚本。

## 开发循环

```
写代码 → build + 单元测试 → commit + tag → E2E → 有问题？→ 修代码 → ...
```

完整流程和注意事项见 `docs/dev-workflow.md`。

## 架构

```
src/
  index.ts           # commander 入口，注册所有命令
  commands/*.ts      # 各命令实现（list, show, attach, checkout, graph, rename, unmanage, delete, origin, compact, rebase, reflog, rollback, inject, pick, model）
  lib/
    opencode.ts      # opencode CLI 调用 + 输出解析（parseExportOutput, parseSessionList, parseRunEventStream, parseModelsOutput）
    store.ts         # JSON 文件读写（names.json, state.json, forks.json, reflog.json, config.json）
    paths.ts         # $XDG_DATA_HOME/opencode-boost + $XDG_CONFIG_HOME/opencode-boost
    ref.ts           # 别名 → session-id 解析（先查 names，再当 raw id）
    format.ts        # 输出格式化
    chain.ts         # parentID 链修复算法（repairChain, rebuildExportJson）
    summarizer.ts    # LLM 摘要引擎（summarizeMessages, extractKnowledge, extractMessageTexts）
  types.ts           # SessionInfo, ExportedSession, Store, ReflogStore, ConfigStore 类型
```

- 数据存储：`$XDG_DATA_HOME/opencode-boost/`（`names.json` / `state.json` / `forks.json` / `reflog.json`），按项目目录（cwd）隔离
- 配置存储：`$XDG_CONFIG_HOME/opencode-boost/config.json`（模型别名、摘要模型配置）
- `listSessions(cwd)` 在源头过滤 `s.directory === cwd`，所有 command 和 ref 解析只操作当前目录的 session
- Fork 机制：`opencode run --session <sid> --fork --format json <message>`，超时 180s
- **所有 execa 调用必须加 `input: ""`**——opencode 在空 stdin pipe 上会阻塞等待输入
- Session ref 解析顺序：先在当前目录的 names 中查别名，不匹配则当作原始 session ID

## 代码约定

- ESM-only（`"type": "module"`），本地导入必须加 `.js` 后缀：`import { foo } from "./bar.js"`
- tsup 打包单一入口 `src/index.ts`，目标 Node 18
- 测试直接从 `src/` 导入（vitest，无 path alias）
- 无代码注释风格要求，但现有代码无注释

## 已知问题

- **活跃会话 export 截断**：当前正在使用的会话 export 出来 JSON 不完整。`checkout -b` 和 `compact` 依赖 export，已加 3 次重试 + 5s 退避。需先切到别的会话再操作。
- **rebase 需要交互式编辑器**：`rebase` 用 `$EDITOR` 打开计划文件，无法在 E2E 中自动化测试。
- **inject/pick 未测 E2E**：命令已实现，但需要消耗 LLM token 注入消息到目标会话，E2E 暂未覆盖。

## 进度

- **Phase 1 ✅** — 查看 + 命名（list, show, attach, checkout, rename, unmanage, delete, origin available）— 22/22 E2E
- **Phase 2 ✅** — 分叉（`checkout -b`）+ 会话树（`graph`）— 3/3 E2E
- **Phase 3 ✅** — 压缩（compact, rebase, reflog, rollback, model）— 8/8 E2E（rebase 除外）
- **Phase 4 🔧** — 跨会话复用（inject, pick）— 命令已实现，无 E2E
