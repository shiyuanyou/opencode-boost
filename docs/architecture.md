# ocb 项目架构

## 模块职责

```
src/
  index.ts                # commander 入口，注册所有命令
  types.ts                # 类型定义（SessionInfo, ExportedSession, Store 类型等）
  commands/
    list.ts               # ocb list — 列出所有会话（managed + unmanaged）
    origin.ts             # ocb origin available — 已废弃，指向 ocb list
    show.ts               # ocb show — 消息列表 + buildMessageList（parentID 链排序）
    attach.ts             # ocb attach — 创建/更新别名，支持 --all 批量
    checkout.ts           # ocb checkout — 切换会话 / checkout -b fork 新会话
    rename.ts             # ocb rename — 重命名别名
    unmanage.ts           # ocb unmanage — 移除管理（保留 session）
    delete.ts             # ocb delete — 删除会话
    graph.ts              # ocb graph — ASCII 会话树
    reflog.ts             # ocb reflog — 操作历史
    rollback.ts           # ocb rollback — 回退到历史版本
    model.ts              # ocb model — 查看/设置摘要模型
    compact.ts            # ocb compact — 压缩消息范围
    rebase.ts             # ocb rebase — 交互式 rebase
    inject.ts             # ocb inject — 跨会话注入知识摘要
    pick.ts               # ocb pick — 摘取指定消息注入
    open.ts               # ocb open — 在 opencode 中打开会话
  lib/
    opencode.ts           # opencode CLI 调用 + 输出解析
    store.ts              # JSON 文件 CRUD（names/state/forks/reflog/config）
    paths.ts              # XDG 路径计算
    ref.ts                # ref 解析（name → sid → 短 ID 前缀匹配）
    format.ts             # 输出格式化
    sync.ts               # 同步 opencode 当前活跃会话到 state.json
    db-reader.ts          # SQLite 只读查询层（better-sqlite3）
    data-access.ts        # 统一访问层（db-reader → fallback exportWithRetry）
    retry.ts              # export 重试 + 退避
    chain.ts              # parentID 链修复 + import JSON 重建
    summarizer.ts         # LLM 摘要引擎
```

## 数据流

### 会话数据读取（核心路径）

```
命令 → getSessionData(sid)
         │
         ├─ db-reader.openDbReader() 成功？
         │    ├─ 是 → reader.getSession(sid) → 直接从 SQLite 读取（毫秒级）
         │    └─ 否（better-sqlite3 不可用或 DB 不存在）
         │
         └─ exportWithRetry(sid) → execa("opencode", ["export", sid])
              ├─ 5 次重试 × 8s 退避
              └─ 解析 JSON stdout
```

**关键设计**：`data-access.ts` 是所有会话数据读取的唯一入口。命令不直接调用 `exportSession` 或 `exportWithRetry`。

### ref 解析

```
用户输入 ref → resolveRef(ref, cwd)
                 │
                 ├─ names.json[cwd][ref] 存在？→ 返回对应 sid
                 ├─ listSessions(cwd) 中有完全匹配？→ 返回 sid
                 ├─ listSessions(cwd) 中有唯一前缀匹配？→ 返回 sid
                 └─ 抛出 "No session found"
```

### compact 流程（rebase 类似）

```
1. resolveRef → 获取 sid
2. forkSession(sid, "ocb-compact-fork") → forkSid
3. getSessionData(forkSid) → 导出 fork 的数据
4. buildMessageList → 按 parentID 链排序
5. 构建 RebasePlanEntry[]（keep/compact/drop）
6. repairChain(原始消息, plan) → 修复 parentID 链
   - compact 组：拼接原文前 N 字作占位文本，外部用 LLM 摘要覆盖
   - drop：跳过，后续消息的 parentID 重指向存活祖先
   - keep：structuredClone 保留全部原始字段
7. rebuildExportJson → 生成完整 import JSON（新 ses_ocb_ ID）
8. importSession(tmpFile) → newSid
9. 更新 names/state/reflog
10. deleteSession(forkSid) 清理临时 session
```

### 跨会话复用（inject/pick）

```
1. getSessionData(sourceSid) → 源会话数据
2. extractKnowledge/extractMessageTexts → 提取文本
3. injectMessage(targetSid, text) → opencode run --session 向目标注入
```

## 类型系统

### 核心 I/O 类型

