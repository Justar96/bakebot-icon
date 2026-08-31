import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

/**
 * Build the character package.
 *
 * Bun bundles the JavaScript and `tsc` emits the declarations: the bundler
 * cannot produce `.d.ts` at all, and its own docs say it is not meant to.
 */

await rm("dist", { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  format: "esm",
  target: "browser",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const js = readFileSync("dist/index.js", "utf8");
if (js.includes("sourceMappingURL=")) {
  console.error("core bundle points at a source map the package does not ship");
  process.exit(1);
}

/* The bundle must actually contain the simulation.
 *
 * A `sideEffects` field in this package's own manifest plus a named-re-export
 * entrypoint makes Bun prune the whole module graph and emit a list of export
 * names with nothing behind them — a successful build and a broken package
 * (oven-sh/bun#27709). The manifest therefore declares no `sideEffects` at
 * all, which `src/index.ts` explains; this is the assertion that catches it
 * coming back. */
for (const symbol of ["stepSpring", "roundedRectDistance", "advanceEye", "createMascot"]) {
  if (!js.includes(symbol)) {
    console.error(`core bundle is missing ${symbol}: the module graph was pruned away`);
    process.exit(1);
  }
}

/* The package has no dependencies, so nothing should have been left as an
 * import. A bare specifier in the output would mean an undeclared dependency
 * that happened to resolve locally. */
const bareImport = /^\s*import\s[^"']*["'](?![./])/m.exec(js);
if (bareImport) {
  console.error(`core bundled an external import it does not declare: ${bareImport[0].trim()}`);
  process.exit(1);
}

const tsc = spawnSync("bunx", ["tsc", "-p", "tsconfig.build.json"], { stdio: "inherit" });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);
