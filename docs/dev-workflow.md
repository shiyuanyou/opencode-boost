# ocb 开发流程手册

基于 v0.1.0 → v0.1.3 的真实开发调试过程整理。

---

## 1. 改代码前：理解边界条件

**教训**：`opencode session list --format json` 的行为依赖当前目录是否是 git 项目。在 git 项目内，只返回该项目的 session；在非 git 目录，返回所有 `projectId: "global"` 的 session。

**实践**：调用外部 CLI 时，永远不要假设输出是干净的。在 `ocb` 里，我们选择在最底层（`listSessions`）做 directory 过滤，而不是在各个 command 里各自过滤——这样漏掉一个的概率为零。

---

## 2. 改代码后立即跑的命令

```bash
npm run build && npm test
```

- 单元测试不需要 opencode，秒级完成
- `npm run build` 必须先跑，E2E 用的是 `dist/index.js`

---

## 3. E2E 测试

```bash
npm run build && bash tests/e2e/run-e2e.sh
```

### 已知的坑

| 坑 | 原因 | 解决 |
|---|---|---|
| SID 提取为空 | `opencode run` 的 NDJSON 格式是 `{"type":"session","session":{"id":"ses_..."}}`，不是 `"sessionID":"ses_..."` | `lib.sh` 用 `grep '"type":"session"' | sed` 提取 |
| `nounset` 报错 | `set -euo pipefail` 下空数组 `${arr[@]}` 会触发 unbound variable | 用 `${arr[@]+"${arr[@]}"}` |
| 断言 title 包含消息内容 | `opencode` 的 session title 是 `New session - <timestamp>`，不是用户消息原文 | 断言用 `--min-lines` 或 short ID |
| 最后创建的 session export 截断 | 活跃会话的 export JSON 不完整，这是 opencode 的 bug | `attach` 时用 `-s` 明确绑定较早的 session；`show` 测试避免用 `-m` 对最新 session |
| macOS 没有 `timeout` 命令 | Linux 常见，macOS 不自带 | `create_session` 不加 timeout（opencode 自身会结束） |

### E2E 测试开销

每次消耗约 4 次 `opencode run` 的 token。短消息（如 `[MARKER]`）比长消息快得多且结果一样。

---

## 4. Git 流程

### 每次改动后

```bash
# 1. 确认测试通过
npm run build && npm test

# 2. 提交
git add -A
git commit -m "<type>: <description>"

# 3. 打 tag（语义化版本）
git tag v0.1.x

# 4. E2E（消耗 token，确认无误后再跑）
npm run build && bash tests/e2e/run-e2e.sh
```

### Tag 命名

跟随 `package.json` 的 `version`。同版本多次修复递增 patch：`v0.1.0` → `v0.1.1` → `v0.1.2`。

### 推送

```bash
git push && git push --tags
```

---

## 5. 发现问题后的调试循环

```
发现问题 → 定位根因 → 修代码 → 单元测试 → 提交+tag → E2E → 还有问题？
     ↑                                                                    |
     └────────────────────────────────────────────────────────────────────┘
```

### 这次的实际循环

| 轮次 | 发现 | 修复 | tag |
|---|---|---|---|
| 1 | `listSessions` 不过滤 directory，可能操作错误的 session | `listSessions(cwd?)` 源头过滤 | v0.1.1 |
| 2 | `create_session` SID 提取为空；nounset 空数组崩溃 | 修正 grep 模式；`${arr[@]+"..."}` | v0.1.2 |
| 3 | E2E 断言 title 包含消息内容（实际是 timestamp）；attach 绑到活跃 session 导致 export 截断 | 改断言策略；attach 用 `-s` 明确绑定 | v0.1.3 |

### 关键原则

- **每一轮只修一个问题**，不要一次改多个不相关的东西
- **每次修改后先跑单元测试**，确认不破坏已有逻辑
- **E2E 放在最后**，因为消耗 token
- **`2>/dev/null || true` 是调试的敌人**——吞掉错误信息会让问题完全不可见。生产代码可以吞，测试代码必须保留错误输出

---

## 6. 单元测试覆盖要点

改了核心函数签名后，必须补充测试覆盖：

- `listSessions()` 无参数：返回全量（向后兼容）
- `listSessions(cwd)` 有参数：只返回匹配 directory 的
- `resolveRef` 的 raw session ID 查找：必须限定在 cwd 内
- `attach -s`：拒绝不属于 cwd 的 session
