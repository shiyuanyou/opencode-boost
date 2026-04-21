# AGENTS.md — opencode-boost (ocb)

## 这是什么

`ocb` 是 opencode 会话的外部管理工具。opencode 是一个 AI 编程助手 CLI，它的会话存在两个核心痛点：

1. **上下文窗口被失败尝试填满**——无法压缩或清理无效消息
2. **知识孤岛**——一个会话里搞明白的东西无法带到另一个会话

`ocb` 通过 opencode 官方 CLI（export/import/run/session）来解决这两个问题。

详细 idea 见 `docs/ideas.md`，当前主要设计方案见 `docs/superpowers/specs/2026-04-20-ocb-new.md`。

---

## 核心约束

**零直写 DB**：禁止直接读写 opencode 的 SQLite 数据库。所有操作通过 opencode CLI 完成。这是不可妥协的设计原则——opencode 没有公开数据库 schema，直写会在版本升级时静默破坏用户数据。

---

## 技术方向

- TypeScript + Node.js
- CLI 工具（不做 TUI，后期直接拓展 GUI）
- 通过子进程调用 opencode CLI，解析 stdout
