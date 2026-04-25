# AGENTS.md — opencode-boost (ocb)

opencode 会话管理 CLI。通过 opencode CLI 子进程和 SQLite 只读查询管理会话的命名、切换、分叉、压缩和跨会话复用。

## 文档系统

| 文档 | 用途 |
|------|------|
| `docs/architecture.md` | **项目架构**：模块职责、数据流、代码目录、类型系统 |
| `docs/dev-workflow.md` | **开发循环**：构建/测试/E2E 命令、opencode CLI 已知坑、E2E 断言规则 |
| `docs/practices.md` | **开发实践**：从真实开发中提炼的 best practices 和 anti-patterns（管线每次运行时读取） |
| `docs/ideas.md` | **待规划功能**：全局 TODO、各阶段进度、下一步计划 |
| `docs/superpowers/specs/` | **设计文档**：已完成和进行中的 feature spec |
| `docs/superpowers/plans/` | **执行计划**：已执行的计划存档 |

设计文档（历史参考，部分过时）：`docs/superpowers/specs/2026-04-20-ocb-new.md`。

## 不可违反

**零直写 DB**：禁止直接写入 opencode 的 SQLite。只读访问通过 `better-sqlite3`（`src/lib/db-reader.ts`），写操作仍通过 `opencode` CLI 子进程。

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

类型检查（不输出文件，只报错）：

```bash
npx tsc --noEmit
```

## 开发循环

```
写代码 → build + 单元测试 → commit + tag → E2E → 有问题？→ 修代码 → ...
```

完整流程和注意事项见 `docs/dev-workflow.md`。

## 开发管线

用 `ocb-pipeline` skill 驱动。管线覆盖：读实践 → 写计划 → build + 单测 → commit → E2E → 学习 → 循环。详见 `.opencode/skills/ocb-pipeline/SKILL.md`。

## 代码目录

```
src/
  index.ts           # commander 入口，注册所有命令
  commands/*.ts      # 各命令实现
  lib/
    opencode.ts      # opencode CLI 调用 + 输出解析
    store.ts         # JSON 文件读写（names/state/forks/reflog/config）
    paths.ts         # $XDG_DATA_HOME/opencode-boost + $XDG_CONFIG_HOME/opencode-boost
    ref.ts           # 别名 → session-id 解析（先查 names，再短 ID 前缀匹配）
    format.ts        # 输出格式化（shortId, relativeTime, formatSession）
    sync.ts          # 与 opencode 实际状态同步（syncStateWithOpencode）
    db-reader.ts     # SQLite 只读查询层（better-sqlite3，绕过 export CLI）
    data-access.ts   # 统一访问层（先 db-reader，fallback exportWithRetry）
    retry.ts         # Export with retry+backoff for active session truncation
    chain.ts         # parentID 链修复算法（repairChain, rebuildExportJson）
    summarizer.ts    # LLM 摘要引擎（summarizeMessages, extractKnowledge, extractMessageTexts）
  types.ts           # SessionInfo, ExportedSession, Store, ReflogStore, ConfigStore 类型
```

完整架构图和数据流见 `docs/architecture.md`。

## 数据存储

- **运行时数据**：`$XDG_DATA_HOME/opencode-boost/`（names.json / state.json / forks.json / reflog.json），按项目目录隔离
- **配置**：`$XDG_CONFIG_HOME/opencode-boost/config.json`（模型别名、摘要模型）
- **opencode DB**：`$XDG_DATA_HOME/opencode/opencode.db`（只读，better-sqlite3 WAL 模式）

## 代码约定

- ESM-only（`"type": "module"`），本地导入必须加 `.js` 后缀
- ESM 中 require native addon 必须用 `createRequire(import.meta.url)`
- tsup 打包单一入口 `src/index.ts`，目标 Node 18
- 测试直接从 `src/` 导入（vitest，无 path alias）
- 所有用户可见输出统一用 `shortId()`（15 字符）
- 所有 command action 通过 `action()` 包装器统一错误处理
- 所有需要读取会话数据的命令通过 `getSessionData()` 获取，不直接调用 `exportWithRetry` 或 `exportSession`
- 所有 `execa` 调用必须加 `input: ""`

## 进度

- **Phase 1 ✅** — 查看 + 命名 — 24/24 E2E
- **Phase 2 ✅** — 分叉 + 会话树 — 3/3 E2E
- **Phase 3 ✅** — 压缩 + 历史 — 9/9 E2E
- **Phase 4 ✅** — 跨会话复用 — 无 E2E
- **Phase 5 ✅** — 绕过 export（直读 SQLite）— db-reader + data-access 统一访问层

共 105 单元测试 + 36 E2E 测试，全部通过。

## 已知问题

- **`opencode -c` 慢（5-10s+）**：不得在高频命令（list）的路径上调用
- **tsconfig 需要 `types: ["node"]`**：如果重新生成 tsconfig 记得加回来
- **rebase 需要交互式编辑器**：无法在 E2E 中自动化测试
- **inject/pick 未测 E2E**：消耗 LLM token，暂未覆盖
