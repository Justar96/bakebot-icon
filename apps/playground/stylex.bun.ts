import { renameSync } from "node:fs";
import type { BunPlugin, PluginBuilder } from "bun";
import { createStylexBunPlugin } from "@stylexjs/unplugin/bun";

import { cssLayerOrder, linkedStylexCss, stylexOptions } from "./stylex.config";

const RULES_CSS = new URL("./dist/.stylex.rules.css", import.meta.url);

/**
 * StyleX's Bun adapter, with one Bun lifecycle compatibility shim.
 *
 * The stock adapter clears its rule map in `onStart`. Bun's dev server only
 * re-runs `onLoad` for changed modules during HMR, and an HTML `Bun.build()`
 * can trigger more than one start phase. Clearing there can therefore leave
 * the stylesheet with only the last phase's rules. Withholding `onStart`
 * keeps the per-file rule map intact; a transformed file replaces its own
 * entry rather than accumulating duplicates.
 *
 * The adapter also writes its scratch file from inside `onLoad`, and Bun runs
 * `onLoad` in parallel. Those writes overlap: the adapter marks the CSS as
 * written before the write resolves, so a later, fuller string can land on
 * disk before an earlier, shorter one, and the final write at `onEnd` is then
 * skipped as a duplicate — leaving a stylesheet missing most of its rules.
 * Serialising the loads removes the overlap; the scratch file then only ever
 * grows, and its last state is the complete one.
 *
 * Copying that scratch file into the linked stylesheet by rename means Bun
 * never serves a partially-written CSS asset, and the copy is where the
 * cascade order is prepended: the adapter writes only its own layers, which
 * would let a reset declared in another sheet outrank them.
 */
export function createStylexPlugin({ dev = true }: { dev?: boolean } = {}): BunPlugin {
  const inner = createStylexBunPlugin({
    ...stylexOptions,
    dev,
    bunDevCssOutput: Bun.fileURLToPath(RULES_CSS),
  });

  let lastWritten: string | null = null;
  const publishCss = async () => {
    const rules = Bun.file(RULES_CSS);
    if (!(await rules.exists())) return;
    const next = `${cssLayerOrder}${await rules.text()}`;
    if (next === lastWritten) return;
    lastWritten = next;

    const temp = new URL(`${linkedStylexCss.pathname}.tmp`, "file:");
    await Bun.write(temp, next);
    renameSync(Bun.fileURLToPath(temp), Bun.fileURLToPath(linkedStylexCss));
  };

  return {
    name: inner.name,
    setup(build) {
      const wrapped: PluginBuilder = Object.create(build);
      wrapped.onStart = () => wrapped;
      let queue: Promise<unknown> = Promise.resolve();
      wrapped.onLoad = (constraints, callback) =>
        build.onLoad(constraints, (args) => {
          const load = queue.then(async () => {
            const result = await callback(args);
            await publishCss();
            return result;
          });
          queue = load.catch(() => {});
          return load;
        });
      wrapped.onEnd = (callback) =>
        build.onEnd(async (result) => {
          await callback(result);
          await publishCss();
        });
      return inner.setup(wrapped);
    },
  };
}

export default createStylexPlugin();
