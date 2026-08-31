import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Build the React binding.
 *
 * The character is deliberately *not* inlined. React and `@bakebot/core`
 * both stay bare specifiers in the output, so a consumer resolves one
 * installed copy of each — which is the whole point of the split, and what a
 * future Solid or canvas binding would share.
 *
 * Headless is the implementation entry. The default entry is written below as
 * a thin stylesheet-bearing re-export, so importing both specifiers cannot put
 * two copies of the component and its simulation in one application.
 */

await rm("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

/* Bun applies this package's consumer-facing `sideEffects` hint while
 * building the package itself, and prunes the named-re-export entry to names
 * with no definitions (oven-sh/bun#27709). Bundle a throwaway copy of `src`
 * outside the package boundary: consumers keep the narrow hint, the manifest
 * is never rewritten, and an interrupted build cannot leave publish metadata
 * in a half-restored state. */
const bundleRoot = mkdtempSync(join(tmpdir(), "bakebot-react-build-"));
cpSync("src", join(bundleRoot, "src"), { recursive: true });
const bundle = spawnSync(
  "bun",
  ["scripts/bundle.ts", join(bundleRoot, "src/headless.ts"), resolve("dist")],
  { stdio: "inherit" },
);
await rm(bundleRoot, { recursive: true, force: true });
if (bundle.status !== 0) process.exit(bundle.status ?? 1);

/* Ship the stylesheet as written.
 *
 * Bun's CSS pipeline is a port of LightningCSS and transforms by default: it
 * discards rules that carry no declarations, and there are open upstream bugs
 * around `:where()`/`:has()` duplication and colour downlevelling. None of that
 * is wanted for a hand-written stylesheet, so the source is copied byte for
 * byte. */
if (existsSync("dist/headless.css")) unlinkSync("dist/headless.css");
writeFileSync("dist/gisx-icon.css", readFileSync("src/gisx-icon.css"));

/* The browser entry owns the one automatic stylesheet import. Keeping it as a
 * wrapper around headless makes the two package specifiers one module graph,
 * rather than two bundled copies that happen to export the same names. */
const defaultJs =
  '"use client";\nimport "./gisx-icon.css";\nexport * from "./headless.js";\n';
writeFileSync("dist/index.js", defaultJs);

/* Bun labels each bundled module with its source path. The throwaway directory
 * above is intentionally random, so normalise those labels before publishing;
 * otherwise identical source produces different package bytes on every build. */
const emittedHeadlessJs = readFileSync("dist/headless.js", "utf8");
const headlessJs = emittedHeadlessJs.replace(
  /^\/\/ .*\/bakebot-react-build-[^/]+\/src\//gm,
  "// src/",
);
writeFileSync("dist/headless.js", headlessJs);

if (/bakebot-react-build-|\/tmp\//.test(headlessJs)) {
  console.error("headless bundle leaked its temporary build path");
  process.exit(1);
}
if (/\.css["']/.test(headlessJs)) {
  console.error("headless bundle imports CSS instead of leaving it to the caller");
  process.exit(1);
}
if (defaultJs.includes("gisx-icon__tile")) {
  console.error("default entry contains the component instead of re-exporting headless");
  process.exit(1);
}
if (!defaultJs.includes('export * from "./headless.js"')) {
  console.error("default entry does not re-export the headless implementation");
  process.exit(1);
}

/* Same pruning guard as core's build: the bundle must contain the component,
 * not merely name it in an export list. */
if (!headlessJs.includes("gisx-icon__tile")) {
  console.error("headless react bundle is missing the component: the module graph was pruned away");
  process.exit(1);
}

/* Ship the production JSX runtime. Bun picks `react/jsx-dev-runtime` unless it
 * is told this is a production build, and the dev runtime carries extra
 * validation on every render. */
if (headlessJs.includes("jsx-dev-runtime")) {
  console.error("headless build used the development JSX runtime; set NODE_ENV=production");
  process.exit(1);
}

/* The split is only real if the character stayed external. Inlining it would
 * still build and still work, and would silently give every consumer a second
 * private copy of the simulation. */
if (!/from\s*["']@bakebot\/core["']/.test(headlessJs)) {
  console.error("headless build inlined @bakebot/core instead of importing it");
  process.exit(1);
}
if (
  !/from\s*["']react["']/.test(headlessJs) &&
  !/from\s*["']react\/jsx-runtime["']/.test(headlessJs)
) {
  console.error("headless build inlined react instead of importing it");
  process.exit(1);
}

const tsc = spawnSync("bunx", ["tsc", "-p", "tsconfig.build.json"], { stdio: "inherit" });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

/* `paths` resolves the character from source at build time, and TypeScript
 * will happily bake that relative path into the declarations if a type is
 * reached structurally rather than re-exported by name. A consumer has no
 * `../core/src`, so that would be a broken `.d.ts` that only fails for them. */
for (const declaration of ["dist/index.d.ts", "dist/headless.d.ts"]) {
  const dts = readFileSync(declaration, "utf8");
  if (/\.\.\/core\//.test(dts) || /core\/(src|dist)\//.test(dts)) {
    console.error(`${declaration} leaked a path into core's source tree:`);
    console.error(dts);
    process.exit(1);
  }
}
