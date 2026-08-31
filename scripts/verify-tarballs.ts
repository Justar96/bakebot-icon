import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Prove what a consumer actually receives.
 *
 * Every other gate in this repo tests the workspace, where `@bakebot/core`
 * resolves to its source through tsconfig `paths`. A consumer resolves it from
 * npm to core's `dist`, and nothing else here exercises that path — so a
 * difference between the two would be invisible until someone installed the
 * package.
 *
 * This packs both packages exactly as `bun publish` would, installs the
 * tarballs into a scratch project *outside* the workspace, and checks the four
 * things that could be wrong and could not be caught anywhere else.
 */

const ROOT = import.meta.dir.replace(/\/scripts$/, "");
const run = (cmd: string[], cwd: string) => {
  const result = spawnSync(cmd[0]!, cmd.slice(1), { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    console.error(`✗ ${cmd.join(" ")} (in ${cwd})`);
    console.error(result.stdout, result.stderr);
    process.exit(1);
  }
  return result.stdout;
};

const scratch = mkdtempSync(join(tmpdir(), "bakebot-consumer-"));
const failures: string[] = [];
const check = (ok: boolean, description: string) => {
  console.log(`${ok ? "✓" : "✗"} ${description}`);
  if (!ok) failures.push(description);
};

/* Version bumps land in package.json but the packer reads workspace versions
 * out of bun.lock, so an install has to happen in between or the pin that
 * ships points at whatever the lockfile last saw. */
run(["bun", "install"], ROOT);

const tarballs: Record<string, string> = {};
const packedManifests: Record<
  string,
  { version: string; dependencies?: Record<string, string>; sideEffects?: boolean | string[] }
> = {};
for (const [name, dir] of [
  ["@bakebot/core", "packages/core"],
  ["@bakebot/react", "packages/react"],
] as const) {
  run(["bun", "run", "build"], join(ROOT, dir));
  /* `--filename` and `--destination` are mutually exclusive, so the name is
   * Bun's own and `--quiet` reports it. Which is the better arrangement anyway:
   * the tarball is named the way the registry will name it. */
  const printed = run(
    ["bun", "pm", "pack", "--quiet", "--destination", scratch],
    join(ROOT, dir),
  ).trim();
  const path = printed.startsWith("/") ? printed : join(scratch, printed);
  tarballs[name] = path;

  const manifest = JSON.parse(
    run(["tar", "-xzOf", path, "package/package.json"], scratch),
  ) as {
    version: string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    keywords?: string[];
    sideEffects?: boolean | string[];
  };
  packedManifests[name] = manifest;
  const declared = JSON.stringify({
    dependencies: manifest.dependencies ?? {},
    peerDependencies: manifest.peerDependencies ?? {},
    devDependencies: manifest.devDependencies ?? {},
  });
  const files = run(["tar", "-tzf", path], scratch)
    .trim()
    .split("\n")
    .filter(Boolean);

  // npm cannot resolve either protocol. Bun's packer rewrites them; if one
  // survives, the published package is unresolvable for everyone.
  check(!declared.includes("workspace:"), `${name}: no workspace: protocol in the manifest`);
  check(!declared.includes("catalog:"), `${name}: no catalog: protocol in the manifest`);
  check(files.includes("package/README.md"), `${name}: the tarball carries its README`);
  check(files.includes("package/CHANGELOG.md"), `${name}: the tarball carries its changelog`);
  check(files.includes("package/LICENSE"), `${name}: the tarball carries the MIT licence text`);
  check(!files.some((file) => file.endsWith(".map")), `${name}: the tarball carries no source maps`);

  /* This is a hard rename, not a deprecation. Construct the retired spelling
   * so the verifier itself does not preserve it in source, then scan both file
   * names and every text file that can reach a consumer. */
  const retiredName = ["gi", "sx"].join("");
  const retired = new RegExp(retiredName, "i");
  const retiredLocations = files.filter((file) => retired.test(file));
  for (const file of files.filter((file) => /\.(?:js|d\.ts|css|json|md)$/.test(file))) {
    const contents = run(["tar", "-xzOf", path, file], scratch);
    if (retired.test(contents)) retiredLocations.push(file);
  }
  check(
    retiredLocations.length === 0,
    `${name}: the tarball contains no retired mascot names or paths`,
  );
  if (retiredLocations.length > 0) console.error([...new Set(retiredLocations)].join("\n"));

  for (const file of files.filter((file) => /\.(?:js|d\.ts)$/.test(file))) {
    const contents = run(["tar", "-xzOf", path, file], scratch);
    check(
      !contents.includes("sourceMappingURL="),
      `${name}: ${file.replace(/^package\//, "")} has no dangling source map reference`,
    );
  }

  if (name === "@bakebot/react") {
    check(
      Array.isArray(manifest.keywords) && manifest.keywords.length > 0,
      "@bakebot/react declares searchable keywords",
    );
    check(
      Array.isArray(manifest.sideEffects) &&
        manifest.sideEffects.length === 2 &&
        manifest.sideEffects[0] === "./dist/index.js" &&
        manifest.sideEffects[1] === "./dist/bakebot-icon.css",
      "@bakebot/react marks only its CSS-bearing wrapper and stylesheet as effectful",
    );
  }
}

/* Everything above reads the tarball ourselves. These two read it the way the
 * ecosystem does.
 *
 * `publint` checks the manifest against how registries and bundlers actually
 * behave. `attw` resolves every export the way TypeScript will, under each
 * module resolution mode a consumer can pick, which is the one thing none of
 * our own checks did: 0.3.1 shipped declarations whose relative specifiers had
 * no file extensions, so `moduleResolution: node16` could not resolve them and
 * reported the failure against the consumer's own import line. The runtime
 * bundle was correct throughout, which is why 97 checks, 86 tests and a real
 * consuming site all passed while the types were broken.
 *
 * `--profile esm-only` is the honest description of these packages: they are
 * ESM, and a CJS `require` of them is expected to fail rather than being a
 * defect to report. The stylesheet export is excluded because a `.css` file
 * has no types and no JavaScript for `attw` to resolve. */
for (const [name, tarball] of Object.entries(tarballs)) {
  const lint = spawnSync("bunx", ["publint", tarball], { encoding: "utf8" });
  check(lint.status === 0, `${name}: publint reports a publishable manifest`);
  if (lint.status !== 0) console.error(lint.stdout ?? lint.stderr);

  const types = spawnSync(
    "bunx",
    /* `--exclude-entrypoints` takes a list, so it swallows the tarball path if
     * that comes after it. The file has to be first. */
    ["attw", tarball, "--profile", "esm-only", "--exclude-entrypoints", "bakebot-icon.css"],
    { encoding: "utf8" },
  );
  check(
    types.status === 0,
    `${name}: every export resolves for TypeScript under node16 and bundler`,
  );
  if (types.status !== 0) console.error(types.stdout ?? types.stderr);
}

const reactManifest = JSON.parse(
  run(["tar", "-xzOf", tarballs["@bakebot/react"]!, "package/package.json"], scratch),
) as { dependencies: Record<string, string> };
const corePin = reactManifest.dependencies["@bakebot/core"];
const coreVersion = packedManifests["@bakebot/core"]!.version;
check(
  corePin === `^${coreVersion}`,
  `@bakebot/react pins @bakebot/core at ^${coreVersion} (got ${corePin})`,
);

/* A real consumer: outside the workspace, no tsconfig paths, resolving both
 * packages from node_modules the way npm would lay them out. */
mkdirSync(join(scratch, "app/src"), { recursive: true });
writeFileSync(
  join(scratch, "app/package.json"),
  JSON.stringify(
    {
      name: "bakebot-consumer",
      private: true,
      type: "module",
      dependencies: {
        "@bakebot/core": `file:${tarballs["@bakebot/core"]}`,
        "@bakebot/react": `file:${tarballs["@bakebot/react"]}`,
        react: "^19.2.0",
        "react-dom": "^19.2.0",
      },
      /* `jsx: "react-jsx"` reaches for `react/jsx-runtime`, which is untyped
       * without `@types/react` — a failure of the scratch app, not of the
       * package.
       *
       * TypeScript 5 on purpose, while the workspace builds on 7: consumers
       * are on 5.x, and the declarations this checks are the ones they will
       * read. A syntax 7 emits and 5 cannot parse would fail here. */
      devDependencies: {
        "@types/react": "^19.2.0",
        typescript: "^5.9.0",
      },
      /* The binding pins core at the release's matching caret range — the
       * check above proves the concrete version — which the installer then
       * tries to resolve from the registry before this release exists there.
       * The override points that transitive edge at the same tarball. */
      overrides: {
        "@bakebot/core": `file:${tarballs["@bakebot/core"]}`,
      },
    },
    null,
    2,
  ),
);
writeFileSync(
  join(scratch, "app/tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
      },
      include: ["src"],
    },
    null,
    2,
  ),
);
/* Touches the component, the headless driver, and the types re-exported
 * through the binding — so a break in any of the three fails the typecheck. */
