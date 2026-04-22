# opencode-boost

> opencode 会话管理器 — 查看、压缩、分叉、复用你的 AI 编程会话
>
> opencode session manager — view, compress, fork, and reuse your AI coding sessions

[English](docs/README_en.md) | 中文

---

`ocb` 是一个 CLI 工具，用于外部管理 [opencode](https://opencode.ai) 会话。解决两个核心痛点：

1. **上下文窗口膨胀** — 失败尝试和死胡同填满上下文，无法压缩或清理
2. **知识孤岛** — 一个会话里搞明白的东西无法带到另一个会话

核心原则：**零直写数据库**。所有操作通过 opencode 官方 CLI 完成，opencode 升级不会破坏你的数据。

## 安装

### 人工安装

```bash
git clone https://github.com/shiyuanyou/opencode-boost.git
cd opencode-boost
npm install
npm link
```

需要 [Node.js](https://nodejs.org/) >= 18 和 [opencode](https://opencode.ai) >= 1.14。

### 让 AI agent 安装

把以下指令粘贴给 opencode / Claude / Cursor 等 AI 编程助手：

```
在 /tmp 下安装 opencode-boost 并 link 到全局：

git clone https://github.com/shiyuanyou/opencode-boost.git /tmp/opencode-boost
cd /tmp/opencode-boost && npm install && npm link

验证：ocb --version
前置：需要 Node >= 18 和 opencode >= 1.14
```

## 测试

单元测试（49 个，秒级）：

```bash
npm test
```

E2E 测试（34 个，需要 opencode 已登录，消耗 token）：

```bash
npm run build && bash tests/e2e/run-e2e.sh
```

测试在 `/tmp` 下创建隔离的 git 项目和会话，不影响你的真实工作。每次运行消耗约 7 次 `opencode run` 的 token。

## 快速开始

```bash
# 查看当前目录有哪些未被管理的会话
$ ocb origin available
  ses_2501c621eff  just now  "修复登录 bug"

# 给最近的会话起个名字
$ ocb attach fix-login
✓ Created: fix-login → ses_2501c621eff

# 列出已管理的会话
$ ocb list
  fix-login (ses_2501c621eff)  just now

# 查看会话消息列表
$ ocb show fix-login
[  1]  [User     ]  "修复登录 bug"
[  2]  [Assistant]  我来检查一下登录相关的代码... (3 tool calls)
[  3]  [User     ]  "试试用 JWT 方案"
[  4]  [Assistant]  已修改 3 个文件... (2 tool calls)
[  5]  [User     ]  "现在加上测试"
[  6]  [Assistant]  测试已添加... (4 tool calls)

# 查看某条消息的完整内容
$ ocb show fix-login -m 2
[2] [assistant]
我来检查一下登录相关的代码，首先看看当前的认证模块结构。
<tool>
<step-start>

# 切换活跃会话
$ ocb checkout fix-login
✓ Switched to fix-login (ses_2501c621eff)
  Open session: opencode -s ses_2501c621eff

# 切换后 list 会显示 * 标记
$ ocb list
* fix-login (ses_2501c621eff)  just now

# 从当前会话 fork 一个新分支
$ ocb checkout -b try-jwt fix-login
⏳ Forking from fix-login (ses_2501c621eff)...
✓ Created try-jwt (ses_3a7f9b2c1d), switched
  Open session: opencode -s ses_3a7f9b2c1d

# 查看会话树
$ ocb graph
* fix-login (ses_2501c621eff) just now
  └── [6] try-jwt (ses_3a7f9b2c1d) just now

# 压缩消息（手动摘要）
$ ocb compact fix-login -m 1-4 --manual "尝试了 session 方案但不行，改用 JWT"
⏳ Forking fix-login (ses_2501c621eff) -> new session...
✓ fix-login updated: ses_2501c621eff -> ses_ocb_xxx (compressed)
  Messages 1-4 compressed to 1 summary

# 压缩消息（LLM 自动摘要）
$ ocb compact fix-login -m 1-4 --model minimax-cn-coding-plan/MiniMax-M2.7

# 查看操作历史
$ ocb reflog fix-login-c1
fix-login-c1 operation history:
  [2] ses_ocb_xxx  compact  just now  from ses_2501c621eff
  [1] ses_2501c621  (original)  just now

# 回退到之前的版本
$ ocb rollback fix-login-c1 -f
✓ fix-login-c1 rolled back to ses_2501c621eff

# 交互式 rebase（用编辑器选择 keep/compact/drop）
$ ocb rebase fix-login

# 跨会话注入知识
$ ocb inject fix-login try-jwt
⏳ Exporting source session...
⏳ Extracting key knowledge...
⏳ Injecting into target session...
✓ Injected fix-login knowledge into ses_3a7f9b2c1d

# 挑选特定消息注入当前会话
$ ocb pick fix-login -m 2,4

# 重命名
$ ocb rename fix-login auth-v2
✓ Renamed: fix-login → auth-v2

# 从管理中移除（会话本身不会被删除）
$ ocb unmanage auth-v2
✓ Removed auth-v2 from management (session still exists)

# 彻底删除会话（需要确认）
$ ocb delete auth-v2
⚠ Delete session ses_2501c621eff? This cannot be undone. [y/N] y
✓ Deleted ses_2501c621eff

# 查看 / 设置摘要模型
$ ocb model
$ ocb model --list
$ ocb model fast minimax-cn-coding-plan/MiniMax-M2.7
```

## 命令参考

### 会话查看与管理

| 命令 | 说明 |
|------|------|
| `ocb list` | 列出当前目录下已管理的会话，`*` 标记当前活跃会话 |
| `ocb origin available` | 列出当前目录下未被管理的会话 |
| `ocb show <ref>` | 查看会话消息列表，每条消息显示序号、角色和摘要 |
| `ocb show <ref> -m 1,3` | 查看指定消息的完整内容（逗号分隔序号） |
| `ocb show <ref> --json` | 以 JSON 格式输出消息列表 |
| `ocb attach <name>` | 给最近的会话创建别名 |
| `ocb attach <name> -s <sid>` | 给指定 session-id 创建别名 |
| `ocb checkout <ref>` | 切换活跃会话（更新 state.json） |
| `ocb rename <old> <new>` | 重命名会话别名 |
| `ocb unmanage <ref>` | 从 ocb 管理中移除（会话保留） |
| `ocb delete <ref>` | 彻底删除会话（调用 `opencode session delete`） |
| `ocb delete <ref> -f` | 跳过确认直接删除 |

### 分叉与会话树

| 命令 | 说明 |
|------|------|
| `ocb checkout -b <name> <ref>` | 从指定会话 fork 出新会话并命名 |
| `ocb checkout -b <name> <ref> --model <m>` | 指定模型 fork |
| `ocb graph` | 显示会话 fork 树（ASCII，含 fork 位置） |

### 压缩与历史

| 命令 | 说明 |
|------|------|
| `ocb compact <ref> -m <from>-<to>` | 压缩指定范围消息为一条摘要 |
| `ocb compact <ref> -m <range> --manual '摘要'` | 手动提供摘要（不消耗 token） |
| `ocb compact <ref> -m <range> --model <m>` | 指定模型生成摘要 |
| `ocb rebase <ref>` | 交互式 rebase（编辑器中选择 keep/compact/drop） |
| `ocb reflog [ref]` | 查看操作历史（无参数查看当前会话） |
| `ocb rollback <name>` | 回退到历史版本 |
| `ocb rollback <name> -f` | 跳过确认直接回退 |

### 跨会话复用

| 命令 | 说明 |
|------|------|
| `ocb inject <source> [target]` | 从 source 会话提取知识注入 target（默认当前会话） |
| `ocb inject <source> [target] --raw` | 跳过摘要，注入原始文本 |
| `ocb pick <ref> -m 1,3,5` | 从 source 会话挑选指定消息注入当前会话 |

### 配置

| 命令 | 说明 |
|------|------|
| `ocb model` | 查看当前摘要模型配置 |
| `ocb model <alias> <provider/model>` | 设置模型别名 |
| `ocb model --list` | 列出所有可用模型 |

`<ref>` 可以是别名（如 `fix-login`）或原始 session ID（如 `ses_2501c621eff`）。

## 数据存储

`ocb` 的自有数据存储在 `$XDG_DATA_HOME/opencode-boost/`：

```
~/.local/share/opencode-boost/
├── names.json    # 别名 → session-id 映射（按项目目录）
├── forks.json    # fork 关系记录（parentSessionId + parentMessageId）
├── state.json    # 每个项目的当前活跃会话
└── reflog.json   # 操作历史（compact/rebase/rollback 记录）
```

配置存储在 `$XDG_CONFIG_HOME/opencode-boost/`：

```
~/.config/opencode-boost/
└── config.json   # 模型别名、摘要模型配置
```

`names.json` 示例：

```json
{
  "/Users/you/projects/my-app": {
    "fix-login": "ses_2501c621eff",
    "add-tests": "ses_3a7f9b2c1d"
  }
}
```

## 路线图

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 查看 + 命名命令 | ✅ 已完成 |
| Phase 2 | 分叉（`checkout -b`）+ 会话树（`graph`） | ✅ 已完成 |
| Phase 3 | 压缩（`compact`）、rebase、操作历史（`reflog`）、回滚（`rollback`） | ✅ 已完成 |
| Phase 4 | 跨会话知识注入（`inject`、`pick`） | 🔧 已实现，待 E2E |

## License

[MIT](LICENSE)
