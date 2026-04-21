# opencode-boost

> opencode session manager — view, compress, fork, and reuse your AI coding sessions

`ocb` is a CLI tool that manages [opencode](https://opencode.ai) sessions externally. It solves two core pain points:

1. **Context window bloat** — failed attempts and dead ends fill up the context, with no way to compress or clean them
2. **Knowledge silos** — insights from one session can't be carried to another

## How it works

All operations go through the official `opencode` CLI (`export`/`import`/`run`/`session`). **Zero direct database access** — your data is safe across opencode upgrades.

```
$ ocb attach my-session         # give the current session a name
$ ocb list                      # list managed sessions
  my-session (ses_abc123)  just now
$ ocb show my-session           # view message list
$ ocb checkout my-session       # switch active session
$ ocb rename my-session v2      # rename
$ ocb unmanage v2               # remove from management (keeps session)
```

## Installation

```bash
git clone https://github.com/<you>/opencode-boost.git
cd opencode-boost
npm install
npm link
```

Requires [Node.js](https://nodejs.org/) >= 18 and [opencode](https://opencode.ai) >= 1.14.

## Commands

| Command | Description |
|---------|-------------|
| `ocb list` | List managed sessions |
| `ocb origin available` | List unmanaged sessions |
| `ocb show <ref>` | Show session messages |
| `ocb show <ref> -m 1,3` | Show specific message details |
| `ocb attach <name> [-s <sid>]` | Name a session |
| `ocb checkout <ref>` | Switch active session |
| `ocb rename <old> <new>` | Rename a session |
| `ocb unmanage <ref>` | Remove from management |
| `ocb delete <ref>` | Delete a session |

`<ref>` can be either a name or a raw session ID.

## Roadmap

- **Phase 1** (current): View + naming commands
- **Phase 2**: Fork and graph
- **Phase 3**: Compact, rebase, reflog, rollback
- **Phase 4**: Cross-session knowledge injection

## License

MIT