writeFileSync(
  join(scratch, "app/src/app.tsx"),
  `import { createRef } from "react";
import { BakebotIcon, createMascot, DEFAULT_TUNING } from "@bakebot/react";
import { facingEyes, MASCOT_SHAPES, mascotGeometry, SETTLED_TUNING } from "@bakebot/react";
import type { FacingEye, BakebotIconPaneState, MascotPose, MascotTuning, TileSpec } from "@bakebot/react";
import { createMascot as fromCore } from "@bakebot/core";
import { BakebotIcon as HeadlessBakebotIcon, createMascot as fromHeadless } from "@bakebot/react/headless";

const state: BakebotIconPaneState = { Exited: { code: 0 } };
const tuning: MascotTuning = { ...DEFAULT_TUNING, restlessness: 1.5 };
const mascot = createMascot({ intents: [{ x: 1, y: 1, hold: 1 }], seed: 1, tuning });
mascot.advance(1 / 60);
const pose: MascotPose = mascot.pose();

const tile: TileSpec = { halfY: 24, radius: 12 };
const root = createRef<SVGSVGElement>();
export const App = () => (
  <>
    <BakebotIcon className="consumer-mark" ref={root} seed={2} shape="pill" size="0.78em" state={state} style={{ opacity: 0.75 }} tuning={tuning} />
    <HeadlessBakebotIcon shape={tile} />
  </>
);
const facing: readonly FacingEye[] = facingEyes(pose.yaw, pose.pitch);
export const headless = [pose.x, typeof fromCore, typeof fromHeadless, mascotGeometry("card").tile.height, MASCOT_SHAPES.circle.radius, SETTLED_TUNING.deadzone, facing[0]!.scaleX, facing[0]!.scaleY] as const;
`,
);

