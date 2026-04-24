# opencode-boost

> AI 编程会话的 git —— 查看、压缩、分叉、复用你的 opencode 会话

[English](docs/README_en.md) | 中文

---

**目录**

- [为什么需要 ocb](#为什么需要-ocb)
- [安装](#安装)
- [快速开始](#快速开始)
- [命令参考](#命令参考)
- [数据存储](#数据存储)
- [测试](#测试)
- [Pipeline-Driven Development](#pipeline-driven-development)
- [项目文档](#项目文档)

---

`ocb` 是一个 CLI 工具，为 [opencode](https://opencode.ai) 会话提供 git 级别的管理能力。

## 为什么需要 ocb

AI 编程助手的会话有两个结构性问题：

1. **上下文窗口膨胀** — 失败尝试和死胡同填满上下文，无法压缩或清理
2. **知识孤岛** — 一个会话里搞明白的东西无法带到另一个会话

`ocb` 用三个核心操作解决：

```
compact  →  压缩消息，回收上下文空间（类似 git rebase -i）
fork     →  从任意会话分叉出新的探索方向（类似 git branch）
inject   →  跨会话传递知识（类似 git cherry-pick）
```

核心原则：**零直写数据库**。所有操作通过 opencode 官方 CLI 完成，opencode 升级不会破坏你的数据。

## 安装

```bash
git clone https://github.com/shiyuanyou/opencode-boost.git
cd opencode-boost && npm install && npm run build && npm link
```

需要 [Node.js](https://nodejs.org/) >= 18 和 [opencode](https://opencode.ai) >= 1.14。

### 让 AI agent 安装

```
git clone https://github.com/shiyuanyou/opencode-boost.git /tmp/opencode-boost
cd /tmp/opencode-boost && npm install && npm run build && npm link
```

## 快速开始

```bash
$ ocb origin available                     # 查看未被管理的会话
$ ocb attach fix-login                     # 给最近的会话起名
$ ocb list                                 # 列出已管理的会话
$ ocb show fix-login                       # 查看消息列表
$ ocb show fix-login -m 2                  # 查看第 2 条消息全文
$ ocb checkout fix-login                   # 切换活跃会话

$ ocb checkout -b try-jwt fix-login        # 从 fix-login fork 新分支
$ ocb graph                                # 查看会话树

$ ocb compact fix-login -m 1-4 --manual "尝试了 session 方案，改用 JWT"
$ ocb reflog fix-login                     # 查看操作历史
$ ocb rollback fix-login -f                # 回退到上一版本

$ ocb inject fix-login try-jwt             # 跨会话注入知识
$ ocb pick fix-login -m 2,4                # 挑选特定消息注入

$ ocb model fast minimax-cn-coding-plan/MiniMax-M2.7  # 配置摘要模型
```

## 命令参考

### 查看

| 命令 | 说明 |
|------|------|
| `ocb list` | 列出已管理的会话，`*` 标记活跃 |
| `ocb origin available` | 列出未被管理的会话 |
| `ocb show <ref>` | 查看消息列表 |
| `ocb show <ref> -m 1,3` | 查看指定消息全文 |
| `ocb show <ref> --json` | JSON 格式输出 |
| `ocb graph` | 显示会话 fork 树 |

### 管理

| 命令 | 说明 |
|------|------|
| `ocb attach <name>` | 给最近会话创建别名 |
| `ocb attach <name> -s <sid>` | 给指定会话创建别名 |
| `ocb checkout <ref>` | 切换活跃会话 |
| `ocb rename <old> <new>` | 重命名 |
| `ocb unmanage <ref>` | 移除管理（会话保留） |
| `ocb delete <ref>` | 删除会话 |

### 分叉

| 命令 | 说明 |
|------|------|
| `ocb checkout -b <name> <ref>` | fork 新会话并命名 |
| `ocb checkout -b <name> <ref> --model <m>` | 指定模型 fork |

### 压缩

| 命令 | 说明 |
|------|------|
| `ocb compact <ref> -m <from>-<to>` | 压缩消息范围为摘要 |
| `ocb compact <ref> -m <range> --manual '摘要'` | 手动摘要（不消耗 token） |
| `ocb compact <ref> -m <range> --model <m>` | 指定模型生成摘要 |
| `ocb rebase <ref>` | 交互式 rebase |

### 历史

| 命令 | 说明 |
|------|------|
| `ocb reflog [ref]` | 查看操作历史 |
| `ocb rollback <name>` | 回退到历史版本 |

### 跨会话

| 命令 | 说明 |
|------|------|
| `ocb inject <source> [target]` | 提取知识注入目标会话 |
| `ocb inject <source> [target] --raw` | 跳过摘要，注入原文 |
| `ocb pick <ref> -m 1,3,5` | 挑选指定消息注入 |

### 配置

| 命令 | 说明 |
|------|------|
| `ocb model` | 查看摘要模型配置 |
| `ocb model <alias> <provider/model>` | 设置模型别名 |
| `ocb model --list` | 列出可用模型 |

`<ref>` 可以是别名（`fix-login`）或原始 session ID（`ses_2501c621eff`）。

## 数据存储

```
~/.local/share/opencode-boost/
├── names.json    # 别名 → session-id（按项目目录隔离）
├── forks.json    # fork 关系（parent + fork 位置）
├── state.json    # 每个项目的活跃会话
└── reflog.json   # 操作历史（支持 rollback）

~/.config/opencode-boost/
└── config.json   # 模型别名、摘要模型
```

## 测试

```bash
npm test                                    # 57 个单元测试（秒级）
npm run build && bash tests/e2e/run-e2e.sh  # 34 个 E2E（消耗 token）
```

## Pipeline-Driven Development

ocb 是用一条 **AI 驱动的管线化开发流程** 构建的。这条管线从 ocb 项目中抽象出来，可复用于任何 AI 辅助开发的软件项目。

### 管线总览

```
Spec → Plan → Implement → Test → Review → Ship
  │       │       │         │       │       │
  │       │       │         │       │       └→ git tag + push
  │       │       │         │       └→ requesting-code-review skill
  │       │       │         └→ verification-before-completion skill
  │       │       └→ subagent-driven-development（并行 agent 执行独立任务）
  │       └→ writing-plans skill（生成带 checkbox 的可执行 plan）
  └→ 设计文档（docs/superpowers/specs/）
```

### 六个阶段

#### 1. Spec — 写设计文档

产出：`docs/superpowers/specs/YYYY-MM-DD-<name>.md`

设计文档定义问题、设计原则、数据模型、命令接口和实现优先级。这是管线的输入，AI agent 根据它生成可执行的计划。

ocb 的设计文档：`docs/superpowers/specs/2026-04-20-ocb-new.md`（941 行，覆盖完整命令设计、parentID 链修复算法、LLM 摘要策略）。

#### 2. Plan — 生成可执行计划

用 `writing-plans` skill 将设计文档拆解为带 checkbox 的任务列表。每个任务包含：要创建/修改的文件、代码片段、验证命令。

产出：`docs/superpowers/plans/YYYY-MM-DD-<phase>.md`

关键设计决策：
- **任务独立** — 每个任务可由独立 agent 并行执行，无共享状态依赖
- **验证内嵌** — 每个任务末尾有 `npm run build && npm test` 验证步骤
- **增量提交** — 每个任务完成后 commit

ocb 的计划文件：
- `docs/superpowers/plans/2026-04-21-phase1-core-view-naming.md`
- `docs/superpowers/plans/2026-04-21-phase2-fork-graph.md`
- `docs/superpowers/plans/2026-04-22-techdebt-review-fixes.md`

#### 3. Implement — 并行 agent 执行

用 `subagent-driven-development` skill 将计划中的独立任务分发给并行的 sub-agent 执行。每个 agent：
- 读取计划中对应的任务描述
- 创建/修改文件
- 运行 `npm run build && npm test` 验证
- 返回执行结果（PASS/FAIL + 错误详情）

主 agent 只做调度和状态跟踪，不参与代码编写。

#### 4. Test — 三层验证

```
单元测试（vitest）→ 类型检查（tsc --noEmit）→ E2E（真实 opencode 会话）
```

- **单元测试**：57 个，秒级，覆盖解析逻辑和 store 操作
- **类型检查**：`tsc --noEmit`，零错误
- **E2E**：34 个，在 `/tmp` 下创建隔离的 git 项目和真实会话

E2E 验证链：`build → 创建测试 session → 执行命令 → 断言输出 → 清理`

验证命令写入 `AGENTS.md`，确保每个新 agent 会话自动获知。

#### 5. Review — 自动代码审查

用 `requesting-code-review` skill 在每个 Phase 完成后触发代码审查。审查产出是新的计划文件（如 `techdebt-review-fixes.md`），进入下一轮管线循环。

这个循环捕获了：类型错误、重复代码、测试覆盖缺口、文档不同步。

#### 6. Ship — 增量交付

```
写代码 → build + 单元测试 → commit + tag → E2E → push
```

每个 commit 对应一个可验证的变更。tag 标记发布版本。E2E 在 push 前运行，确保远程代码始终可用。

### 实际效果

ocb 用这条管线在 **4 个 Phase** 中构建完成：

| Phase | 内容 | 单元测试 | E2E | 工期 |
|-------|------|---------|-----|------|
| 1 | 查看 + 命名 | 22 | 22 | 1 天 |
| 2 | 分叉 + 会话树 | 4 | 3 | 半天 |
| 3 | 压缩 + 历史 | 27 | 9 | 1.5 天 |
| 4 | 跨会话复用 | 4 | 0（待补） | 半天 |

总计 57 单元测试 + 34 E2E，全部通过。

### 复用这条管线

要在你的项目中使用这条管线，需要：

1. **`AGENTS.md`** — 项目级 agent 指令（构建/测试/架构/约定），每个新 agent 会话自动加载
2. **`docs/superpowers/specs/`** — 设计文档，AI 生成计划的输入
3. **`docs/superpowers/plans/`** — 可执行计划，带 checkbox 的任务列表
4. **`docs/dev-workflow.md`** — 开发循环、已知坑、E2E 规则

关键配置：在 opencode 中加载 `writing-plans`、`subagent-driven-development`、`verification-before-completion`、`requesting-code-review` 四个 skill。

## 项目文档

```
docs/
├── README_en.md                          # 英文文档
├── dev-workflow.md                       # 开发测试流程（面向 agent）
├── superpowers/
│   ├── specs/                            # 设计文档
│   │   └── 2026-04-20-ocb-new.md         # ocb 完整设计
│   └── plans/                            # 已执行的计划（历史存档）
│       ├── 2026-04-21-phase1-core-view-naming.md
│       ├── 2026-04-21-phase2-fork-graph.md
│       └── 2026-04-22-techdebt-review-fixes.md
```

## License

[MIT](LICENSE)
