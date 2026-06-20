# Handoff Workflow

Use this folder for short-lived session state between Codex chats.

## Start A New Session

1. Read `AGENTS.md`.
2. Read `handoffs/LATEST.json`.
3. Read the handoff file named by `latestHandoff`.
4. Run `git status --short`.
5. Continue from the newest user goal, respecting any dirty worktree notes.

## End A Substantial Session

1. Create a dated handoff:

```text
handoffs/HANDOFF_YYYY-MM-DD_SHORT_TOPIC.json
```

2. Update `handoffs/LATEST.json` to point at the new handoff.
3. Keep the handoff concise and source-linked. Do not duplicate long docs.

## What To Include

- Current user goal.
- Work completed.
- Files changed or created.
- Current `git status --short` summary.
- Verification run and results.
- Known issues, blockers, and design questions.
- Recommended next steps.
- Anything future agents should not revert.

## What Goes Elsewhere

- Stable project rules belong in `AGENTS.md`.
- Long-lived architecture, design, and systems references belong in `docs/`.
- Temporary session context belongs here.
