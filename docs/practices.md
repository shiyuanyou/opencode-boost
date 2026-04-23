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
- 活跃会话 export 用 `exportWithRetry()`，不裸调 `exportSession`
- `tsconfig.json` 必须有 `"types": ["node"]`
- 版本号从 `package.json` 动态读取，不硬编码
- 测试顺序：先写测试确认 fail → 写实现确认 pass
- commit 顺序：unit test pass → commit → E2E → push
- shell completion 依赖 `--names` 或 `--json` 极简输出
- prompt 集成命令必须 fast（< 50ms）和 zero side-effect
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
