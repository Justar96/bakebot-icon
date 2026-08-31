import { readdirSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

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

/* TypeScript writes relative specifiers into declarations exactly as the
 * source wrote them, so an extensionless `./mascot` ships as-is. Under
 * `moduleResolution: node16` or `nodenext` that is not resolvable, and a
 * consumer sees the failure reported against their own import rather than
 * against us — `skipLibCheck` does not suppress it. Shipped 0.3.1 before this
 * guard existed; `are-the-types-wrong` called it an internal resolution
 * error. The runtime bundle was always fine, which is exactly why nothing
 * else noticed. */
for (const declaration of readdirSync("dist").filter((f) => f.endsWith(".d.ts"))) {
  const dts = readFileSync(join("dist", declaration), "utf8");
  const bad = /from\s*["'](\.\.?\/[^"']*)["']/g;
  for (const [, specifier] of dts.matchAll(bad)) {
    if (!specifier) continue;
    if (!/\.(js|css|json)$/.test(specifier)) {
      console.error(
        `dist/${declaration} re-exports "${specifier}" without a file extension, ` +
          `which does not resolve under node16 or nodenext`,
      );
      process.exit(1);
    }
  }
}
