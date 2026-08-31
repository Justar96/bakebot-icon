import index from "../index.html";
import { emptyStylexCss, linkedStylexCss } from "../stylex.config";

/**
 * The playground server.
 *
 * Bun's fullstack server bundles the HTML's own `<script>` and `<link>` tags,
 * so there is no build tool and no dependency beyond what the packages already
 * need. React Fast Refresh needs no configuration — Bun applies the transform
 * and bundles the runtime itself. StyleX is compiled by the plugin named in
 * `bunfig.toml`, which writes its CSS to the dev stylesheet the HTML links.
 */

// The plugin creates the stylesheet on the first bundle, but the HTML import
// above resolves its `<link>` before that. Seed an empty one so a cold start
// does not fail on a missing asset.
const devCss = Bun.file(linkedStylexCss);
if (!(await devCss.exists())) await Bun.write(devCss, emptyStylexCss);

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3141),
  routes: { "/": index },
  /* Spelled out rather than `development: true`, which enables HMR but leaves
   * `console` off — browser logs would not reach this terminal. */
  development: { hmr: true, console: true },
});

console.log(`gisx mascot tuning → ${server.url}`);
