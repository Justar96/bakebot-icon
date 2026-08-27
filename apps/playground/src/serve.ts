import index from "../index.html";

/**
 * The playground server.
 *
 * Bun's fullstack server bundles the HTML's own `<script>` and `<link>` tags,
 * so there is no build tool and no dependency beyond what the packages already
 * need. React Fast Refresh needs no configuration — Bun applies the transform
 * and bundles the runtime itself.
 */
const server = Bun.serve({
  port: Number(process.env.PORT ?? 3141),
  routes: { "/": index },
  /* Spelled out rather than `development: true`, which enables HMR but leaves
   * `console` off — browser logs would not reach this terminal. */
  development: { hmr: true, console: true },
});

console.log(`gisx mascot tuning → ${server.url}`);
