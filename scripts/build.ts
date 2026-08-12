import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

await rm("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  format: "esm",
  target: "browser",
  external: ["react"],
  sourcemap: "linked",
  banner: '"use client";',
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// Bun drops empty rules, including the Idle marker the pane-state drift
// test requires. Ship the source stylesheet as written.
if (existsSync("dist/index.css")) unlinkSync("dist/index.css");
writeFileSync("dist/gisx-icon.css", readFileSync("src/gisx-icon.css"));

let js = readFileSync("dist/index.js", "utf8");
if (js.length < 1000) {
  console.error("build produced a barrel re-export instead of a bundle");
  process.exit(1);
}
if (!js.includes("gisx-icon.css")) {
  js = js.replace(/^("use client";\n)?/, `"use client";\nimport "./gisx-icon.css";\n`);
  writeFileSync("dist/index.js", js);
}

const tsc = spawnSync("bunx", ["tsc", "-p", "tsconfig.build.json"], { stdio: "inherit" });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);
