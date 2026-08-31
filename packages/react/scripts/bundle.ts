export {};

const [entrypoint, outdir] = process.argv.slice(2);
if (!entrypoint || !outdir) {
  console.error("usage: bun scripts/bundle.ts <entrypoint> <outdir>");
  process.exit(1);
}

const result = await Bun.build({
  entrypoints: [entrypoint],
  outdir,
  format: "esm",
  target: "browser",
  /* Named rather than `packages: "external"`, which externalises *any* bare
   * import — a typo would then ship as a broken runtime import instead of
   * failing this build. */
  external: ["react", "react-dom", "react/jsx-runtime", "@bakebot/*"],
  /* Without this Bun emits `react/jsx-dev-runtime`, whose every call carries
   * validation meant for development. Setting `NODE_ENV` in the environment
   * does *not* reach the JSX transform — only this does. */
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  banner: '"use client";',
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
