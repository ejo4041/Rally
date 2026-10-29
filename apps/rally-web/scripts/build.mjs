import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/app.js",
  bundle: true,
  format: "esm",
  target: "es2022",
  sourcemap: true,
});
await Promise.all(
  ["index.html", "style.css"].map((name) =>
    copyFile("src/" + name, "dist/" + name),
  ),
);
console.log("Built Rally frontend.");
