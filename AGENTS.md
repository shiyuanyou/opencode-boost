# AGENTS.md — opencode-boost (ocb)

opencode 会话管理 CLI。通过 opencode 官方 CLI 子进程管理会话的命名、切换、分叉。设计文档：`docs/superpowers/specs/2026-04-20-ocb-new.md`。

## 不可违反

**零直写 DB**：禁止直接读写 opencode 的 SQLite。所有操作通过 `opencode` CLI 子进程（`execa`）完成。

## 开发命令

```bash
npm run build          # tsup → dist/index.js (ESM, 含 shebang)
npm run dev            # tsup --watch
npm test               # vitest run（单元测试，不需要 opencode）
npm run test:watch     # vitest watch
```

E2E（每次改动后必跑，消耗约 4 次 `opencode run` 的 token）：

```bash
npm run build && bash tests/e2e/run-e2e.sh
```

没有配置 lint / typecheck 脚本。

## 架构

```
src/
  index.ts           # commander 入口，注册所有命令
  commands/*.ts      # 各命令实现（list, show, attach, checkout, graph, rename, unmanage, delete, origin）
  lib/
    opencode.ts      # opencode CLI 调用 + 输出解析（parseExportOutput, parseSessionList, parseRunEventStream）
    store.ts         # JSON 文件读写（names.json, state.json, forks.json）
    paths.ts         # $XDG_DATA_HOME/opencode-boost
    ref.ts           # 别名 → session-id 解析（先查 names，再当 raw id）
    format.ts        # 输出格式化
  types.ts           # SessionInfo, ExportedSession, Store 类型
```

- 数据存储：`$XDG_DATA_HOME/opencode-boost/`（`names.json` / `state.json` / `forks.json`），按项目目录（cwd）隔离
- Fork 机制：`opencode run --session <sid> --fork --format json <message>`，超时 120s
- Session ref 解析顺序：先在当前目录的 names 中查别名，不匹配则当作原始 session ID

## 代码约定

- ESM-only（`"type": "module"`），本地导入必须加 `.js` 后缀：`import { foo } from "./bar.js"`
- tsup 打包单一入口 `src/index.ts`，目标 Node 18
- 测试直接从 `src/` 导入（vitest，无 path alias）
- 无代码注释风格要求，但现有代码无注释

## 已知问题

- **活跃会话 export 截断**：当前正在使用的会话 export 出来 JSON 不完整。`checkout -b` 依赖 export 获取 lastMessageId，无法 fork 当前活跃会话——需先切到别的会话。

## 进度

- **Phase 1 ✅** — 查看 + 命名（list, show, attach, checkout, rename, unmanage, delete, origin available）
- **Phase 2 ✅** — 分叉（`checkout -b`）+ 会话树（`graph`）
- **Phase 3 🔲** — 压缩（compact, rebase, reflog, rollback）
- **Phase 4 🔲** — 跨会话复用（inject, pick）
