# opencode-boost

> opencode session manager — view, compress, fork, and reuse your AI coding sessions
>
> opencode 会话管理器 — 查看、压缩、分叉、复用你的 AI 编程会话

[English](#english) | [中文](#中文)

---

## English

`ocb` is a CLI tool that manages [opencode](https://opencode.ai) sessions externally. It solves two core pain points:

1. **Context window bloat** — failed attempts and dead ends fill up the context, with no way to compress or clean them
2. **Knowledge silos** — insights from one session can't be carried to another

### How it works

All operations go through the official `opencode` CLI (`export`/`import`/`run`/`session`). **Zero direct database access** — your data is safe across opencode upgrades.

```
$ ocb attach my-session         # give the current session a name
$ ocb list                      # list managed sessions
  my-session (ses_abc123)  just now
$ ocb show my-session           # view message list
$ ocb checkout my-session       # switch active session
$ ocb rename my-session v2      # rename
$ ocb unmanage v2               # remove from management (keeps session)
```

### Installation

```bash
git clone https://github.com/<you>/opencode-boost.git
cd opencode-boost
npm install
npm link
```

Requires [Node.js](https://nodejs.org/) >= 18 and [opencode](https://opencode.ai) >= 1.14.

### Commands

| Command | Description |
|---------|-------------|
| `ocb list` | List managed sessions |
| `ocb origin available` | List unmanaged sessions |
| `ocb show <ref>` | Show session messages |
| `ocb show <ref> -m 1,3` | Show specific message details |
| `ocb attach <name> [-s <sid>]` | Name a session |
| `ocb checkout <ref>` | Switch active session |
| `ocb rename <old> <new>` | Rename a session |
| `ocb unmanage <ref>` | Remove from management |
| `ocb delete <ref>` | Delete a session |

`<ref>` can be either a name or a raw session ID.

### Roadmap

- **Phase 1** (current): View + naming commands
- **Phase 2**: Fork and graph
- **Phase 3**: Compact, rebase, reflog, rollback
- **Phase 4**: Cross-session knowledge injection

---

## 中文

`ocb` 是一个 CLI 工具，用于外部管理 [opencode](https://opencode.ai) 会话。解决两个核心痛点：

1. **上下文窗口膨胀** — 失败尝试和死胡同填满上下文，无法压缩或清理
2. **知识孤岛** — 一个会话里搞明白的东西无法带到另一个会话

### 工作原理

所有操作通过 opencode 官方 CLI（`export`/`import`/`run`/`session`）完成。**零直写数据库** — opencode 升级不会破坏你的数据。

```
$ ocb attach my-session         # 给当前会话起个名字
$ ocb list                      # 列出已管理的会话
  my-session (ses_abc123)  just now
$ ocb show my-session           # 查看消息列表
$ ocb checkout my-session       # 切换活跃会话
$ ocb rename my-session v2      # 重命名
$ ocb unmanage v2               # 从管理中移除（会话保留）
```

### 安装

```bash
git clone https://github.com/<you>/opencode-boost.git
cd opencode-boost
npm install
npm link
```

需要 [Node.js](https://nodejs.org/) >= 18 和 [opencode](https://opencode.ai) >= 1.14。

### 命令

| 命令 | 说明 |
|------|------|
| `ocb list` | 列出已管理的会话 |
| `ocb origin available` | 列出未管理的会话 |
| `ocb show <ref>` | 查看会话消息列表 |
| `ocb show <ref> -m 1,3` | 查看指定消息详情 |
| `ocb attach <name> [-s <sid>]` | 给会话创建别名 |
| `ocb checkout <ref>` | 切换活跃会话 |
| `ocb rename <old> <new>` | 重命名会话 |
| `ocb unmanage <ref>` | 从管理中移除（不删除会话） |
| `ocb delete <ref>` | 删除会话 |

`<ref>` 可以是别名或原始 session ID。

### 路线图

- **Phase 1**（当前）：查看 + 命名命令
- **Phase 2**：分叉 + 会话树
- **Phase 3**：压缩、rebase、操作历史、回滚
- **Phase 4**：跨会话知识注入

---

## License

MIT
