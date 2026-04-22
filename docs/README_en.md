# opencode-boost

> opencode session manager — view, compress, fork, and reuse your AI coding sessions
>
> opencode 会话管理器 — 查看、压缩、分叉、复用你的 AI 编程会话

English | [中文](../README.md)

---

`ocb` is a CLI tool that manages [opencode](https://opencode.ai) sessions externally. It solves two core pain points:

1. **Context window bloat** — failed attempts and dead ends fill up the context, with no way to compress or clean them
2. **Knowledge silos** — insights from one session can't be carried to another

Core principle: **Zero direct database access**. All operations go through the official opencode CLI. Your data is safe across opencode upgrades.

## Installation

```bash
git clone https://github.com/shiyuanyou/opencode-boost.git
cd opencode-boost
npm install
npm link
```

Requires [Node.js](https://nodejs.org/) >= 18 and [opencode](https://opencode.ai) >= 1.14.

## Testing

Unit tests (49 tests, instant):

```bash
npm test
```

E2E tests (34 tests, requires opencode logged in, costs tokens):

```bash
npm run build && bash tests/e2e/run-e2e.sh
```

Tests create isolated git projects and sessions under `/tmp`. No impact on your real work. Each run costs ~7 `opencode run` invocations in tokens.

## Quick Start

```bash
# See unmanaged sessions in current directory
$ ocb origin available
  ses_2501c621eff  just now  "Fix login bug"

# Name the most recent session
$ ocb attach fix-login
✓ Created: fix-login → ses_2501c621eff

# List managed sessions
$ ocb list
  fix-login (ses_2501c621eff)  just now

# View session messages
$ ocb show fix-login
[  1]  [User     ]  "Fix the login bug"
[  2]  [Assistant]  I'll examine the login-related code... (3 tool calls)
[  3]  [User     ]  "Try the JWT approach"
[  4]  [Assistant]  Modified 3 files... (2 tool calls)
[  5]  [User     ]  "Now add tests"
[  6]  [Assistant]  Tests added... (4 tool calls)

# View full content of a specific message
$ ocb show fix-login -m 2
[2] [assistant]
I'll examine the login-related code. Let me first check the current auth module structure.

# Switch active session
$ ocb checkout fix-login
✓ Switched to fix-login (ses_2501c621eff)
  Open session: opencode -s ses_2501c621eff

# Fork a new branch from an existing session
$ ocb checkout -b try-jwt fix-login
⏳ Forking from fix-login (ses_2501c621eff)...
✓ Created try-jwt (ses_3a7f9b2c1d), switched
  Open session: opencode -s ses_3a7f9b2c1d

# View session fork tree
$ ocb graph
* fix-login (ses_2501c621eff) just now
  └── [6] try-jwt (ses_3a7f9b2c1d) just now

# Compact messages (manual summary)
$ ocb compact fix-login -m 1-4 --manual "Tried session approach, switched to JWT"
⏳ Forking fix-login (ses_2501c621eff) -> new session...
✓ fix-login updated: ses_2501c621eff -> ses_ocb_xxx (compressed)
  Messages 1-4 compressed to 1 summary

# Compact messages (LLM auto-summary)
$ ocb compact fix-login -m 1-4 --model minimax-cn-coding-plan/MiniMax-M2.7

# View operation history
$ ocb reflog fix-login-c1
fix-login-c1 operation history:
  [2] ses_ocb_xxx  compact  just now  from ses_2501c621eff
  [1] ses_2501c621  (original)  just now

# Rollback to a previous version
$ ocb rollback fix-login-c1 -f
✓ fix-login-c1 rolled back to ses_2501c621eff

# Interactive rebase (choose keep/compact/drop in editor)
$ ocb rebase fix-login

# Inject knowledge across sessions
$ ocb inject fix-login try-jwt
⏳ Exporting source session...
⏳ Extracting key knowledge...
⏳ Injecting into target session...
✓ Injected fix-login knowledge into ses_3a7f9b2c1d

# Pick specific messages into current session
$ ocb pick fix-login -m 2,4

# Rename
$ ocb rename fix-login auth-v2
✓ Renamed: fix-login → auth-v2

# Remove from management (session is preserved)
$ ocb unmanage auth-v2
✓ Removed auth-v2 from management (session still exists)

# Permanently delete a session (requires confirmation)
$ ocb delete auth-v2
⚠ Delete session ses_2501c621eff? This cannot be undone. [y/N] y
✓ Deleted ses_2501c621eff

# View / set summarizer model
$ ocb model
$ ocb model --list
$ ocb model fast minimax-cn-coding-plan/MiniMax-M2.7
```

## Command Reference

### Session View & Management

| Command | Description |
|---------|-------------|
| `ocb list` | List managed sessions for current directory; `*` marks the active session |
| `ocb origin available` | List unmanaged sessions in current directory |
| `ocb show <ref>` | Show session message list with sequence numbers, roles, and summaries |
| `ocb show <ref> -m 1,3` | Show full content of specific messages (comma-separated) |
| `ocb show <ref> --json` | Output message list as JSON |
| `ocb attach <name>` | Create an alias for the most recent session |
| `ocb attach <name> -s <sid>` | Create an alias for a specific session ID |
| `ocb checkout <ref>` | Switch active session (updates state.json) |
| `ocb rename <old> <new>` | Rename a session alias |
| `ocb unmanage <ref>` | Remove from ocb management (session is preserved) |
| `ocb delete <ref>` | Permanently delete a session (calls `opencode session delete`) |
| `ocb delete <ref> -f` | Skip confirmation prompt |

### Forking & Session Tree

| Command | Description |
|---------|-------------|
| `ocb checkout -b <name> <ref>` | Fork from specified session into a new named session |
| `ocb checkout -b <name> <ref> --model <m>` | Fork using specified model |
| `ocb graph` | Show session fork tree (ASCII, with fork positions) |

### Compaction & History

| Command | Description |
|---------|-------------|
| `ocb compact <ref> -m <from>-<to>` | Compress message range into one summary |
| `ocb compact <ref> -m <range> --manual 'summary'` | Provide summary manually (no token cost) |
| `ocb compact <ref> -m <range> --model <m>` | Use specified model for summary |
| `ocb rebase <ref>` | Interactive rebase (choose keep/compact/drop in editor) |
| `ocb reflog [ref]` | View operation history (current session if no ref) |
| `ocb rollback <name>` | Roll back to a historical version |
| `ocb rollback <name> -f` | Skip confirmation prompt |

### Cross-session Reuse

| Command | Description |
|---------|-------------|
| `ocb inject <source> [target]` | Extract knowledge from source and inject into target (default: current) |
| `ocb inject <source> [target] --raw` | Skip summarization, inject raw text |
| `ocb pick <ref> -m 1,3,5` | Pick specific messages from source into current session |

### Configuration

| Command | Description |
|---------|-------------|
| `ocb model` | View current summarizer model config |
| `ocb model <alias> <provider/model>` | Set model alias |
| `ocb model --list` | List all available models |

`<ref>` can be either an alias (e.g. `fix-login`) or a raw session ID (e.g. `ses_2501c621eff`).

## Data Storage

`ocb` stores its data under `$XDG_DATA_HOME/opencode-boost/`:

```
~/.local/share/opencode-boost/
├── names.json    # alias → session-id mapping (per project directory)
├── forks.json    # fork relationships (parentSessionId + parentMessageId)
├── state.json    # active session per project
└── reflog.json   # operation history (compact/rebase/rollback records)
```

Config under `$XDG_CONFIG_HOME/opencode-boost/`:

```
~/.config/opencode-boost/
└── config.json   # model aliases, summarizer model config
```

Example `names.json`:

```json
{
  "/Users/you/projects/my-app": {
    "fix-login": "ses_2501c621eff",
    "add-tests": "ses_3a7f9b2c1d"
  }
}
```

## Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1 | View + naming commands | ✅ Done |
| Phase 2 | Fork (`checkout -b`) + session graph (`graph`) | ✅ Done |
| Phase 3 | Compact, rebase, reflog, rollback | ✅ Done |
| Phase 4 | Cross-session knowledge injection (`inject`, `pick`) | 🔧 Implemented, pending E2E |

## License

[MIT](../LICENSE)
