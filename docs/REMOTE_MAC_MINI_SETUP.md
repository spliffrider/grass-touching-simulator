# Remote Mac Mini Setup

This project can be operated from the always-on Mac mini over SSH. Do not store
or request the Mac password in Codex. Use the key-based setup below.

## Host

- Hostname: `mac-mini-van-raf.local`
- LAN IPv4 observed: `192.168.0.250`
- Secondary IPv4 observed during DNS lookup: `192.168.0.159`
- Mac user: `henry`
- Mac project path: `/Users/henry/Documents/Grass Touching Simulator`
- Windows SSH identity: `C:\Users\rafbu\.ssh\github_rafbu_windows`

Prefer the hostname first. Use `192.168.0.250` if `.local` resolution is flaky.

```powershell
ssh -i $HOME\.ssh\github_rafbu_windows -o BatchMode=yes henry@mac-mini-van-raf.local "whoami; hostname; pwd"
ssh -i $HOME\.ssh\github_rafbu_windows -o BatchMode=yes henry@192.168.0.250 "whoami; hostname; pwd"
```

## Remote Command Pattern

Homebrew tools on the Mac live in `/opt/homebrew/bin`. Non-interactive SSH
sessions may not load the same `PATH` as the Codex app, so prefix commands with
an explicit path when using `node`, `npm`, `gh`, or `vercel`.

```powershell
ssh -i $HOME\.ssh\github_rafbu_windows -o BatchMode=yes henry@192.168.0.250 `
  "cd '/Users/henry/Documents/Grass Touching Simulator' && env PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run build"
```

Useful checks:

```powershell
ssh -i $HOME\.ssh\github_rafbu_windows -o BatchMode=yes henry@192.168.0.250 `
  "cd '/Users/henry/Documents/Grass Touching Simulator' && git status -sb && git remote -v && git log --oneline -5"
```

## GitHub State

- The Mac clone uses SSH remote:
  `git@github.com:spliffrider/grass-touching-simulator.git`
- The Mac has a dedicated repo-only GitHub deploy key:
  `/Users/henry/.ssh/github_macmini_codex`
- The public deploy key was added to the GitHub repo with write access.
- `~/.ssh/config` on the Mac contains:

```sshconfig
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_macmini_codex
  IdentitiesOnly yes
```

Verified from Windows over SSH:

```text
git fetch --all --prune: works
git push --dry-run origin HEAD:refs/heads/codex/mac-connectivity-check: works
npm run build: works
```

Never print, copy, or commit the private key.

## Vercel State

- Vercel CLI exists on the Mac at `/opt/homebrew/bin/vercel`.
- The Mac was logged into Vercel as `rafbuelens-3610`, which does not have
  access to the existing production project.
- The Windows desktop is logged into Vercel as `spliffrider` and can see the
  `Sensitech` team, where `grass-touching-simulator` lives.
- The Mac clone has `.vercel/project.json` copied from Windows and pointing at:
  - project id: `prj_ELohypPku8onlzymchYvLf35cFAc`
  - org id: `team_uFm3wwET7QcPCKLB9zIxJCq4`
  - project name: `grass-touching-simulator`

Remaining Vercel task: log the Mac Vercel CLI into the account/scope that can
access `Sensitech` and the existing `grass-touching-simulator` project.

```sh
vercel logout
vercel login
vercel whoami
vercel projects ls --scope sensitech
```

Do not create a new Vercel project for Grass Touching Simulator unless the user
explicitly asks.

## Security Notes

- The Mac password was pasted into a chat image during setup. Treat it as
  exposed and change it when convenient.
- Future sessions should use SSH keys only.
- Do not store passwords, GitHub tokens, Vercel tokens, or private keys in the
  repository or handoff files.

## Working Model

- Mac mini: intended always-on primary operator for `master`, builds, pushes,
  and eventually Vercel deploy checks.
- Windows desktop: secondary local machine for running the game, visual checks,
  browser perf harnesses, and branch work.
- Use GitHub as the source of truth.
- For substantial sessions, write a handoff in `handoffs/` and update
  `handoffs/LATEST.json`.
