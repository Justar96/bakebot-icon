/*
 * The entrypoint is a star export over a curated barrel, which looks like
 * pointless indirection and is not.
 *
 * This package declares `sideEffects: false`, which is true of it and is what
 * lets a consumer's bundler drop the parts of the simulation they never touch.
 * Bun 1.4.0-canary.1 applies that hint to the package it is *building*, and
 * when the entrypoint consists of named re-exports (`export { x } from "./y"`)
 * it prunes the entire module graph: the bundle comes out as a list of exported
 * names with nothing defining them. It fails silently — the build succeeds and
 * the broken artifact is what gets published.
 *
 * A star export is not pruned, so the curated surface lives one module down in
 * `public.ts` and this re-exports it wholesale. `scripts/build.ts` asserts the
 * bundle actually contains its implementation, so if this workaround stops
 * being necessary — or stops working — the build says so rather than shipping.
 */

export * from "./public";