run(["bun", "install"], join(scratch, "app"));
check(true, "both tarballs install into a scratch project");

/* A manifest can claim the CSS is effectful while marking the tiny wrapper
 * that imports it as safe to prune. A bundler then resolves `BakebotIcon`
 * straight from headless.js and silently emits an unstyled mascot. Exercise
 * the packed package through a real production bundle and inspect its asset. */
writeFileSync(
  join(scratch, "app/src/bundle.tsx"),
  'import { BakebotIcon } from "@bakebot/react"; console.log(BakebotIcon);\n',
);
const bundledConsumer = spawnSync(
  "bun",
  [
    "build",
    "src/bundle.tsx",
    "--outdir",
    "bundle",
    "--target",
    "browser",
    "--external",
    "react",
    "--external",
    "react/jsx-runtime",
  ],
  { cwd: join(scratch, "app"), encoding: "utf8" },
);
const bundleDirectory = join(scratch, "app/bundle");
const bundledCss =
  bundledConsumer.status === 0
    ? readdirSync(bundleDirectory)
        .filter((file) => file.endsWith(".css"))
        .map((file) => readFileSync(join(bundleDirectory, file), "utf8"))
        .join("\n")
    : "";
const reactSideEffects = packedManifests["@bakebot/react"]!.sideEffects;
const wrapperIsEffectful =
  Array.isArray(reactSideEffects) && reactSideEffects.includes("./dist/index.js");
check(
  wrapperIsEffectful &&
    bundledConsumer.status === 0 &&
    bundledCss.includes(".bakebot-icon__disc") &&
    bundledCss.includes(".bakebot-icon__tile"),
  `a consumer bundle keeps the mascot stylesheet through an effectful default entry${
    bundledConsumer.status === 0
      ? ""
      : `\n${bundledConsumer.stdout}${bundledConsumer.stderr}`
  }`,
);

