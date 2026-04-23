# ocb 开发测试流程

面向所有 Phase 开发的操作手册。所有命令从项目根目录执行。

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
git tag v0.x.y

# 3. 跑 E2E（消耗约 7 次 opencode run 的 token）
npm run build && bash tests/e2e/run-e2e.sh

# 4. E2E 通过后推送
git push && git push --tags
```

**顺序很重要**：单元测试 → commit → E2E → push。不要先 push 再测。

### 自测委托 subagent

主对话保持干净，自测和 E2E 交给 subagent 执行。主 agent 只发一个 Task 调用，subagent 返回浓缩结果。

**Prompt 模板**（复制给 subagent）：

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

也可分两步：先 build + unit（秒级），通过后再跑 E2E（分钟级）。

---

## 单元测试

```bash
npm test               # vitest run
npm run test:watch     # 监听模式
```

- 从 `src/` 直接 import，路径加 `.js` 后缀
- 不需要 opencode，纯解析逻辑测试
- 改了函数签名必须补测试——特别是 `src/lib/` 下的函数
- 当前 75 个测试，覆盖：chain（8）、opencode（17）、attach（7）、sync（4）、store（6）、graph（4）、ref（4）、list（3）、summarizer（10）、retry（3）、show（4）、paths（3）、reflog（2）

---

## E2E 测试

```bash
npm run build && bash tests/e2e/run-e2e.sh
```

- 在 `/tmp` 下创建隔离的 git 项目和 session，测试完自动清理
- 前置条件：opencode 已安装且已登录（需要 API key）
- 脚本：`tests/e2e/run-e2e.sh`，辅助函数：`tests/e2e/lib.sh`
- 当前 36 个测试（Phase 1: 24 + Phase 2: 3 + Phase 3: 9）

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

5. **compact/reflog 测试用显式名字查询**——`ocb reflog <name>` 而非无参 `ocb reflog`（无参依赖 state.current，可能不是预期值）

6. **rollback 默认回退一步**——不传 step 参数时 `ocb rollback <name> -f` 回到 reflog 中的前一步

### E2E 用的辅助函数（lib.sh）

```bash
create_session "消息内容"     # 调 opencode run，返回 session ID
run_test ID "描述" cwd cmd exit_code --assert "模式" --assert-not "模式" --min-lines N
```

### E2E 测试清单

| ID | 测试项 | Phase |
|----|--------|-------|
| T01 | `origin available` 显示废弃提示 | 1 |
| T02 | `attach -s` 命名指定会话 | 1 |
| T03 | `attach -s` 命名第二个会话 | 1 |
| T04 | `list` 显示 managed + unmanaged 会话 | 1 |
| T05 | `origin available` 废弃提示不显示 session | 1 |
| T06 | `show` 显示消息列表 | 1 |
| T07 | `show -m` 显示指定消息详情 | 1 |
| T08 | `checkout` 切换活跃会话 | 1 |
| T09 | `list` 显示 `*` 活跃标记 | 1 |
| T10 | `rename` 重命名别名 | 1 |
| T11 | `list` 反映新名称 | 1 |
| T12 | `show` 用新名称访问 | 1 |
| T13 | `show` 用原始 session-id 访问 | 1 |
| T14 | `unmanage` 移除管理 | 1 |
| T15 | `list` 仍显示 unmanaged 会话 | 1 |
| T16 | `origin available` 废弃提示 | 1 |
| T17 | 跨项目隔离：project-b 只看自己的 session | 1 |
| T17b | project-b 无 `-s` attach 最新 session | 1 |
| T18 | project-b 独立 list | 1 |
| T19 | project-b 独立 show | 1 |
| T20 | `delete -f` 彻底删除会话 | 1 |
| T21 | `origin available` 删除后废弃提示 | 1 |
| T22 | 不存在的 ref 返回错误 | 1 |
| T22b | `attach --all` 自动命名所有 unmanaged | 1 |
| T22c | `list` 在 `--all` 后不显示 unmanaged | 1 |
| T23 | `checkout -b` 从命名会话 fork | 2 |
| T24 | fork 后出现在 list | 2 |
| T25 | `graph` 显示 fork 树 | 2 |
| T26 | `reflog` 无条目时提示 | 3 |
| T27 | `compact --manual` 压缩消息 | 3 |
| T28 | `reflog` 显示 compact 条目 | 3 |
| T29 | compact 创建 `-c1` 后缀新名 | 3 |
| T30 | `rollback` 回退到上一版本 | 3 |
| T31 | `reflog` 显示 rollback 条目 | 3 |
| T32 | `model` 显示无配置 | 3 |
| T33 | `model --list` 列出可用模型 | 3 |

---

## opencode CLI 的已知坑

| 坑 | 表现 | 影响 / 解决方案 |
|---|---|---|
| 非项目目录返回全量 session | 在非 git 目录 `session list --format json` 返回所有 `projectId: "global"` 的 session | ocb 已在 `listSessions(cwd)` 源头过滤，不影响 |
| 活跃会话 export 截断 | 当前正在使用的会话 `opencode export` 返回不完整 JSON | `show`、`checkout -b`、`compact` 对活跃会话可能失败；已加 5 次重试 + 8s 退避，并用 `exportWithRetry` |
| session title 不是消息内容 | title 是 `New session - <ISO timestamp>` | 断言用 short ID，不要断言 title |
| NDJSON 中 SID 的字段路径 | v1.14.18 使用 `{"type":"step_start","sessionID":"ses_..."}`，不是旧的 `{"type":"session","session":{"id":"ses_..."}}` | bash 提取用 `grep -o 'ses_[a-zA-Z0-9]*'` 兜底；TS 解析两格式都支持 |
| macOS 无 `timeout` 命令 | `create_session` 不能用 `timeout` 包裹 | 不加 timeout，依赖 opencode 自身结束 |
| **execa 必须加 `input: ""`** | opencode 在空 stdin pipe 上阻塞等待输入，导致子进程永不退出 | 所有 `execa("opencode", [...])` 必须带 `{ input: "" }` |
| `opencode import` 校验严格 | import 要求 id/slug/directory/title/version/time 存在，且每条消息需要 `agent`(string) + `model`(object) + `sessionID`(string) | `rebuildExportJson` 生成新 `ses_ocb_` ID 并更新所有 sessionID；`repairChain` 摘要消息补上 agent/model 字段 |
| import 输出非 JSON | `opencode import` 输出 `Imported session: ses_xxx` 纯文本 | `importSession` 用正则匹配，不走 JSON 解析 |
| **`opencode -c` 慢（5-10s+）** | `getCurrentSession()` 检测活跃 session，实测可卡住 5s+ | 不得在高频命令（list）路径上调用；checkout 等低频命令可用 |

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
    opencode.ts         # opencode CLI 调用 + 输出解析（listSessions, exportSession, forkSession, importSession, runSession, injectMessage, deleteSession, listModels, getCurrentSession）
    store.ts            # JSON 文件读写（names.json, state.json, forks.json, reflog.json, config.json）
    ref.ts              # 别名 → session-id 解析（先查 names，再当 raw id，都限定在 cwd 内）
    format.ts           # shortId, relativeTime, formatSession, formatUnmanagedSession
    paths.ts            # $XDG_DATA_HOME/opencode-boost + $XDG_CONFIG_HOME/opencode-boost
    sync.ts             # 与 opencode 实际状态同步（syncStateWithOpencode）
    retry.ts            # Export with retry+backoff for active session truncation (5 retries, 8s delay)
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

## 未覆盖的功能

- **rebase** — 命令已实现，需要 `$EDITOR` 交互，无法在 E2E 中自动化测试
- **inject** — 命令已实现，消耗 LLM token 向目标会话注入知识摘要，无 E2E
- **pick** — 命令已实现，消耗 LLM token 向当前会话注入指定消息，无 E2E
- **compact 使用 LLM 摘要**（非 `--manual`）— 功能已实现，E2E 中用 `--manual` 绕过 token 消耗

设计文档：`docs/superpowers/specs/2026-04-20-ocb-new.md`
