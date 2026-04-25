# ocb Practices

从真实开发中提炼。每条一行，零废话。

---

## Best Practices

- 所有 flag 必须有 `--long-form`（clig.dev 规范）
- 所有输出命令加 `--json`（机器可读是脚本和 completion 的基础）
- 所有 command action 用 `action()` 包装器统一错误处理（不手写 try/catch）
- 所有 `execa("opencode", [...])` 必须带 `{ input: "" }`
- ESM import 加 `.js` 后缀：`import { foo } from "./bar.js"`
- 新命令模式：`src/commands/<cmd>.ts` → `src/index.ts` 注册 → `tests/commands/<cmd>.test.ts`
- mock 边界：mock `opencode.ts` 和 `store.ts`（外部依赖），不 mock 纯函数
- 所有需要读取会话数据的命令必须用 `getSessionData()`，不直接调 `exportWithRetry` 或 `exportSession`（统一访问层，先 db-reader fallback export）
- native addon（如 better-sqlite3）必须在 tsup external 中声明，否则打包失败
- ESM 中 require native addon 必须用 `createRequire(import.meta.url)`，直接 `require()` 未定义会静默返回 null
- `shortId()` 是唯一截断 ID 的方式，不内联 `.slice(0,15)`——改长度时只改一处
- attach 不传 name 时必须自动生成（从 title），不允许空字符串作为名称 key
- `tsconfig.json` 必须有 `"types": ["node"]`
- 版本号从 `package.json` 动态读取，不硬编码
- 测试顺序：先写测试确认 fail → 写实现确认 pass
- commit 顺序：unit test pass → commit → E2E → push
- shell completion 依赖 `--names` 或 `--json` 极简输出
- prompt 集成命令必须 fast（< 50ms）和 zero side-effect
- `opencode -c` 实测 5-10s+，不得阻塞任何高频命令（list/show）的路径
- 颜色输出检测 `NO_COLOR` 环境变量和 `--no-color` flag

## Anti-Patterns

- 同一个短 flag（如 `-m`）在不同命令中含义不同
- 参数靠正则区分语义（如 `attach` 的 name 兼当 session ID）
- 硬编码版本号与 `package.json` 不同步
- 输出只有 human-readable 没有 machine-readable
- 废弃命令不 hide 仍显示在 help 中
- 长时间操作无进度提示
- 错误信息只报 "Error: xxx" 不给修复建议
- 跨语言混杂（CLI 英文 + 嵌入文本中文）无开关
- 在 list/show 等高频命令路径上调用 `opencode -c`（实测 5-10s 阻塞）
- 高频命令串行调用多个 opencode 子进程（应 Promise.all 并行）
- 直接调 `exportSession` 或 `exportWithRetry`（应通过 `getSessionData()` 统一访问层）
- 内联 `.slice(0,15)` 截断 ID（应用 `shortId()` 统一函数）
- attach 允许空字符串作为名称（应自动从 title 生成）
