# opencode-boost

> Git for AI coding sessions — view, compress, fork, and reuse your opencode sessions

English | [中文](../README.md)

---

**Contents**

- [Why ocb](#why-ocb)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Command Reference](#command-reference)
- [Data Storage](#data-storage)
- [Testing](#testing)
- [Pipeline-Driven Development](#pipeline-driven-development)
- [Project Docs](#project-docs)

---

`ocb` is a CLI tool that brings git-level session management to [opencode](https://opencode.ai).

## Why ocb

AI coding assistants have two structural problems:

1. **Context window bloat** — failed attempts and dead ends fill up the context, with no way to compress or clean them
2. **Knowledge silos** — insights from one session can't be carried to another

`ocb` solves this with three core operations:

```
compact  →  compress messages, reclaim context space (like git rebase -i)
fork     →  branch off from any session for new explorations (like git branch)
inject   →  transfer knowledge across sessions (like git cherry-pick)
```

Core principle: **Zero direct database access**. All operations go through the official opencode CLI.

## Installation

```bash
git clone https://github.com/shiyuanyou/opencode-boost.git
cd opencode-boost && npm install && npm link
```

Requires [Node.js](https://nodejs.org/) >= 18 and [opencode](https://opencode.ai) >= 1.14.

## Quick Start

```bash
$ ocb origin available                     # See unmanaged sessions
$ ocb attach fix-login                     # Name the most recent session
$ ocb list                                 # List managed sessions
$ ocb show fix-login                       # View message list
$ ocb show fix-login -m 2                  # View full content of message 2
$ ocb checkout fix-login                   # Switch active session

$ ocb checkout -b try-jwt fix-login        # Fork from fix-login
$ ocb graph                                # View session tree

$ ocb compact fix-login -m 1-4 --manual "Tried session approach, switched to JWT"
$ ocb reflog fix-login                     # View operation history
$ ocb rollback fix-login -f                # Roll back to previous version

$ ocb inject fix-login try-jwt             # Inject knowledge across sessions
$ ocb pick fix-login -m 2,4                # Pick specific messages

$ ocb model fast minimax-cn-coding-plan/MiniMax-M2.7  # Configure summarizer model
```

## Command Reference

### View

| Command | Description |
|---------|-------------|
| `ocb list` | List managed sessions; `*` marks active |
| `ocb origin available` | List unmanaged sessions |
| `ocb show <ref>` | View message list |
| `ocb show <ref> -m 1,3` | View full content of specific messages |
| `ocb show <ref> --json` | Output as JSON |
| `ocb graph` | Show session fork tree |

### Manage

| Command | Description |
|---------|-------------|
| `ocb attach <name>` | Create alias for most recent session |
| `ocb attach <name> -s <sid>` | Create alias for specific session |
| `ocb checkout <ref>` | Switch active session |
| `ocb rename <old> <new>` | Rename alias |
| `ocb unmanage <ref>` | Remove from management (session preserved) |
| `ocb delete <ref>` | Delete session |

### Fork

| Command | Description |
|---------|-------------|
| `ocb checkout -b <name> <ref>` | Fork into new named session |
| `ocb checkout -b <name> <ref> --model <m>` | Fork with specified model |

### Compact

| Command | Description |
|---------|-------------|
| `ocb compact <ref> -m <from>-<to>` | Compress message range into summary |
| `ocb compact <ref> -m <range> --manual 'summary'` | Manual summary (no token cost) |
| `ocb compact <ref> -m <range> --model <m>` | Use specified model for summary |
| `ocb rebase <ref>` | Interactive rebase |

### History

| Command | Description |
|---------|-------------|
| `ocb reflog [ref]` | View operation history |
| `ocb rollback <name>` | Roll back to historical version |

### Cross-session

| Command | Description |
|---------|-------------|
| `ocb inject <source> [target]` | Extract and inject knowledge |
| `ocb inject <source> [target] --raw` | Skip summarization, inject raw text |
| `ocb pick <ref> -m 1,3,5` | Pick specific messages |

### Config

| Command | Description |
|---------|-------------|
| `ocb model` | View summarizer model config |
| `ocb model <alias> <provider/model>` | Set model alias |
| `ocb model --list` | List available models |

`<ref>` can be an alias (`fix-login`) or raw session ID (`ses_2501c621eff`).

## Data Storage

```
~/.local/share/opencode-boost/
├── names.json    # alias → session-id (isolated per project directory)
├── forks.json    # fork relationships (parent + fork position)
├── state.json    # active session per project
└── reflog.json   # operation history (enables rollback)

~/.config/opencode-boost/
└── config.json   # model aliases, summarizer config
```

## Testing

```bash
npm test                                    # 57 unit tests (instant)
npm run build && bash tests/e2e/run-e2e.sh  # 34 E2E tests (costs tokens)
```

## Pipeline-Driven Development

ocb was built using an **AI-driven pipeline development process**. This pipeline is abstracted from the ocb project and reusable for any AI-assisted software project.

### Pipeline Overview

```
Spec → Plan → Implement → Test → Review → Ship
  │       │       │         │       │       │
  │       │       │         │       │       └→ git tag + push
  │       │       │         │       └→ requesting-code-review skill
  │       │       │         └→ verification-before-completion skill
  │       │       └→ subagent-driven-development (parallel agents)
  │       └→ writing-plans skill (checkbox-based executable plans)
  └→ Design doc (docs/superpowers/specs/)
```

### Six Stages

#### 1. Spec — Write the design document

Output: `docs/superpowers/specs/YYYY-MM-DD-<name>.md`

The design doc defines the problem, design principles, data model, command interface, and implementation priority. This is the pipeline input — AI agents generate executable plans from it.

ocb's design doc: `docs/superpowers/specs/2026-04-20-ocb-new.md` (941 lines, covering complete command design, parentID chain repair algorithm, LLM summarization strategy).

#### 2. Plan — Generate executable plans

The `writing-plans` skill decomposes the design doc into checkbox-based task lists. Each task includes: files to create/modify, code snippets, and verification commands.

Output: `docs/superpowers/plans/YYYY-MM-DD-<phase>.md`

Key design decisions:
- **Independent tasks** — each task can be executed by a separate agent in parallel, no shared state
- **Embedded verification** — each task ends with `npm run build && npm test`
- **Incremental commits** — commit after each task

#### 3. Implement — Parallel agent execution

The `subagent-driven-development` skill dispatches independent tasks to parallel sub-agents. Each agent:
- Reads its task description from the plan
- Creates/modifies files
- Runs `npm run build && npm test` to verify
- Returns results (PASS/FAIL + error details)

The main agent only handles dispatching and status tracking.

#### 4. Test — Three-layer verification

```
Unit tests (vitest) → Type check (tsc --noEmit) → E2E (real opencode sessions)
```

- **Unit tests**: 57 tests, instant, covers parsing and store operations
- **Type check**: `tsc --noEmit`, zero errors
- **E2E**: 34 tests, creates isolated git projects and real sessions under `/tmp`

#### 5. Review — Automated code review

The `requesting-code-review` skill triggers after each Phase. Review output is a new plan file (e.g., `techdebt-review-fixes.md`) that feeds back into the pipeline.

This loop catches: type errors, duplicated code, test coverage gaps, stale docs.

#### 6. Ship — Incremental delivery

```
Write code → build + unit test → commit + tag → E2E → push
```

Each commit maps to a verifiable change. Tags mark releases. E2E runs before push.

### Results

ocb was built across **4 phases** with this pipeline:

| Phase | Scope | Unit tests | E2E | Time |
|-------|-------|-----------|-----|------|
| 1 | View + naming | 22 | 22 | 1 day |
| 2 | Fork + session tree | 4 | 3 | 0.5 day |
| 3 | Compact + history | 27 | 9 | 1.5 days |
| 4 | Cross-session reuse | 4 | 0 (pending) | 0.5 day |

Total: 57 unit tests + 34 E2E tests, all passing.

### Reuse this pipeline

To use this pipeline in your project, you need:

1. **`AGENTS.md`** — project-level agent instructions (build/test/architecture/conventions), auto-loaded by every new agent session
2. **`docs/superpowers/specs/`** — design documents, input for AI-generated plans
3. **`docs/superpowers/plans/`** — executable plans with checkbox-based task lists
4. **`docs/dev-workflow.md`** — dev loop, known issues, E2E rules

Required skills: `writing-plans`, `subagent-driven-development`, `verification-before-completion`, `requesting-code-review`.

## Project Docs

```
docs/
├── README_en.md                          # This file
├── dev-workflow.md                       # Dev/test workflow (agent-facing)
├── superpowers/
│   ├── specs/                            # Design documents
│   │   └── 2026-04-20-ocb-new.md         # Complete ocb design
│   └── plans/                            # Executed plans (archive)
│       ├── 2026-04-21-phase1-core-view-naming.md
│       ├── 2026-04-21-phase2-fork-graph.md
│       └── 2026-04-22-techdebt-review-fixes.md
```

## License

[MIT](../LICENSE)
