import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: {app: "src/main.ts", renderer: "src/renderer.ts", demo: "src/demo.ts"},
  outdir: "dist",
  bundle: true,
  format: "esm",
  target: "es2022",
  sourcemap: true,
});
await Promise.all(
  ["demo.html", "demo.css", "index.html", "renderer.html", "style.css", "favicon.svg", "theme-init.js"].map((name) =>
    copyFile("src/" + name, "dist/" + name),
  ),
);
console.log("Built Rally frontend.");
