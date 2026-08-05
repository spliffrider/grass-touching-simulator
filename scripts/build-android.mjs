import { randomBytes, createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const androidDir = path.join(projectRoot, "android");
const signingDir = path.join(projectRoot, ".android-signing");
const artifactDir = path.join(projectRoot, "artifacts", "android");
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const javaHome = await resolveJavaHome();
const androidHome = await resolveAndroidHome();
const environment = {
  ...process.env,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
  JAVA_HOME: javaHome,
  PATH: `${path.join(javaHome, "bin")}${path.delimiter}${process.env.PATH ?? ""}`,
};

if (!process.env.npm_execpath) {
  throw new Error("npm_execpath is unavailable. Run this build through npm run android:apk.");
}
await run(process.execPath, [process.env.npm_execpath, "run", "android:assets"], projectRoot, environment);
await ensureSigningKey(javaHome, environment);
await writeLocalProperties(androidHome);
const java = path.join(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java");
const gradleWrapperJar = path.join(androidDir, "gradle", "wrapper", "gradle-wrapper.jar");
await run(java, ["-classpath", gradleWrapperJar, "org.gradle.wrapper.GradleWrapperMain", "--no-daemon", "assembleRelease"], androidDir, environment);

const builtApk = path.join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk");
await mkdir(artifactDir, { recursive: true });
const outputApk = path.join(artifactDir, `GrassTouchingSimulator-${packageJson.version}-offline.apk`);
await copyFile(builtApk, outputApk);
const apk = await readFile(outputApk);
const digest = createHash("sha256").update(apk).digest("hex");
console.log(`APK: ${outputApk}`);
console.log(`Size: ${(apk.byteLength / (1024 * 1024)).toFixed(2)} MiB`);
console.log(`SHA-256: ${digest}`);

async function resolveJavaHome() {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "GrassTouchingSimulator", "android-toolchain", "jdk"),
    process.env.JAVA_HOME,
  ].filter(Boolean);
  for (const candidate of candidates) {
    const java = path.join(candidate, "bin", process.platform === "win32" ? "java.exe" : "java");
    if (await isFile(java) && await getJavaMajorVersion(java) >= 17) {
      return candidate;
    }
  }
  throw new Error("JDK 17 was not found. Set JAVA_HOME or install the local Android toolchain described in docs/ANDROID_OFFLINE_BUILD.md.");
}

async function resolveAndroidHome() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Android", "Sdk"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "GrassTouchingSimulator", "android-toolchain", "sdk"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await isFile(path.join(candidate, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb"))) {
      return candidate;
    }
  }
  throw new Error("Android SDK was not found. Set ANDROID_HOME or install the local Android toolchain described in docs/ANDROID_OFFLINE_BUILD.md.");
}

async function ensureSigningKey(selectedJavaHome, selectedEnvironment) {
  const propertiesPath = path.join(signingDir, "signing.properties");
  const keyStorePath = path.join(signingDir, "grass-touching-alpha.jks");
  if (await isFile(propertiesPath) && await isFile(keyStorePath)) return;

  await mkdir(signingDir, { recursive: true });
  const password = randomBytes(24).toString("base64url");
  const keytool = path.join(selectedJavaHome, "bin", process.platform === "win32" ? "keytool.exe" : "keytool");
  await run(keytool, [
    "-genkeypair",
    "-keystore", keyStorePath,
    "-storepass", password,
    "-keypass", password,
    "-alias", "grass-touching-alpha",
    "-keyalg", "RSA",
    "-keysize", "3072",
    "-validity", "10000",
    "-dname", "CN=Grass Touching Simulator Alpha, O=Sensitech, C=BE",
    "-noprompt",
  ], projectRoot, selectedEnvironment);
  await writeFile(
    propertiesPath,
    `storePassword=${password}\nkeyPassword=${password}\nkeyAlias=grass-touching-alpha\n`,
    "utf8",
  );
  console.log(`Created a private alpha signing key in ${signingDir}. Back this directory up securely.`);
}

async function writeLocalProperties(selectedAndroidHome) {
  const escapedSdkPath = selectedAndroidHome.replace(/\\/g, "/").replace(/:/g, "\\:");
  await writeFile(path.join(androidDir, "local.properties"), `sdk.dir=${escapedSdkPath}\n`, "utf8");
}

async function isFile(filePath) {
  return (await stat(filePath).catch(() => undefined))?.isFile() ?? false;
}

async function getJavaMajorVersion(java) {
  return await new Promise((resolve) => {
    let output = "";
    const child = spawn(java, ["-version"], { shell: false });
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", () => resolve(0));
    child.on("exit", () => {
      const match = output.match(/version\s+"(?:1\.)?(\d+)/i);
      resolve(match ? Number.parseInt(match[1], 10) : 0);
    });
  });
}

async function run(command, args, cwd, env) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, shell: false, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
  });
}