const nodeImport = spawnSync(
  "node",
  [
    "--input-type=module",
    "-e",
    'const binding = await import("@bakebot/react/headless"); if (typeof binding.BakebotIcon !== "function" || typeof binding.createMascot !== "function") process.exit(1);',
  ],
  { cwd: join(scratch, "app"), encoding: "utf8" },
);
check(
  nodeImport.status === 0,
  `the headless entry imports in plain Node with no CSS loader${
    nodeImport.status === 0 ? "" : `\n${nodeImport.stdout}${nodeImport.stderr}`
  }`,
);

const defaultBundle = readFileSync(
  join(scratch, "app/node_modules/@bakebot/react/dist/index.js"),
  "utf8",
);
const headlessBundle = readFileSync(
  join(scratch, "app/node_modules/@bakebot/react/dist/headless.js"),
  "utf8",
);
const implementationFiles = [defaultBundle, headlessBundle].filter((bundle) =>
  bundle.includes("bakebot-icon__disc"),
);
check(
  implementationFiles.length === 1 && headlessBundle.includes("bakebot-icon__disc"),
  "the component implementation lives in the headless bundle exactly once",
);
check(
  defaultBundle.includes('import "./bakebot-icon.css"') &&
    defaultBundle.includes('export * from "./headless.js"'),
  "the default entry adds CSS and re-exports the headless public surface",
);

const tscOut = spawnSync("bunx", ["tsc", "-p", "tsconfig.json"], {
  cwd: join(scratch, "app"),
  encoding: "utf8",
});
check(
  tscOut.status === 0,
  `a consumer typechecks against the published declarations${
    tscOut.status === 0 ? "" : `\n${tscOut.stdout}${tscOut.stderr}`
  }`,
);

/* The bug that shipped in 0.2.0: the eyes' fill reached for the host
 * application's theme token with no fallback, so a consumer that did not
 * define it got an invalid `fill` — black on a dark tile, no visible eyes. */
