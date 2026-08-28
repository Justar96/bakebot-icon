# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install
bun test                                    # every package; no test config anywhere
bun test packages/core/tests/mascot.test.ts # one file
bun test -t "clamps"                        # one test by name
bun run typecheck                           # all workspaces
bun run build                               # core, then the binding — order matters
bun run play                                # playground on :3141
bun run verify:tarballs                     # the artifact gate; see below
```

Bun is pinned to **1.4.0** in CI. `bun run --filter '<pkg>' <script>` targets one workspace.

## Layout

| Path | Package | What it is |
| --- | --- | --- |
| `packages/core` | `@gisx-icon/core` | The character: springs, collision, the eye, the mascot driver, tuning. No dependencies, no DOM. |
| `packages/react` | `gisx-icon` | The React binding: component, stylesheet, the hook that writes a pose to transforms. |
| `apps/playground` | — | Not published. Every state side by side, a slider per dial. |

**Read [`CONTEXT.md`](./CONTEXT.md) before naming anything.** It is the domain vocabulary and it lists the words to *avoid* for each concept (the eye is not a "ball", a pane state is not a "mood"). Naming here is deliberate.

## Architecture

**The seam is the point.** The mascot simulation is a separate package from any renderer so that tuning can be a supported surface: `packages/core/src/public.ts` exports deliberately less than the package contains. The integrator, the signed distance field, and the eye's step function stay private, which is what makes retuning them a non-breaking change. Don't widen that surface casually.

**`createMascot` is the driver; `pose()` is the readout.** Core owns a fixed 1/240 s timestep with an accumulator and interpolates poses on read, so callers may advance at any frame rate. `useEyeMotion.ts` is a thin DOM adapter over it — one mascot per mount, held in a ref. Renderer geometry (lid constants, transform writes) lives in react; nothing physical does.

**Springs are parametrized by frequency (Hz) and damping ratio, not stiffness/damping.** That is what allows independent clamping: the frequency ceiling keeps ω·h ≈ 0.16 against the integrator's stability bound of ~2. Consequence — no caller-supplied tuning, including non-finite values or garbage from plain JS, can destabilise the simulation or put a non-finite value on screen. Non-finite falls back to the default; merely out-of-range is clamped. Preserve that property.

**Instances desync via seed *and* clock-phase offset.** A per-instance seed alone is not enough, because drift and tremor are functions of the clock rather than of the PRNG stream. `setIntents` swaps the intent table without resetting springs, so a state change is something the mascot lives through rather than a rebuild.

## Traps

All load-bearing workarounds. Each has a comment at its site; don't "simplify" them away.

- **`packages/core/src/index.ts` is a single `export * from "./public"`.** With `sideEffects: false`, Bun prunes the entire module graph when the entrypoint is named re-exports — a *successful* build emitting export names with nothing behind them. A star export is not pruned. Both build scripts assert real symbols are present.
- **Dual `paths` resolution.** `tsconfig.json` points at core's **source** so tests and typechecks need no build first; `tsconfig.build.json` points at core's **`dist`** — required, since source sits outside `rootDir` (TS6059), and it checks the published types against the published types.
- **The stylesheet is copied byte-exact, not bundled.** Bun's CSS transformer discards rules carrying no declarations (hence `--gisx-state: idle` in the Idle marker) and has open `:where()`/colour bugs.
- **`define: { "process.env.NODE_ENV": ... }` in react's build.** Setting the env var does *not* reach the JSX transform; without the define, the dev JSX runtime ships.
- **The eye's fills must keep literal fallbacks.** `--gisx-eye-color`/`--gisx-pupil-color` chain to the host's `--text`/`--window-bg`; with no fallback, an app that never defines them renders a black disc with an invisible pupil. This shipped in 0.2.0.

## Publishing

Push a `v*` tag; it must match both package versions. Bun packs and npm publishes, and the split is forced: npm does not rewrite `workspace:`/`catalog:`, and `bun publish` has no `--provenance`. Because npm skips lifecycle scripts when handed a tarball path, every gate is an explicit step in `.github/workflows/publish.yml` — a `prepublishOnly` would silently not run. Core publishes before its dependent.

`bun run verify:tarballs` is the gate that matters. Every other check tests the workspace, where core resolves to source; this packs both packages, installs the tarballs into a scratch project outside the workspace, and checks what a consumer actually receives — no unrewritten protocols, the pin matching, a consumer typechecking against the published `.d.ts` on TypeScript 5 while the repo builds on 7, the CSS fallbacks intact, and 0.2.0's exports still present.
