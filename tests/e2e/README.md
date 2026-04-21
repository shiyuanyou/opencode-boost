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
3. 按 `task.json` 定义的 23 个步骤逐一执行 `ocb` 命令并验证输出
4. 测试结束后自动清理所有临时会话和目录

## 测试内容

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
| T18 | project-b 独立 attach |
| T19 | project-b 独立 list |
| T20 | project-b 独立 show |
| T21 | `delete -f` 彻底删除会话 |
| T22 | 删除后不再出现 |
| T23 | 不存在的 ref 返回错误 |

## task.json

测试数据和断言定义在 `task.json` 中。每个测试步骤包含：

- `id` / `name`：测试标识和描述
- `cwd`：执行目录（project-a 或 project-b）
- `command`：要执行的 ocb 命令（支持 `${PA_S1_SID}` 等变量替换）
- `assert`：输出中必须包含的字符串列表
- `assert_not`：输出中不能包含的字符串列表
- `exit_code`：期望的退出码（默认 0）
- `min_lines`：输出最少行数
- `skip`：标记为跳过（用于未实现的功能）

## 添加新测试

1. 在 `task.json` 的 `test_sequence` 中添加步骤
2. 如需新会话，在 `projects[].sessions` 中添加
3. 在 `run-e2e.sh` 的 `run_phaseX()` 函数中添加对应的 `run_test` 调用

## 注意事项

- 每次运行消耗约 4 次 `opencode run` 的 token
- 测试在 `/tmp` 下操作，不影响真实项目
- 自动清理：EXIT trap 会删除所有测试会话和临时目录
- 如果中途中断（Ctrl+C），trap 仍会执行清理
