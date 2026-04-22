# E2E 测试

> 所有贡献者在开发后都应运行此测试，确保 ocb 功能正常。

## 前置条件

- Node.js >= 18
- opencode >= 1.14（已登录且可用）
- git

## 运行

```bash
cd opencode-boost
npm run build
bash tests/e2e/run-e2e.sh
```

测试会：

1. 在 `/tmp/ocb-e2e-$$/` 下创建两个隔离的 git 项目（project-a、project-b）
2. 用 `opencode run` 在每个项目下创建测试会话（消耗少量 token）
3. 按 Phase 分组逐步执行 `ocb` 命令并验证输出
4. 测试结束后自动清理所有临时会话和目录

## 测试内容

### Phase 1: 查看 + 命名（22 个）

| ID | 测试项 |
|----|--------|
| T01 | `origin available` 列出所有未管理会话 |
| T02 | `attach` 命名最近的会话 |
| T03 | `attach -s` 命名指定会话 |
| T04 | `list` 显示已管理会话 |
| T05 | `origin available` 过滤已管理会话 |
| T06 | `show` 显示消息列表 |
| T07 | `show -m` 显示指定消息详情 |
| T08 | `checkout` 切换活跃会话 |
| T09 | `list` 显示 `*` 活跃标记 |
| T10 | `rename` 重命名别名 |
| T11 | `list` 反映新名称 |
| T12 | `show` 用新名称访问 |
| T13 | `show` 用原始 session-id 访问 |
| T14 | `unmanage` 移除管理 |
| T15 | `list` 不再显示已移除会话 |
| T16 | `origin available` 显示已移除的会话 |
| T17 | 跨项目隔离：project-b 看不到 project-a |
| T17b | project-b 独立 attach |
| T18 | project-b 独立 list |
| T19 | project-b 独立 show |
| T20 | `delete -f` 彻底删除会话 |
| T21 | 删除后不再出现 |
| T22 | 不存在的 ref 返回错误 |

### Phase 2: 分叉 + 会话树（3 个）

| ID | 测试项 |
|----|--------|
| T23 | `checkout -b` 从命名会话 fork |
| T24 | fork 后出现在 list |
| T25 | `graph` 显示 fork 树 |

### Phase 3: 压缩 + 历史 + 回滚（9 个）

| ID | 测试项 |
|----|--------|
| T26 | `reflog` 无条目时提示 |
| T27 | `compact --manual` 压缩消息 |
| T28 | `reflog` 显示 compact 条目 |
| T29 | compact 创建 `-c1` 后缀新名 |
| T30 | `rollback` 回退到上一版本 |
| T31 | `reflog` 显示 rollback 条目 |
| T32 | `model` 显示无配置 |
| T33 | `model --list` 列出可用模型 |

## 未覆盖的命令

- **rebase** — 需要交互式编辑器，无法自动化
- **inject** — 需要消耗 LLM token 向目标会话注入
- **pick** — 需要消耗 LLM token 向当前会话注入
- **compact LLM 摘要**（非 `--manual`）— E2E 用 `--manual` 绕过

## 添加新测试

1. 在 `tests/e2e/run-e2e.sh` 的对应 Phase 函数中添加 `run_test` 调用
2. 如需新会话，在 `setup()` 函数中用 `create_session` 创建
3. 在 `session-ids.env` 中导出新变量

## 注意事项

- 每次运行消耗约 7 次 `opencode run` 的 token
- 测试在 `/tmp` 下操作，不影响真实项目
- 自动清理：EXIT trap 会删除所有测试会话和临时目录
- 如果中途中断（Ctrl+C），trap 仍会执行清理
