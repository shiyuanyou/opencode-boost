# ocb - opencode boost

## 当前阶段

无活跃开发。所有 Phase 已完成。

## 已完成

- [x] Phase 1 — 查看 + 命名（list, show, attach, checkout, rename, unmanage, delete, origin）
- [x] Phase 2 — 分叉（checkout -b）+ 会话树（graph）
- [x] Phase 3 — 压缩（compact, rebase, reflog, rollback, model）
- [x] Phase 4 — 跨会话复用（inject, pick）
- [x] Phase 5 — 绕过 export（直读 SQLite）— `db-reader.ts` + `data-access.ts` 统一访问层 → [方案文档](superpowers/specs/2026-04-23-bypass-export.md)

## 待规划（按优先级）

### 高优先级

- [ ] `list` 命令增加 preview — 显示每个 session 的第一条用户消息预览（来源：bypass-export P0 收尾）
- [ ] E2E 测试验证活跃会话场景 — 确认 db-reader 在 opencode TUI 运行时仍可正常读取（来源：bypass-export P0 收尾）
- [ ] 语义修复 — `chain.ts` compact 组占位文本改用原文前 N 字而非原文拼接（详见代码 `repairChain` 函数）

### 低优先级

- [ ] session sync — 跨机器同步会话数据
- [ ] P1: 利用 opencode HTTP API（`localhost:4096`）实现实时交互和可视化 → 详见 [bypass-export 方案](superpowers/specs/2026-04-23-bypass-export.md) 路线 C
- [ ] P2: opencode 插件 — 进程内提供 ocb 核心能力（长期方案）→ 详见 [bypass-export 方案](superpowers/specs/2026-04-23-bypass-export.md) 路线 B
