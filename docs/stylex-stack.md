# The playground's stack: Bun + React, styled by StyleX

Research notes behind `apps/playground`, August 2026.

## The question

Make the playground a design-system surface with StyleX as the system, and
pick the best two-part stack to host it.

## The answer

**Bun is the runtime, bundler, and dev server; React 19 is the UI; StyleX
0.19 compiles inside Bun through `@stylexjs/unplugin`.** No Vite, no Next, no
project-owned Babel config. Development and production use the official Bun
adapter with one lifecycle shim; both read the same compiler options from
`stylex.config.ts`.

| Layer | Choice | Why |
| --- | --- | --- |
| Styling | `@stylexjs/stylex` 0.19.0 | Compile-time atomic CSS; `defineVars`/`createTheme` give real tokens and themes as classes; type-safe. |
| Compiler | `@stylexjs/unplugin` 0.19.0 | Official. One package with adapters for Vite, Rollup, esbuild, webpack, Rspack, Rolldown, Farm — and Bun. |
| Dev | `Bun.serve` + `@stylexjs/unplugin/bun` | Bun runs the plugin over every module it bundles for `index.html`; CSS lands in `dist/stylex.dev.css`, which the HTML links and hot-reloads. |
| Prod | `Bun.build` + `@stylexjs/unplugin/bun` | The documented `stylex.esbuild()` route transforms modules under Bun 1.4 but does not expose the collected CSS to its `onEnd` hook. The Bun adapter writes the rules reliably; `build.ts` appends them to Bun's emitted stylesheet. |
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
ordering is by layer rather than source order. `playground.css` declares
`reset, priority1…5` before either stylesheet contributes rules. The reset
therefore stays below StyleX in dev and production without relying on asset
completion order.

## Authoring rules followed here

The implementation follows StyleX's "Thinking in StyleX" and LLM authoring
guides rather than treating StyleX as a class-name generator:

- Themeable colors are typed `defineVars`; `createTheme` overrides them on the
  playground root and descendants inherit them.
- The shared scales remain named `defineVars` exports in the required
  `*.stylex.ts` module. `defineConsts` was evaluated from the current docs, but
  the installed 0.19 Bun transform emits imported media-query constants as
  `var(...)` selectors; keeping the working representation avoids invalid CSS
  until that compiler path is fixed.
- Conditional styles are merged through `stylex.props`, with later styles
  intentionally winning.
- Runtime-only values use StyleX dynamic styles. Inline styles remain only for
  measured animation state whose transition duration is itself a component
  prop.
- The compiler is given the exact `importSources` list and CommonJS module
  resolution required by `defineVars`/`createTheme`.

## The one thing that still needs a wrapper

`@stylexjs/unplugin/bun` clears its collected rules in `onStart`. Bun's dev
server only re-runs `onLoad` for files that changed, and an HTML `Bun.build()`
can start more than one plugin phase. The stylesheet can otherwise contain
only the edited module or final phase. `stylex.bun.ts` withholds `onStart`;
rules are keyed by file, so an edit replaces rather than duplicates.

StyleX documents `stylex.esbuild()` for Bun production builds. It was tested
here first. With Bun 1.4 the JavaScript is transformed, but the adapter's
`onEnd` hook receives no usable collected CSS/metafile combination, so no
StyleX rules reach the output. The Bun adapter workaround is intentionally
narrow and can be removed when that documented path works end to end.

## Design references

- Emil Kowalski, *You don't need animations* — animate only with a purpose,
  stay under 300ms, never on something used hundreds of times a day, respect
  reduced motion. Encoded in `tokens.stylex.ts` (`motion`) and in which
  primitives get a transition (theme swap: yes; sliders, swatches, nav: no).
- interior.dev docs — light ground, sidebar of sections, one prose column,
  each idea shown as a framed live preview with a caption bar and a replay.

## Sources

- https://stylexjs.com/docs/learn/thinking-in-stylex
- https://stylexjs.com/docs/llm-resources
- https://stylexjs.com/docs/learn/installation/bun
- https://stylexjs.com/docs/learn/installation/vite/vite-react
- https://stylexjs.com/docs/api/configuration/unplugin
- https://stylexjs.com/docs/learn/theming/variable-types
- https://www.npmjs.com/package/@stylexjs/unplugin
- https://www.npmjs.com/package/@stylexswc/unplugin
- https://github.com/solidjs/solid/discussions/2506
- https://engineering.fb.com/2025/11/11/web/stylex-a-styling-library-for-css-at-scale/
- https://emilkowal.ski/ui/you-dont-need-animations
- https://www.interior.dev/docs
