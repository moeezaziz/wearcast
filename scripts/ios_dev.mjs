import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const nodeBin = process.execPath;
let liveServer = null;

function runStep(label, command, args) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`${label}\n`);
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} exited with ${signal ? `signal ${signal}` : `code ${code}`}`
        )
      );
    });
  });
}

function shutdown(code = 0) {
  if (liveServer && !liveServer.killed) {
    liveServer.kill("SIGTERM");
  }
  process.exit(code);
}

async function main() {
  await runStep("Enabling Capacitor iOS dev server...", nodeBin, [
    path.join(repoRoot, "scripts", "set_capacitor_server.mjs"),
    "http://127.0.0.1:5173",
  ]);
  await runStep("Copying updated Capacitor config into iOS...", "npx", ["cap", "copy", "ios"]);

  process.stdout.write("\nStarting WearCast live dev server...\n");
  process.stdout.write("Keep this running, then launch the simulator from Xcode.\n\n");

  liveServer = spawn(nodeBin, [path.join(repoRoot, "scripts", "dev_web_server.mjs")], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  liveServer.on("error", (error) => {
    console.error(error);
    shutdown(1);
  });

  liveServer.on("exit", (code, signal) => {
    if (signal === "SIGTERM" || signal === "SIGINT") {
      process.exit(0);
      return;
    }
    process.exit(code ?? 1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
