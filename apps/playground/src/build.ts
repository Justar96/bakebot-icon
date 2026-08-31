import { rmSync } from "node:fs";

import { createStylexPlugin } from "../stylex.bun";
import { cssLayerOrder, emptyStylexCss, linkedStylexCss } from "../stylex.config";

/**
 * Static playground build.
 *
 * The official StyleX Bun adapter is used in production mode. The small
 * lifecycle shim in `stylex.bun.ts` is shared with development because Bun can
 * start more than one plugin phase for an HTML entrypoint; keeping the
 * collected per-file rules across those phases prevents partial extraction.
 */

// `index.html` links the development stylesheet. Blank it so stale dev rules
// are not bundled, then append the freshly extracted production rules below.
await Bun.write(linkedStylexCss, emptyStylexCss);
rmSync("./dist/site", { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "./dist/site",
  target: "browser",
  minify: true,
  plugins: [createStylexPlugin({ dev: false })],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const stylesheet = result.outputs.find((output) => output.path.endsWith(".css"));
if (!stylesheet) {
  console.error("no stylesheet emitted; nothing to append the StyleX rules to");
  process.exit(1);
}

const extractedStylexCss = await Bun.file(linkedStylexCss).text();
if (!extractedStylexCss.includes("@layer priority")) {
  console.error("StyleX emitted no atomic rules; refusing to publish an unstyled playground");
  process.exit(1);
}
/* Atomic rules alone are not a stylesheet: nearly all of them read a token
 * through `var()`, and the declarations those names resolve against are only
 * written when the compiler visits `tokens.stylex.ts`. Without this line the
 * build ships rules whose every value is empty. */
if (!extractedStylexCss.includes(":root, .")) {
  console.error("StyleX emitted no token declarations; is `tokens.stylex.ts` still in the graph?");
  process.exit(1);
}
/* Without the order statement in front of them, StyleX's layers are registered
 * before the reset names itself, which puts the reset on top and strips the
 * borders off every control. */
if (!extractedStylexCss.startsWith(cssLayerOrder)) {
  console.error("StyleX CSS is missing the cascade order; the reset would outrank it");
  process.exit(1);
}

await Bun.write(stylesheet.path, `${await stylesheet.text()}\n${extractedStylexCss}`);

console.log(`built ${result.outputs.length} files → dist/site`);
