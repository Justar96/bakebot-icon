import type { UserOptions } from "@stylexjs/unplugin";

/**
 * One StyleX compiler contract shared by development and production.
 *
 * `enableMediaQueryOrder` is off, and it is off because it does not survive
 * being run twice. On its default of `true` the compiler routes every style
 * object through `lastMediaQueryWinsTransform`, which rewrites overlapping
 * queries so the later one wins by negating the earlier — and the media-query
 * parser it does that with keeps state between calls. The first file to be
 * compiled in a process is fine; the second time any file is compiled, every
 * `@media` key in it fails to parse and the whole file dies as `Invalid media
 * query syntax`, a message that names no query because the real parse error is
 * swallowed on the way out (@stylexjs/babel-plugin 0.19.0).
 *
 * A file is compiled twice all the time here. Bun starts more than one plugin
 * phase for an HTML entrypoint — the shim in `stylex.bun.ts` exists for that
 * already — and HMR recompiles a file on every save, so the flag would break
 * the dev server on the first edit even if the build only ever ran once.
 *
 * Nothing is lost by turning it off. The transform only has something to say
 * when one property carries two overlapping queries, and no property in this
 * app carries two: `COMPACT`, `MOBILE`, `REDUCED` and `HOVER` are each spelled
 * alone, against a `default`. Should that ever change, the ordering would have
 * to be spelled by hand — narrower query last — rather than by turning this
 * back on.
 */
export const stylexOptions = {
  importSources: ["@stylexjs/stylex"],
  useCSSLayers: true,
  enableMediaQueryOrder: false,
  unstable_moduleResolution: {
    type: "commonJS",
    rootDir: Bun.fileURLToPath(new URL(".", import.meta.url)),
  },
} satisfies Partial<UserOptions>;

/**
 * The cascade order, declared by every stylesheet that takes part in it.
 *
 * A layer is positioned by whichever sheet names it first, and a name that has
 * not been declared is appended above everything already registered. So a
 * reset that only declares itself is a reset that outranks StyleX whenever the
 * generated sheet happens to load first — `button { border: 0 }` then beats
 * every rule StyleX wrote. Both sheets carry the full order instead, which
 * makes the result the same whichever one the browser reaches first.
 *
 * `playground.css` opens with this exact line. It cannot import a constant, so
 * the two copies are kept in step by hand; the guard in `src/build.ts` fails
 * the build if the generated sheet ever loses its copy.
 */
export const cssLayerOrder =
  "@layer reset, priority1, priority2, priority3, priority4, priority5;\n";

export const emptyStylexCss = `${cssLayerOrder}:root { --stylex-injection: 0; }\n`;
export const linkedStylexCss = new URL("./dist/stylex.dev.css", import.meta.url);
