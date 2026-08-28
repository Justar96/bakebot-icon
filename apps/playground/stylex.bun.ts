import { renameSync } from "node:fs";
import type { BunPlugin, PluginBuilder } from "bun";
import { createStylexBunPlugin } from "@stylexjs/unplugin/bun";

/**
 * The StyleX compiler for Bun, wrapped for two things the stock adapter gets
 * wrong here. `bunfig.toml` names this file for the dev server; `src/build.ts`
 * uses the same factory for the static build.
 *
 * 1. No reset between builds. The adapter clears its collected rules in
 *    `onStart`. That suits a bundler that re-transforms every module per
 *    build, but Bun's dev server only re-runs `onLoad` for changed files, and
 *    `Bun.build` with an HTML entrypoint starts more than once — so the
 *    stylesheet ends up holding one file's rules. Withholding `onStart` keeps
 *    the map growing; rules are keyed by file, so an edit replaces its own.
 *
 * 2. Layer order. StyleX emits `@layer priority1…5`; `playground.css` keeps
 *    its reset in `@layer reset`. Whichever stylesheet the bundler happens to
 *    emit first would decide which wins, so the order is declared once, at the
 *    top of the stylesheet the HTML links.
 *
 * The adapter writes its rules to a scratch file nothing links. The linked
 * stylesheet is composed from that and swapped in by rename, so Bun — which
 * watches it — never reads a half-written file.
 */

const LAYER_ORDER = "@layer reset, priority1, priority2, priority3, priority4, priority5;\n";

export const LINKED_CSS = new URL("./dist/stylex.dev.css", import.meta.url);
const RULES_CSS = new URL("./dist/.stylex.rules.css", import.meta.url);

export function createStylexPlugin(options: { dev: boolean } = { dev: true }): BunPlugin {
  const inner = createStylexBunPlugin({
    useCSSLayers: true,
    ...options,
    bunDevCssOutput: Bun.fileURLToPath(RULES_CSS),
  });

  let lastWritten: string | null = null;
  const compose = async () => {
    const rules = Bun.file(RULES_CSS);
    if (!(await rules.exists())) return;
    const next = LAYER_ORDER + (await rules.text());
    if (next === lastWritten) return;
    lastWritten = next;
    const temp = new URL(`${LINKED_CSS.pathname}.tmp`, "file:");
    await Bun.write(temp, next);
    renameSync(Bun.fileURLToPath(temp), Bun.fileURLToPath(LINKED_CSS));
  };

  return {
    name: inner.name,
    setup(build) {
      const wrapped: PluginBuilder = Object.create(build);
      wrapped.onStart = () => wrapped;
      wrapped.onLoad = (constraints, callback) =>
        build.onLoad(constraints, async (args) => {
          const result = await callback(args);
          await compose();
          return result;
        });
      wrapped.onEnd = (callback) =>
        build.onEnd(async (result) => {
          await callback(result);
          await compose();
        });
      return inner.setup(wrapped);
    },
  };
}

export default createStylexPlugin({ dev: true });
