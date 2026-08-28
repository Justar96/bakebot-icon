# The playground's stack: Bun + React, styled by StyleX

Research notes behind `apps/playground`, August 2026.

## The question

Make the playground a design-system surface with StyleX as the system, and
pick the best two-part stack to host it.

## The answer

**Bun is the runtime, bundler, and dev server; React 19 is the UI; StyleX
0.19 compiles inside Bun through `@stylexjs/unplugin`.** No Vite, no Next, no
Babel config. The repo already ran the playground on `Bun.serve` with HTML
imports, and StyleX's official plugin grew a Bun adapter, so the two halves
meet without a third tool between them.

| Layer | Choice | Why |
| --- | --- | --- |
| Styling | `@stylexjs/stylex` 0.19.0 | Compile-time atomic CSS; `defineVars`/`createTheme` give real tokens and themes as classes; type-safe. |
| Compiler | `@stylexjs/unplugin` 0.19.0 | Official. One package with adapters for Vite, Rollup, esbuild, webpack, Rspack, Rolldown, Farm — and Bun. |
| Dev | `Bun.serve` + `[serve.static] plugins` | Bun runs the plugin over every module it bundles for `index.html`; CSS lands in `dist/stylex.dev.css`, which the HTML links, and hot-reloads. |
| Prod | `Bun.build` + `stylex.esbuild()` | Bun's bundler speaks esbuild's plugin API. `metafile: true` lets the plugin find the emitted stylesheet and append to it. |
| UI | React 19 | The mascot's published binding is React; the playground exercises its real props. |

## What was weighed

- **Vite + React** — the documented default (`stylex.vite()` before
  `@vitejs/plugin-react` to keep Fast Refresh). Fine, but a second bundler
  and dev server next to Bun's, for no gain here.
- **Next.js** — needs the PostCSS plugin or a Babel config; brings a server
  framework the playground has no use for.
- **`@stylexswc/unplugin`** (Rust/SWC, unofficial) — 5–10× faster
  per-file transforms. Not needed at this size; the official plugin keeps
  one vendor.
- **A second UI framework (Solid, Preact) sharing the tokens** — StyleX is
  framework-agnostic and the tokens would carry over unchanged, but Solid
  support is still a work-in-progress discussion upstream and there is no
  Solid binding for the mascot. Not added; the tokens are ready if one is.

## What the compiler produces

Tokens compile to hashed custom properties on `:root`; a theme compiles to a
double-specificity class that overrides the same properties:

```css
@layer priority1 {
  :root, .x1u1i9hg { --x1b3dmzi: #fbfbfa; … }
  .xr4k93o.xr4k93o { --x1b3dmzi: #0e0f12; … }   /* dark */
}
```

Rules from `stylex.create` land in `priority2…5` by specificity class, so
ordering is by layer rather than source order.

## The one thing that needed a wrapper

`@stylexjs/unplugin/bun` clears its collected rules in `onStart`. Bun's dev
server only re-runs `onLoad` for files that changed, so after the first HMR
rebuild the stylesheet held only the edited file's rules. `stylex.bun.ts`
wraps the adapter and withholds `onStart`; rules are keyed by file, so an edit
replaces rather than duplicates. This is likely worth an upstream issue.

## Design references

- Emil Kowalski, *You don't need animations* — animate only with a purpose,
  stay under 300ms, never on something used hundreds of times a day, respect
  reduced motion. Encoded in `tokens.stylex.ts` (`motion`) and in which
  primitives get a transition (theme swap: yes; sliders, swatches, nav: no).
- interior.dev docs — light ground, sidebar of sections, one prose column,
  each idea shown as a framed live preview with a caption bar and a replay.

## Sources

- https://stylexjs.com/docs/learn/installation/bun
- https://stylexjs.com/docs/learn/installation/vite/vite-react
- https://stylexjs.com/docs/api/configuration/unplugin
- https://www.npmjs.com/package/@stylexjs/unplugin
- https://www.npmjs.com/package/@stylexswc/unplugin
- https://github.com/solidjs/solid/discussions/2506
- https://engineering.fb.com/2025/11/11/web/stylex-a-styling-library-for-css-at-scale/
- https://emilkowal.ski/ui/you-dont-need-animations
- https://www.interior.dev/docs
