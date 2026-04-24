import { createReadStream, existsSync, promises as fs } from "node:fs";
import { watch } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const webRoot = path.join(repoRoot, "www");
const host = "127.0.0.1";
const port = Number(process.env.PORT || 5173);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".manifest": "text/cache-manifest; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
};

const clients = new Set();

function injectLiveReload(html) {
  const snippet = `
<script>
window.__WEARCAST_DEV_LIVE__ = true;
(async () => {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {}
  try {
    const source = new EventSource("/__wearcast_live");
    source.addEventListener("reload", () => {
      window.location.reload();
    });
    source.addEventListener("error", () => {
      // Let EventSource auto-reconnect quietly.
    });
  } catch {}
})();
</script>`;
  return html.includes("</body>") ? html.replace("</body>", `${snippet}\n</body>`) : `${html}\n${snippet}`;
}

function noCacheHeaders(contentType) {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Content-Type": contentType,
  };
}

function broadcastReload(changedPath = "") {
  const payload = `event: reload\ndata: ${JSON.stringify({ path: changedPath, ts: Date.now() })}\n\n`;
  for (const res of clients) {
    res.write(payload);
  }
}

function safeDecode(urlPathname = "/") {
  try {
    return decodeURIComponent(urlPathname);
  } catch {
    return "/";
  }
}

async function resolveRequestPath(urlPathname = "/") {
  const decoded = safeDecode(urlPathname).split("?")[0];
  const normalized = decoded === "/" ? "/index.html" : decoded;
  const candidate = path.resolve(webRoot, `.${normalized}`);
  if (!candidate.startsWith(webRoot)) return null;

  try {
    const stat = await fs.stat(candidate);
    if (stat.isDirectory()) {
      const indexPath = path.join(candidate, "index.html");
      if (existsSync(indexPath)) return indexPath;
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || "/", `http://${host}:${port}`);

  if (reqUrl.pathname === "/__wearcast_live") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write("retry: 400\n\n");
    clients.add(res);
    req.on("close", () => {
      clients.delete(res);
    });
    return;
  }

  const filePath = await resolveRequestPath(reqUrl.pathname);
  if (!filePath) {
    res.writeHead(404, noCacheHeaders("text/plain; charset=utf-8"));
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  if (ext === ".html") {
    const html = await fs.readFile(filePath, "utf8");
    res.writeHead(200, noCacheHeaders(contentType));
    res.end(injectLiveReload(html));
    return;
  }

  res.writeHead(200, noCacheHeaders(contentType));
  createReadStream(filePath).pipe(res);
});

watch(webRoot, { recursive: true }, (_eventType, changedPath) => {
  broadcastReload(changedPath || "");
});

server.listen(port, host, () => {
  console.log(`WearCast live dev server running at http://${host}:${port}`);
});
