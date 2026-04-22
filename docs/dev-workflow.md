# ocb 开发测试流程

面向 Phase 3/4 开发的操作手册。所有命令从项目根目录执行。

---

## 开发循环

```
写代码 → build + 单元测试 → commit + tag → E2E → 有问题？
  ↑                                                       |
  └───────────────────────────────────────────────────────┘
```

每一步的命令：

```bash
# 1. 构建并跑单元测试（秒级，不消耗 token）
npm run build && npm test

# 2. 确认通过后提交
git add -A && git commit -m "<type>: <描述>"
git tag v0.1.x  # patch 递增

# 3. 跑 E2E（消耗约 4 次 opencode run 的 token）
npm run build && bash tests/e2e/run-e2e.sh

# 4. E2E 通过后推送
git push && git push --tags
```

**顺序很重要**：单元测试 → commit → E2E → push。不要先 push 再测。

---

## 单元测试

```bash
npm test               # vitest run
npm run test:watch     # 监听模式
```

- 从 `src/` 直接 import，路径加 `.js` 后缀
- 不需要 opencode，纯解析逻辑测试
- 改了函数签名必须补测试——特别是 `src/lib/` 下的函数

---

## E2E 测试

```bash
npm run build && bash tests/e2e/run-e2e.sh
```

- 在 `/tmp` 下创建隔离的 git 项目和 session，测试完自动清理
- 前置条件：opencode 已安装且已登录（需要 API key）
- 脚本：`tests/e2e/run-e2e.sh`，辅助函数：`tests/e2e/lib.sh`

### 写新 E2E 用例的规则

1. **断言 short ID 而非 title**——session title 是 `New session - <timestamp>`，不是用户消息内容
   ```bash
   # ✓ 正确：断言 session 的 short ID
   --assert "${PA_S1_SID:0:15}"
   # ✗ 错误：断言消息内容出现在 title 里
   --assert "E2E-PA-S1"
   # ✗ 错误：只验行数不验内容
   --min-lines 3
   ```

2. **attach 用 `-s` 明确绑定**——不带 `-s` 会绑到最新 session，可能是活跃状态导致 export 截断

3. **setup 后等 session idle**——已内置 `sleep 5`，如果还出现 export 截断，可适当加长

4. **空数组用安全语法**——`set -euo pipefail` 下 `${arr[@]}` 在空时会报错，用 `${arr[@]+"${arr[@]}"}`

### E2E 用的辅助函数（lib.sh）

```bash
create_session "消息内容"     # 调 opencode run，返回 session ID
run_test ID "描述" cwd cmd exit_code --assert "模式" --assert-not "模式" --min-lines N
```

---

## opencode CLI 的已知坑

| 坑 | 表现 | 影响 |
|---|---|---|
| 非项目目录返回全量 session | 在非 git 目录 `session list --format json` 返回所有 `projectId: "global"` 的 session | ocb 已在 `listSessions(cwd)` 源头过滤，不影响 |
| 活跃会话 export 截断 | 当前正在使用的会话 `opencode export` 返回不完整 JSON | `show`、`checkout -b` 对活跃会话可能失败；等 session idle 后恢复 |
| session title 不是消息内容 | title 是 `New session - <ISO timestamp>` | 断言用 short ID，不要断言 title |
| NDJSON 中 SID 的字段路径 | v1.14.18 使用 `{"type":"step_start","sessionID":"ses_..."}`，不是旧的 `{"type":"session","session":{"id":"ses_..."}}` | bash 提取用 `grep -o 'ses_[a-zA-Z0-9]*'` 兜底；TS 解析两格式都支持 |
| macOS 无 `timeout` 命令 | `create_session` 不能用 `timeout` 包裹 | 不加 timeout，依赖 opencode 自身结束 |
| **execa 必须加 `input: ""`** | opencode 在空 stdin pipe 上阻塞等待输入，导致子进程永不退出 | 所有 `execa("opencode", [...])` 必须带 `{ input: "" }` |
| `opencode import` 校验严格 | import 要求 id/slug/directory/title/version/time 字段存在 | `rebuildExportJson` 生成新 `ses_ocb_` ID，保留其他字段 |
| import 输出非 JSON | `opencode import` 输出 `Imported session: ses_xxx` 纯文本 | `importSession` 用正则匹配，不走 JSON 解析 |

---

## 项目约定

### 代码

- ESM-only，本地 import 加 `.js` 后缀：`import { foo } from "./bar.js"`
- tsup 单一入口 `src/index.ts`，目标 Node 18
- 零直写 DB——所有 opencode 数据操作通过 `execa("opencode", [...])` 子进程

### 架构

```
src/
  index.ts              # commander 入口
  commands/<cmd>.ts     # 各命令，接收 cwd 参数
  lib/
    opencode.ts         # opencode CLI 调用 + 输出解析（listSessions, exportSession, forkSession, importSession, runSession, injectMessage, deleteSession, listModels）
    store.ts            # JSON 文件读写（names.json, state.json, forks.json, reflog.json, config.json）
    ref.ts              # 别名 → session-id 解析（先查 names，再当 raw id，都限定在 cwd 内）
    format.ts           # shortId, relativeTime, formatSession
    paths.ts            # $XDG_DATA_HOME/opencode-boost + $XDG_CONFIG_HOME/opencode-boost
    chain.ts            # parentID 链修复算法（repairChain, rebuildExportJson）
    summarizer.ts       # LLM 摘要引擎（summarizeMessages, extractKnowledge, extractMessageTexts）
  types.ts              # SessionInfo, ExportedSession, Store, ReflogStore, ConfigStore 类型
```

### 数据存储

`$XDG_DATA_HOME/opencode-boost/`（默认 `~/.local/share/opencode-boost/`）：
- `names.json` — `{ [directory]: { [name]: sessionId } }`
- `state.json` — `{ [directory]: { current: name | null } }`
- `forks.json` — `{ [directory]: { [childSid]: { parentSessionId, parentMessageId, timestamp } } }`
- `reflog.json` — `{ [directory]: [{ name, sessionId, operation, from, timestamp }] }`

`$XDG_CONFIG_HOME/opencode-boost/`（默认 `~/.config/opencode-boost/`）：
- `config.json` — `{ summarizer: { method, model }, models: { [alias]: providerID/modelID } }`

### 新增命令的模式

1. 在 `src/commands/` 新建文件，导出 `async function xxxCommand(cwd: string, ...): Promise<void>`
2. 在 `src/index.ts` 注册 commander 子命令，调用时传 `process.cwd()`
3. 用 `listSessions(cwd)` 获取 session 列表（已过滤 directory）
4. 用 `resolveRef(ref, cwd)` 解析用户输入的别名或 raw session ID
5. 在 `tests/` 下补单元测试
6. 在 `tests/e2e/run-e2e.sh` 补 E2E 用例

---

## 剩余工作

Phase 3 — compact E2E 偶发失败（import 环节需调试），rebase 需交互式编辑器无法在 E2E 中测
Phase 4 — inject/pick 命令已实现，未写 E2E（需要 LLM token 消耗）

设计文档：`docs/superpowers/specs/2026-04-20-ocb-new.md`