const css = readFileSync(join(scratch, "app/node_modules/@bakebot/react/dist/bakebot-icon.css"), "utf8");
check(
  /--bakebot-eye-color:\s*var\(--window-bg,\s*#[0-9a-f]{3,8}\)/i.test(css),
  "the eye fill falls back to a literal for an off-brand consumer",
);
/* What a state *looks like* is `STATE_POSE` in the character package now, so
 * there are no per-state value rules left to check. What remains keyed on
 * `data-state` is the two one-shot entrances, and those are exactly the kind
 * of rule Bun's CSS transformer would drop if they ever lost their
 * declarations — inherited from LightningCSS, and deliberate upstream. */
for (const state of ["NeedsAttention", "Notified"] as const) {
  check(
    new RegExp(`data-state="${state}"\\][^{]*\\{[^}]*animation:`).test(css),
    `the ${state} entrance survives bundling as a declaration`,
  );
}

/* Lose the discs' fill in bundling and both eyes take SVG's black default;
 * lose the class entirely and the DOM structure no longer matches the hook. */
check(
  /\.bakebot-icon__disc[^{]*\{[^}]*fill:\s*var\(--bakebot-eye-color/.test(css),
  "the discs keep the eye colour after bundling",
);

/* Each disc narrows and blinks about its own centre. Lose the fill-box origin
 * and both happen about the middle of the icon instead, which slides the eyes
 * toward the nose rather than foreshortening them. */
check(
  /\.bakebot-icon__disc[^{]*\{[^}]*transform-box:\s*fill-box/.test(css),
  "a turning disc keeps its own transform origin after bundling",
);

/* Export parity with the release a real site already consumes. Read the
 * published declaration rather than maintaining a second, inevitably stale
 * list here. Each new entry is checked independently: a name surviving only
 * in headless must not make the default entry appear compatible. */
type DeclarationSurface = { runtime: Set<string>; types: Set<string> };
const declarationSurface = (path: string, seen = new Set<string>()): DeclarationSurface => {
  const surface: DeclarationSurface = { runtime: new Set(), types: new Set() };
  if (seen.has(path)) return surface;
  seen.add(path);
  const declaration = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const addList = (list: string, target: Set<string>) => {
    for (const item of list.split(",")) {
      const words = item.trim().replace(/^type\s+/, "").split(/\s+as\s+/);
      const name = words.at(-1)?.trim();
      if (name) target.add(name);
    }
  };
  for (const match of declaration.matchAll(/export\s+type\s*\{([\s\S]*?)\}\s*from/g)) {
    addList(match[1]!, surface.types);
  }
  const withoutTypeExports = declaration.replace(/export\s+type\s*\{[\s\S]*?\}\s*from[^;]+;/g, "");
  for (const match of withoutTypeExports.matchAll(/export\s*\{([\s\S]*?)\}(?:\s*from[^;]+)?;/g)) {
    addList(match[1]!, surface.runtime);
  }
  for (const match of declaration.matchAll(/export\s+(?:declare\s+)?(?:const|function|class|enum|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
    surface.runtime.add(match[1]!);
  }
  for (const match of declaration.matchAll(/export\s+(?:interface|type)\s+([A-Za-z_$][\w$]*)/g)) {
    surface.types.add(match[1]!);
  }
  for (const match of declaration.matchAll(/export\s+\*\s+from\s+["'](\.\/[^"']+)["']/g)) {
    /* Declarations spell relative specifiers with the `.js` extension the
     * runtime uses, because that is what resolves under node16. The file next
     * to them is the matching `.d.ts`. */
    const specifier = match[1]!.slice(2).replace(/\.js$/, "");
    const nestedPath = join(path.replace(/\/[^/]+$/, ""), `${specifier}.d.ts`);
    const nested = declarationSurface(nestedPath, seen);
    for (const name of nested.runtime) surface.runtime.add(name);
    for (const name of nested.types) surface.types.add(name);
  }
  return surface;
};

/* The baseline is whatever the registry serves as `latest`, never a pin, but
 * compatibility belongs to a release line. Before 1.0 each minor starts a new
 * line; after 1.0 each major does. That lets 0.4.0 make an intentional hard
 * cut while 0.4.1 is still required to preserve everything 0.4.0 shipped.
 *
 * Looked up softly. `run` exits on a non-zero status, and a package with no
 * release yet is a first publish rather than a failure. */
const latest = spawnSync("npm", ["view", "@bakebot/react", "version"], {
  cwd: scratch,
  encoding: "utf8",
});
const baseline = latest.status === 0 ? latest.stdout.trim() : "";

const currentVersion = packedManifests["@bakebot/react"]!.version;
const compatibilityLine = (version: string) => {
  const [major = "0", minor = "0"] = version.split(".");
  return major === "0" ? `${major}.${minor}` : major;
};
const sameCompatibilityLine = compatibilityLine(baseline) === compatibilityLine(currentVersion);

if (!baseline) {
  console.log("• nothing published yet, so there is no surface to have broken");
} else if (!sameCompatibilityLine) {
  console.log(
    `• ${currentVersion} starts compatibility line ${compatibilityLine(currentVersion)}; ` +
      `${baseline} belongs to ${compatibilityLine(baseline)}`,
  );
} else {
  const publishedDirectory = join(scratch, `published-${baseline}`);
  mkdirSync(publishedDirectory);
  const publishedTarballName = run(
    [
      "npm",
      "pack",
      `@bakebot/react@${baseline}`,
      "--silent",
      "--pack-destination",
      publishedDirectory,
    ],
    scratch,
  ).trim();
  const publishedTarball = join(publishedDirectory, publishedTarballName);
  run(["tar", "-xzf", publishedTarball], publishedDirectory);
  const publishedSurface = declarationSurface(join(publishedDirectory, "package/dist/index.d.ts"));
  const installedDist = join(scratch, "app/node_modules/@bakebot/react/dist");
  for (const [entry, declaration] of [
    ["@bakebot/react", "index.d.ts"],
    ["@bakebot/react/headless", "headless.d.ts"],
  ] as const) {
    const currentSurface = declarationSurface(join(installedDist, declaration));
    for (const name of [...publishedSurface.runtime].sort()) {
      check(
        currentSurface.runtime.has(name),
        `${entry} still exports runtime ${name} from ${baseline}`,
      );
    }
    for (const name of [...publishedSurface.types].sort()) {
      check(currentSurface.types.has(name), `${entry} still exports type ${name} from ${baseline}`);
    }
  }
}

console.log(`\nscratch consumer: ${scratch}`);
if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nthe published artifacts are what a consumer needs.");
