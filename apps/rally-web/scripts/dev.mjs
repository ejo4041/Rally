import { createServer } from "node:http";
import { request } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const target = new URL(process.env.RALLY_API_URL || "http://127.0.0.1:3001");
if (target.protocol !== "http:")
  throw new Error("Development API proxy expects a local HTTP server");
const bundle = (renderer = false) =>
  build({
    entryPoints: [fileURLToPath(new URL(renderer ? "../src/renderer.ts" : "../src/main.ts", import.meta.url))],
    bundle: true,
    format: "esm",
    target: "es2022",
    write: false,
  });
const server = createServer(async (req, res) => {
  if (req.url?.startsWith("/api/")) {
    const upstream = request(
      new URL(req.url, target),
      { method: req.method, headers: { ...req.headers, host: target.host } },
      (response) => {
        res.writeHead(response.statusCode || 502, response.headers);
        response.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent)
        res.writeHead(502, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Rally API is unavailable. Start the API and retry.",
        }),
      );
    });
    req.on("aborted", () => upstream.destroy());
    req.pipe(upstream);
    return;
  }
  try {
    const path = new URL(req.url || "/", "http://local").pathname;
    const types = {
      "/": "text/html; charset=utf-8",
      "/index.html": "text/html; charset=utf-8",
      "/style.css": "text/css; charset=utf-8",
      "/renderer.html": "text/html; charset=utf-8",
      "/renderer.js": "text/javascript; charset=utf-8",
      "/app.js": "text/javascript; charset=utf-8",
    };
    if (!Object.hasOwn(types, path)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const body =
      (path === "/app.js" || path === "/renderer.js")
        ? (await bundle(path === "/renderer.js")).outputFiles[0].contents
        : await readFile(
            new URL(
              "../src/" + (path === "/" ? "index.html" : path.slice(1)),
              import.meta.url,
            ),
          );
    res.writeHead(200, {
      "content-type": types[path],
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
    });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end("Frontend build failed. Check the terminal.");
  }
});
const port = Number(process.env.RALLY_WEB_PORT || 5173);
server.listen(port, "127.0.0.1", () =>
  console.log(`Rally frontend: http://127.0.0.1:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => server.close(() => process.exit(0)));
