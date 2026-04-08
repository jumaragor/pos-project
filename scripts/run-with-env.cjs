const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const content = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const [, , envFileArg, ...commandParts] = process.argv;

if (!envFileArg || commandParts.length === 0) {
  console.error("Usage: node scripts/run-with-env.cjs <env-file> <command>");
  process.exit(1);
}

const envFile = path.resolve(process.cwd(), envFileArg);
const command = commandParts.join(" ");
const mergedEnv = {
  ...process.env,
  ...parseEnvFile(envFile)
};

const shell = process.platform === "win32" ? "cmd.exe" : "sh";
const shellArgs = process.platform === "win32" ? ["/c", command] : ["-c", command];

const child = spawn(shell, shellArgs, {
  stdio: "inherit",
  env: mergedEnv
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
