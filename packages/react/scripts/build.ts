import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

/**
 * Build the React binding.
 *
 * The character is deliberately *not* inlined. React and `@gisx-icon/core`
 * both stay bare specifiers in the output, so a consumer resolves one
 * installed copy of each — which is the whole point of the split, and what a
 * future Solid or canvas binding would share.
 */

await rm("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  format: "esm",
  target: "browser",
  /* Named rather than `packages: "external"`, which externalises *any* bare
   * import — a typo would then ship as a broken runtime import instead of
   * failing this build. */
  external: ["react", "react-dom", "react/jsx-runtime", "@gisx-icon/*"],
  /* Without this Bun emits `react/jsx-dev-runtime`, whose every call carries
   * validation meant for development. Setting `NODE_ENV` in the environment
   * does *not* reach the JSX transform — only this does. */
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  sourcemap: "linked",
  banner: '"use client";',
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

/* Ship the stylesheet as written.
 *
 * Bun's CSS pipeline is a port of LightningCSS and transforms by default: it
 * discards rules that carry no declarations, and there are open upstream bugs
 * around `:where()`/`:has()` duplication and colour downlevelling. None of that
 * is wanted for a 166-line hand-written stylesheet, so the emitted CSS is
 * dropped and the source is copied byte for byte. The exported path is
 * `./gisx-icon.css`; Bun names its own output after the entrypoint, which is
 * the other reason this cannot simply be kept. */
if (existsSync("dist/index.css")) unlinkSync("dist/index.css");
writeFileSync("dist/gisx-icon.css", readFileSync("src/gisx-icon.css"));

/* Bun strips the stylesheet import out of the JavaScript entirely, so a
 * consumer's bundler would never learn the CSS exists. Put it back. */
let js = readFileSync("dist/index.js", "utf8");
if (!js.includes("gisx-icon.css")) {
  js = js.replace(/^("use client";\n)?/, `"use client";\nimport "./gisx-icon.css";\n`);
  writeFileSync("dist/index.js", js);
}

/* Same pruning guard as core's build: the bundle must contain the component,
 * not merely name it in an export list. */
if (!js.includes("gisx-icon__tile")) {
  console.error("react bundle is missing the component: the module graph was pruned away");
  process.exit(1);
}

/* Ship the production JSX runtime. Bun picks `react/jsx-dev-runtime` unless it
 * is told this is a production build, and the dev runtime carries extra
 * validation on every render. */
if (js.includes("jsx-dev-runtime")) {
  console.error("build used the development JSX runtime; set NODE_ENV=production");
  process.exit(1);
}

/* The split is only real if the character stayed external. Inlining it would
 * still build and still work, and would silently give every consumer a second
 * private copy of the simulation. */
if (!/from\s*["']@gisx-icon\/core["']/.test(js)) {
  console.error("build inlined @gisx-icon/core instead of importing it");
  process.exit(1);
}
if (!/from\s*["']react["']/.test(js) && !/from\s*["']react\/jsx-runtime["']/.test(js)) {
  console.error("build inlined react instead of importing it");
  process.exit(1);
}

const tsc = spawnSync("bunx", ["tsc", "-p", "tsconfig.build.json"], { stdio: "inherit" });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

/* `paths` resolves the character from source at build time, and TypeScript
 * will happily bake that relative path into the declarations if a type is
 * reached structurally rather than re-exported by name. A consumer has no
 * `../core/src`, so that would be a broken `.d.ts` that only fails for them. */
const dts = readFileSync("dist/index.d.ts", "utf8");
if (/\.\.\/core\//.test(dts) || /core\/(src|dist)\//.test(dts)) {
  console.error("declarations leaked a path into core's source tree:");
  console.error(dts);
  process.exit(1);
}
