# Desktop and Mac Mini Sync Workflow

The preferred workflow is:

- Windows desktop: main place to work when home.
- Mac mini: always-on machine for Codex Remote while away.
- GitHub: source of truth and sync point.
- SSH: used for remote checks and telling the Mac mini to pull, not for copying
  source code back and forth.

## Commands

Run these from the Windows desktop project checkout.

```powershell
node scripts/sync-mac-mini.mjs status
node scripts/sync-mac-mini.mjs handoff
node scripts/sync-mac-mini.mjs resume
```

Add `--build` when you want the destination machine to run the build too:

```powershell
node scripts/sync-mac-mini.mjs handoff --build
node scripts/sync-mac-mini.mjs resume --build
```

The helper uses:

- SSH host: `mac-mini-van-raf.local`, then fallback `192.168.0.250`
- Mac user: `henry`
- Mac project path: `/Users/henry/Documents/Grass Touching Simulator`
- Windows identity: `~/.ssh/github_rafbu_windows`

## Trigger Phrases

When the user says any of these near the end of a desktop session:

- "handoff"
- "handoff and sync"
- "handoff & sync with the mac"
- "sync with the mac"
- "push this to the mac"

Treat it as a request to prepare the project for Mac mini continuation:

1. Check `git status --short`.
2. If the work was substantial, create a dated handoff in `handoffs/` and update
   `handoffs/LATEST.json`.
3. Stage and commit only the intended project changes.
4. Run `npm run sync:mac:handoff` from the Windows desktop checkout.
5. Report the commit hash, Mac pull result, and any remaining unrelated local
   files.

If the user says "sync up", "sync back", "resume from mac", or "pull from mac"
after returning to the desktop, treat it as a request to run:

```powershell
npm run sync:mac:resume
```

If there are uncommitted tracked changes on the desktop, stop and explain what
needs to be committed, stashed, or discarded before syncing.

## Leaving Home

Before shutting down the desktop:

1. Finish or pause the current work.
2. For a substantial session, create/update a handoff in `handoffs/` and update
   `handoffs/LATEST.json`.
3. Commit the intended project changes.
4. Push and pull on the Mac:

```powershell
node scripts/sync-mac-mini.mjs handoff
```

Use `handoff --build` when the Mac should also prove the build still passes
before you leave.

## At Work

Use Codex Remote on the Mac mini. Start by asking Mac Codex to read:

1. `AGENTS.md`
2. `handoffs/LATEST.json`
3. The handoff referenced by `latestHandoff`
4. `docs/DESKTOP_MAC_SYNC_WORKFLOW.md`
5. `docs/REMOTE_MAC_MINI_SETUP.md`

Before ending Mac-side work, commit and push intended changes. For substantial
work, write a new handoff and update `handoffs/LATEST.json`.

## Back At The Desktop

After booting the desktop again:

```powershell
node scripts/sync-mac-mini.mjs resume
```

Use `resume --build` when you want the desktop to run `npm run build` after
pulling.

## What Does Not Sync

The sync helper intentionally does not move local-only files:

- `node_modules/`
- `dist/`
- `.vercel/`
- browser save data
- scratch assets or ignored local experiments
- secrets and tokens

These either regenerate locally or are machine-specific. Shared project
knowledge should be committed to Git, especially `AGENTS.md`, `docs/`, and
`handoffs/`.
