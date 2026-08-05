import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const distDir = path.join(projectRoot, "dist");
const distAssetsDir = path.join(distDir, "assets");
const androidAssetsDir = path.join(projectRoot, "android", "app", "src", "main", "assets");

await assertDirectory(distAssetsDir);
await rm(androidAssetsDir, { force: true, recursive: true });
await mkdir(androidAssetsDir, { recursive: true });

let indexHtml = await readFile(path.join(distDir, "index.html"), "utf8");
indexHtml = stripWebDiscoveryMarkup(indexHtml);
await writeFile(path.join(androidAssetsDir, "index.html"), indexHtml, "utf8");

for (const entry of await readdir(distAssetsDir, { withFileTypes: true })) {
  await cp(
    path.join(distAssetsDir, entry.name),
    path.join(androidAssetsDir, entry.name),
    { recursive: entry.isDirectory() },
  );
}

const packagedBytes = await measureDirectory(androidAssetsDir);
const packagedFiles = await countFiles(androidAssetsDir);
console.log(`Prepared ${packagedFiles} offline files (${formatBytes(packagedBytes)}) in ${androidAssetsDir}`);

async function assertDirectory(directory) {
  const entry = await stat(directory).catch(() => undefined);
  if (!entry?.isDirectory()) {
    throw new Error(`Missing ${directory}. Run npm run build before preparing Android assets.`);
  }
}

function stripWebDiscoveryMarkup(html) {
  return html
    .replace(/\s*<link rel="canonical"[^>]*>/gi, "")
    .replace(/\s*<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>/gi, "")
    .replace(/\s*<meta property="og:[^"]+"[^>]*>/gi, "")
    .replace(/\s*<meta name="twitter:[^"]+"[^>]*>/gi, "");
}

async function measureDirectory(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    total += entry.isDirectory() ? await measureDirectory(entryPath) : (await stat(entryPath)).size;
  }
  return total;
}

async function countFiles(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    total += entry.isDirectory() ? await countFiles(path.join(directory, entry.name)) : 1;
  }
  return total;
}

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}
