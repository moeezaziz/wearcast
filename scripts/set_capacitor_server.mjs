import fs from "node:fs/promises";
import path from "node:path";

const configPath = path.resolve("capacitor.config.json");
const devServerUrl = process.argv[2]?.trim() || "";

async function main() {
  const raw = await fs.readFile(configPath, "utf8");
  const config = JSON.parse(raw);

  if (devServerUrl) {
    config.server = {
      ...(config.server || {}),
      url: devServerUrl,
      iosScheme: "http",
    };
  } else if (config.server) {
    const nextServer = { ...config.server };
    delete nextServer.url;
    delete nextServer.iosScheme;

    if (Object.keys(nextServer).length) {
      config.server = nextServer;
    } else {
      delete config.server;
    }
  }

  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  process.stdout.write(
    devServerUrl
      ? `Capacitor iOS dev server enabled: ${devServerUrl}\n`
      : "Capacitor dev server disabled; using bundled www assets.\n"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
