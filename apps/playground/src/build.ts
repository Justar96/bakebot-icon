import { createStylexPlugin, LINKED_CSS } from "../stylex.bun";

/**
 * A static build of the playground, for hosting it.
 *
 * The same Bun adapter the dev server uses compiles StyleX here, in production
 * mode. StyleX's documented `stylex.esbuild()` route does not work under
 * `Bun.build`: it reads `build.initialOptions` and `result.metafile`, which
 * Bun's plugin API does not provide, and returns without writing CSS. The Bun
 * adapter instead writes the collected CSS to a file, which is appended to the
 * stylesheet Bun emitted once the bundle is complete.
 */

// `index.html` links this file. Blank it so a stale dev compile is not bundled
// alongside the real one appended below.
await Bun.write(LINKED_CSS, ":root { --stylex-injection: 0; }\n");

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
await Bun.write(
  stylesheet.path,
  `${await stylesheet.text()}\n${await Bun.file(LINKED_CSS).text()}`,
);

console.log(`built ${result.outputs.length} files → dist/site`);
