#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const mode = process.argv[2] ?? "status";
const shouldBuild = process.argv.includes("--build");

const remoteUser = "henry";
const remoteHosts = ["mac-mini-van-raf.local", "192.168.0.250"];
const remoteProjectPath = "/Users/henry/Documents/Grass Touching Simulator";
const identityFile = path.join(os.homedir(), ".ssh", "github_rafbu_windows");
const remoteToolPath = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";

function quoteSh(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function printCommand(command) {
  console.log(`\n$ ${command}`);
}

function run(command, args, options = {}) {
  printCommand([command, ...args].join(" "));
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    process.exit(result.status ?? 1);
  }

  return result;
}

function output(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    process.stderr.write(result.stderr ?? "");
    process.exit(result.status ?? 1);
  }

  return (result.stdout ?? "").trim();
}

function sshArgs(host, script) {
  return [
    "-i",
    identityFile,
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=8",
    `${remoteUser}@${host}`,
    script,
  ];
}

function ssh(script, options = {}) {
  let lastStatus = 1;

  for (const host of remoteHosts) {
    printCommand(`ssh ${remoteUser}@${host} ${script}`);
    const result = spawnSync("ssh", sshArgs(host, script), {
      stdio: "inherit",
      shell: false,
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status === 0) {
      return result;
    }

    lastStatus = result.status ?? 1;
    console.error(`Remote command failed on ${host}; trying next host if available.`);
  }

  if (!options.allowFailure) {
    process.exit(lastStatus);
  }
}

function sshOutput(script) {
  let lastError = "";

  for (const host of remoteHosts) {
    const result = spawnSync("ssh", sshArgs(host, script), {
      encoding: "utf8",
      shell: false,
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status === 0) {
      return (result.stdout ?? "").trim();
    }

    lastError = result.stderr ?? "";
  }

  process.stderr.write(lastError);
  process.exit(1);
}

function ensureNoTrackedChanges() {
  const unstaged = spawnSync("git", ["diff", "--quiet"], { shell: false });
  const staged = spawnSync("git", ["diff", "--cached", "--quiet"], { shell: false });

  if (unstaged.status !== 0 || staged.status !== 0) {
    console.error(
      "Tracked files have uncommitted changes. Commit/stash them before syncing through GitHub.",
    );
    run("git", ["status", "--short"], { allowFailure: true });
    process.exit(1);
  }
}

function currentBranch() {
  const branch = output("git", ["rev-parse", "--abbrev-ref", "HEAD"]);

  if (!branch || branch === "HEAD") {
    console.error("Cannot sync from a detached HEAD. Check out a branch first.");
    process.exit(1);
  }

  return branch;
}

function remoteGit(script) {
  return `cd ${quoteSh(remoteProjectPath)} && ${script}`;
}

function status() {
  console.log("Local desktop status");
  run("git", ["status", "-sb"]);
  run("git", ["log", "--oneline", "-3"]);

  console.log("\nMac mini status");
  ssh(remoteGit("git status -sb && git log --oneline -3"));

  const localHead = output("git", ["rev-parse", "--short", "HEAD"]);
  const remoteHead = sshOutput(remoteGit("git rev-parse --short HEAD"));

  console.log(`\nHEAD comparison: desktop=${localHead} mac=${remoteHead}`);
}

function handoff() {
  const branch = currentBranch();

  console.log(`Preparing to hand off desktop branch '${branch}' to the Mac mini.`);
  ensureNoTrackedChanges();

  run("git", ["fetch", "origin", "--prune"]);
  run("git", ["push", "origin", branch]);

  const remoteScript = [
    "git fetch --all --prune",
    `(git switch ${quoteSh(branch)} 2>/dev/null || git switch --track ${quoteSh(`origin/${branch}`)})`,
    "git pull --ff-only",
    "git status -sb",
    "git log --oneline -3",
  ].join(" && ");

  ssh(remoteGit(remoteScript));

  if (shouldBuild) {
    ssh(remoteGit(`env PATH=${quoteSh(remoteToolPath)} npm run build`));
  }
}

function resume() {
  console.log("Preparing to resume desktop work from GitHub and refresh the Mac mini.");
  ensureNoTrackedChanges();

  run("git", ["fetch", "origin", "--prune"]);
  run("git", ["pull", "--ff-only"]);

  ssh(remoteGit("git fetch --all --prune && git pull --ff-only && git status -sb && git log --oneline -3"));

  if (shouldBuild) {
    run("npm", ["run", "build"]);
  }
}

if (!["status", "handoff", "resume"].includes(mode)) {
  console.error("Usage: node scripts/sync-mac-mini.mjs <status|handoff|resume> [--build]");
  process.exit(1);
}

if (mode === "status") {
  status();
} else if (mode === "handoff") {
  handoff();
} else {
  resume();
}
