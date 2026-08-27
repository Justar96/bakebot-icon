import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Prove what a consumer actually receives.
 *
 * Every other gate in this repo tests the workspace, where `@gisx-icon/core`
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

const scratch = mkdtempSync(join(tmpdir(), "gisx-consumer-"));
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
for (const [name, dir] of [
  ["@gisx-icon/core", "packages/core"],
  ["gisx-icon", "packages/react"],
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
  ) as Record<string, Record<string, string>>;
  const declared = JSON.stringify({
    dependencies: manifest.dependencies ?? {},
    peerDependencies: manifest.peerDependencies ?? {},
    devDependencies: manifest.devDependencies ?? {},
  });

  // npm cannot resolve either protocol. Bun's packer rewrites them; if one
  // survives, the published package is unresolvable for everyone.
  check(!declared.includes("workspace:"), `${name}: no workspace: protocol in the manifest`);
  check(!declared.includes("catalog:"), `${name}: no catalog: protocol in the manifest`);
}

const reactManifest = JSON.parse(
  run(["tar", "-xzOf", tarballs["gisx-icon"]!, "package/package.json"], scratch),
) as { dependencies: Record<string, string> };
const corePin = reactManifest.dependencies["@gisx-icon/core"];
const coreVersion = (
  JSON.parse(readFileSync(join(ROOT, "packages/core/package.json"), "utf8")) as {
    version: string;
  }
).version;
check(
  corePin === `^${coreVersion}`,
  `gisx-icon pins @gisx-icon/core at ^${coreVersion} (got ${corePin})`,
);

/* A real consumer: outside the workspace, no tsconfig paths, resolving both
 * packages from node_modules the way npm would lay them out. */
mkdirSync(join(scratch, "app/src"), { recursive: true });
writeFileSync(
  join(scratch, "app/package.json"),
  JSON.stringify(
    {
      name: "gisx-consumer",
      private: true,
      type: "module",
      dependencies: {
        "@gisx-icon/core": `file:${tarballs["@gisx-icon/core"]}`,
        "gisx-icon": `file:${tarballs["gisx-icon"]}`,
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
      /* `gisx-icon`'s manifest pins core at `^0.2.0` — correctly, and the check
       * above is what proves it — which the installer then tries to resolve
       * from the registry, where these versions do not exist yet. The override
       * points that transitive edge at the same tarball. */
      overrides: {
        "@gisx-icon/core": `file:${tarballs["@gisx-icon/core"]}`,
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
  `import { GisxIcon, createMascot, DEFAULT_TUNING } from "gisx-icon";
import type { GisxIconPaneState, MascotPose, MascotTuning } from "gisx-icon";
import { createMascot as fromCore } from "@gisx-icon/core";

const state: GisxIconPaneState = { Exited: { code: 0 } };
const tuning: MascotTuning = { ...DEFAULT_TUNING, restlessness: 1.5 };
const mascot = createMascot({ intents: [{ x: 1, y: 1, hold: 1 }], seed: 1, tuning });
mascot.advance(1 / 60);
const pose: MascotPose = mascot.pose();

export const App = () => <GisxIcon seed={2} state={state} tuning={tuning} />;
export const headless = [pose.x, typeof fromCore] as const;
`,
);

run(["bun", "install"], join(scratch, "app"));
check(true, "both tarballs install into a scratch project");

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

/* The bug that shipped in 0.2.0: the eye's two fills reached for the host
 * application's theme tokens with no fallback, so a consumer that did not
 * define them got an invalid `fill` on both circles — black on black, no
 * visible pupil. */
const css = readFileSync(join(scratch, "app/node_modules/gisx-icon/dist/gisx-icon.css"), "utf8");
for (const [property, pattern] of [
  ["the shell fill", /--gisx-eye-color:\s*var\(--text,\s*#[0-9a-f]{3,8}\)/i],
  ["the pupil fill", /--gisx-pupil-color:\s*var\(--window-bg,\s*#[0-9a-f]{3,8}\)/i],
] as const) {
  check(pattern.test(css), `${property} falls back to a literal for an off-brand consumer`);
}
check(/data-state="Idle"\]\s*\{[^}]*--gisx-state/.test(css), "the Idle state marker survives as a declaration");

/* Export parity with 0.2.0. Adding is fine; losing one is a breaking change
 * for a package whose whole promise here is that the split is invisible. */
const V020_EXPORTS = [
  "ATTENTIVE_GAZE_INTENTS",
  "DEFAULT_GAZE_INTENTS",
  "GisxIcon",
] as const;
const bindingDts = readFileSync(
  join(scratch, "app/node_modules/gisx-icon/dist/index.d.ts"),
  "utf8",
);
for (const name of V020_EXPORTS) {
  check(bindingDts.includes(name), `gisx-icon still exports ${name} as it did in 0.2.0`);
}
for (const name of ["GazeIntent", "GisxIconConfig", "GisxIconPaneState", "GisxIconState"]) {
  check(bindingDts.includes(name), `gisx-icon still exports the type ${name}`);
}

console.log(`\nscratch consumer: ${scratch}`);
if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nthe published artifacts are what a consumer needs.");