```typescript
// opencode session list 的返回结构
interface SessionInfo {
  id: string;           // ses_xxx
  title: string;
  updated: number;      // epoch ms
  created: number;
  projectId: string;
  directory: string;    // 项目路径（按此过滤）
}

// opencode export 的 JSON 结构（也是 db-reader 的返回结构）
interface ExportedSession {
  info: {
    id: string; slug: string; projectID: string; directory: string;
    title: string; version: string;
    time: { created: number; updated: number };
    [key: string]: unknown;  // 保留未知字段
  };
  messages: ExportedMessage[];
}

interface ExportedMessage {
  info: {
    id: string; sessionID: string; parentID?: string;
    role: "user" | "assistant";
    time: { created: number; completed?: number };
    [key: string]: unknown;  // 保留 agent/model/path/cost/tokens 等
  };
  parts: MessagePart[];
}

interface MessagePart {
  type: string;  // text | tool | reasoning | step-start | step-finish | ...
  text?: string;
  id: string; sessionID: string; messageID: string;
  [key: string]: unknown;  // 保留 tool call details 等
}
```

### 本地存储类型

```typescript
// names.json — 按项目目录隔离
interface NamesStore { [directory: string]: { [name: string]: string } }

// state.json — 每个目录的当前活跃会话
interface StateStore { [directory: string]: { current: string | null } }

// forks.json — fork 关系追踪
interface ForksStore { [directory: string]: { [childSid: string]: ForkInfo } }
interface ForkInfo { parentSessionId: string; parentMessageId: string; timestamp: number }

// reflog.json — 操作历史
interface ReflogStore { [directory: string]: ReflogEntry[] }
interface ReflogEntry {
  name: string; sessionId: string;
  operation: "compact" | "rebase" | "rollback" | "original";
  from: string | null; timestamp: number;
}

// config.json — 全局配置
interface ConfigStore {
  summarizer: { method: string; model: string };
  models: { [alias: string]: string };  // alias → providerID/modelID
}
```

## 命令全景

```
查看类
  ocb list                              列出所有会话（managed + unmanaged 分组）
  ocb origin available                  已废弃，提示用 ocb list
  ocb graph                             会话树（ASCII，含 fork 位置）
  ocb show [ref]                        消息列表（默认当前会话）
  ocb show <ref> -m <nums>              指定消息全文
  ocb show <ref> --json                 JSON 输出

管理类
  ocb attach <name> [-s <sid>]          创建别名（-s 指定 sid，默认最新）
  ocb attach --all                      批量管理所有 unmanaged session
  ocb checkout [ref]                    切换活跃会话
  ocb checkout -b <name> [ref]          fork 并命名
  ocb open [ref]                        在 opencode 中打开会话
  ocb rename <old> <new>                重命名
  ocb unmanage <ref>                    移除管理
  ocb delete <ref> [-f]                 删除会话

压缩类
  ocb compact <ref> -m <range>          压缩消息范围
  ocb rebase <ref>                      交互式 rebase（$EDITOR）
  以上支持 --model <alias-or-id> / --manual "摘要"

复用类
  ocb inject <source> [target]          跨会话注入知识摘要
  ocb pick <ref> -m <nums>              摘取消息注入当前会话

历史类
  ocb reflog [ref]                      操作历史
  ocb rollback <name> [-f] [-s <step>]  回退版本

配置类
  ocb model                             查看当前模型
  ocb model <alias-or-id>               设置模型
  ocb model --list                      列出可用模型
```

## 与旧设计文档的差异

`docs/superpowers/specs/2026-04-20-ocb-new.md` 是项目初始设计文档（941 行），以下内容已偏离：

| 项目 | 旧设计 | 当前实现 |
|------|--------|---------|
| 技术栈 | "不需要 better-sqlite3" | better-sqlite3 是核心依赖 |
| 数据读取 | 全部通过 `opencode export` | db-reader 直读 SQLite 优先，export fallback |
| `ocb list` | 只显示 managed | 显示全部（managed + unmanaged 分组） |
| `ocb origin available` | 列出未管理会话 | 已废弃，提示用 `ocb list` |
| `ocb open` | 不存在 | 已实现 |
| `ocb attach --all` | 不存在 | 已实现 |
| `show --range` | 有 `--range <from>-<to>` | 无，只有 `-m <nums>` 和 `--json` |
| `model` 首次引导 | 交互式选择模型列表 | 只打印提示，不交互 |
| 全局 `--dry-run` | 设计了 | 未实现 |
