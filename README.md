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

```bash
git clone https://github.com/<you>/opencode-boost.git
cd opencode-boost
npm install
npm link
```

需要 [Node.js](https://nodejs.org/) >= 18 和 [opencode](https://opencode.ai) >= 1.14。

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
```

## 命令参考

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

`<ref>` 可以是别名（如 `fix-login`）或原始 session ID（如 `ses_2501c621eff`）。

## 数据存储

`ocb` 的自有数据存储在 `$XDG_DATA_HOME/opencode-boost/`：

```
~/.local/share/opencode-boost/
├── names.json    # 别名 → session-id 映射（按项目目录）
└── state.json    # 每个项目的当前活跃会话
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
| Phase 2 | 分叉（`checkout -b`）+ 会话树（`graph`） | 🔲 |
| Phase 3 | 压缩（`compact`）、rebase、操作历史（`reflog`）、回滚（`rollback`） | 🔲 |
| Phase 4 | 跨会话知识注入（`inject`、`pick`） | 🔲 |

## License

[MIT](LICENSE)
