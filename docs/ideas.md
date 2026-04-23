# ocb - opencode boost

## 当前阶段

**Phase 5: 绕过 export — 直读数据层** → [方案文档](superpowers/specs/2026-04-23-bypass-export.md)

核心思路：用 `better-sqlite3` 只读查询 opencode 的 SQLite 数据库，彻底绕过 `opencode export` 的慢和失败问题。P0 完成后，所有依赖 export 的命令（show、checkout -b、compact 等）迁移到直读模式。

## 已完成

- [x] Phase 1 — 查看 + 命名（list, show, attach, checkout, rename, unmanage, delete, origin）
- [x] Phase 2 — 分叉（checkout -b）+ 会话树（graph）
- [x] Phase 3 — 压缩（compact, rebase, reflog, rollback, model）
- [x] Phase 4 — 跨会话复用（inject, pick）

## 待规划

- [ ] session sync — 跨机器同步会话数据
