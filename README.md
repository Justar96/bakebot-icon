# gisx-icon

The gisx mascot. A tile and two eyes that move because they are a physical simulation, not because a clip is playing.

```ts
import { GisxIcon } from "@bakebot/react";

<GisxIcon state={entry.attention.state} size={32} />
```

Pass the pane state whole, payload included. The mascot names itself, ships its own styles, and stays alive in every state except Exited.

Domain language lives in [`CONTEXT.md`](./CONTEXT.md).

## Motion

The eye is a mass on springs, confined to the tile. Stretch, drift, blinks, and which way the face is turned fall out of that simulation. A caller replaces where it looks; they do not sequence the motion. `prefers-reduced-motion: reduce` stops the simulation, unless the caller asks for `settle` instead — see below.

The boundary is a limit, not a wall. Nothing rebounds off it and nothing splats against it, because the eye reaching it does not mean it hit something — it means the face has turned as far that way as it turns. So `pose.yaw` and `pose.pitch` are read straight off how far the eye has travelled, and "the eye is at the edge" and "the face is looking that way" are one fact rather than two that have to be kept in agreement. A gaze past that limit is projected onto it before the spring moves: past the border, extra distance says direction rather than force, so `{ x: 240 }` does not slam the same full turn harder than `{ x: 60 }`.

The eye is also allowed *past* the tile's border — six units of it — and the tile clips what hangs over. An eye that stopped with its rim exactly on the border is always whole and always fully visible, which is what makes it read as a ball resting inside a box. A real eye at the far end of its travel goes round the side of the head and part of it stops being there. So a renderer clips the eye to the tile it drew; the character supplies both from the same numbers.

Idle wanders — some looks sit inside the tile, some sit past the border, so a full turn is an event. Every other living state attends: short looks that stay well inside the tile, so the state's pose is what carries the face and the glance is what keeps it alive.

## Customize

```ts
import { ATTENTIVE_GAZE_INTENTS, GisxIcon } from "@bakebot/react";

<GisxIcon
  state={entry.attention.state}
  size={32}
  label="gisx is working"
  config={{ color: "#5f8cff" }}
  gazeIntents={ATTENTIVE_GAZE_INTENTS}
/>
```

| Prop | What it is |
| --- | --- |
| `state` | Pane state, payload included. Default `Idle`. |
| `size` | CSS pixels. Default `32`. |
| `label` | Accessible name. Omit it and the mascot is decorative. |
| `config.color` | Any CSS colour. Omit it for gisx gray. |
| `gazeIntents` | Places to look while alive. A point past the tile is how the face turns all the way that way. Exited stays shut. |
| `tuning` | Dials on the motion. Every dial is optional and clamped; see below. |
| `seed` | Fixes this mascot's run. Omit it — each mascot already differs from its neighbours. |
| `reducedMotion` | What `prefers-reduced-motion: reduce` does. `freeze` (default) or `settle`. |
| `shape` | The tile to live in. A name from `MASCOT_SHAPES` or a `TileSpec` of your own. Default `circle`. |

Two colours are worth knowing about. `config.color` is the tile. The eyes are filled from `--gisx-eye-color`, which chains to the host application's `--window-bg` if it defines one and otherwise falls back to a literal — so they read as two holes in the tile, and stay visible in an app that has never heard of that token.

### Shape

The tile is a rounded rectangle: two half extents and a corner radius. Six of them are named, and `shape` takes a name or a spec of your own.

```tsx
<GisxIcon shape="squircle" />
<GisxIcon shape={{ halfY: 24, radius: 12 }} />
```

| Name | The tile |
| --- | --- |
| `square` | Hard corners. The eye reaches furthest on the diagonal. |
| `rounded` | The app-icon rounding. Still corners: a radius-8 arc is tighter than the radius-14 eye, so the eye cannot enter it. |
| `squircle` | Rounded far enough that the corners are arcs the eye fits inside. |
| `circle` | The same distance out in every direction. The default. |
| `pill` | A wide capsule — flat above and below, a semicircle at each end. |
| `card` | A landscape tile with a modest rounding. |

Nothing branches on which of them it is. The eye's travel region is that same tile inset by the eye's radius less its overshoot, so its rim hangs the same distance past the border you can see in every shape — and is cut by that border, whichever one it is. The turn is read off how far along that region the eye has got. A narrow tile is therefore not a smaller face: the pill turns as far at its border as the circle does at its own, because full travel means full turn whatever the travel happens to be.

Half extents are clamped to `[14, 30]` and the radius to the smaller half, so a spec always resolves to a tile the distance field can answer about. Changing `shape` on a live mascot reshapes the world it is already in rather than rebuilding it: the eye is not moved, and the next step slides it onto whatever border it now has.

### The pair

The mascot is two discs and nothing else — no shell, no pupil. Both are points on a sphere at ±60° from straight ahead, so a turn closes their spacing and narrows the leading one as it approaches the silhouette. The spherical midpoint is removed before drawing: `pose.x/y` remains the one centre of the pair, instead of yaw and pitch translating it a second time. Each round patch's two local axes are projected together, so combined yaw and pitch rotate and foreshorten its ellipse instead of applying two unrelated flat scales. A blink still closes each disc around its own rotated centre rather than folding the pair together. None of that is keyframed — it falls out of the sphere, which is what makes a flat two-dot face read as *turned* while keeping both marks aligned. `facingEyes(yaw, pitch)` owns that centred placement and per-disc projection, so both renderers turn the same way.

This is 3D-inspired spherical math projected orthographically into 2D. There is no rendered Z-axis, perspective camera, or depth ordering: `facingEyes` outputs only `x`, `y`, `rotation`, `scaleX`, and `scaleY` for each disc.

Those projected ellipses also have a contact constraint. If yaw and pitch would bring them too close, `facingEyes` measures each rotated ellipse along the full 2D centre-to-centre axis and separates both equally while preserving the pair's midpoint. A pitched correction therefore resolves diagonally or vertically rather than shoving the eyes sideways on X alone. The default minimum seam is four view units — two CSS pixels at the default 32px size — so the front-facing eyes remain clearly distinct. At a full side look the literal projection would take the leading disc to zero width; the shipped projection bottoms out at half width instead, and every supported tile keeps at least half of that drawn eye after clipping.

The pair is sized so the turn costs the tile nothing: each disc sits on a sphere of radius `eye − disc`, so however far it swings its far rim reaches exactly `eye` — the radius the travel region is inset by. The eyes therefore cross the border at exactly the distance the region was built for, at any turn, and every shape above is unchanged.

With no pupil to spend a short look on, the eyes do the glancing themselves. That is what the deadzone is for: a look nearer than four units is not worth moving for, and everything past it is answered by the difference rather than by the whole distance — so a glance just clear of the deadzone is a small movement rather than a jump. In an attending state that comes to about two units of travel: alive, and nowhere near a turn of the face.

### Tuning

```ts
<GisxIcon
  state={entry.attention.state}
  tuning={{ restlessness: 1.4, squish: 0.6, blinkInterval: 4 }}
/>
```

| Dial | What it does |
| --- | --- |
| `gaze`, `jellyFree`, `jellyContact` | `{ frequency, damping }` — hertz and damping ratio. Ratio below 1 overshoots and rings; 1 arrives clean; above 1 crawls. |
| `squish` | Scales every deformation drive. `0` is a rigid eye, `1` is default. |
| `restlessness` | Scales drift and tremor. `0` is a still eye, which reads as a frozen one. |
| `blinkInterval`, `blinkSpread` | Mean seconds between blinks, and the random spread above it. |
| `deadzone` | How near a look may be before the eyes do not move for it at all. |

A spring is named by frequency and damping ratio rather than stiffness and damping because those two can be clamped independently: the frequency ceiling keeps the product of angular frequency and the 1/240 s step around 0.16, roughly a twelvefold margin on the stability bound of the integrator. So no tuning a caller can express — including a non-finite one, or garbage from a plain-JavaScript caller — can destabilise the simulation or put a non-finite value on screen. Anything non-finite takes the default; anything merely out of range is clamped.

Physics is still the mascot's: tuning moves dials inside a region that is known to be stable. Direct it; don't fork it.

### Reduced motion

By default `prefers-reduced-motion: reduce` freezes the simulation: the eye eases home and holds its state pose. That is the conservative reading, and it is the only mechanism this component offers for [WCAG 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html), which wants a way to stop content that moves or blinks for more than five seconds. So it stays the default.

It is not the only defensible reading. The preference is scoped to motion that triggers vestibular discomfort, and a wandering Idle mascot and an attending one are not the same amount of motion — measured on a 32px icon over a minute, Idle travels 11px and every other state stays around one. `settle` is the middle:

```ts
<GisxIcon state={entry.attention.state} reducedMotion="settle" />
```

The eyes stay alive inside a widened deadzone. They still drift and the lids still blink, but nothing crosses the tile, turns the face, or deforms — 0.12px of travel. It is not a second physics: it is `ATTENTIVE_GAZE_INTENTS` with `SETTLED_TUNING`, both of which are exported, so a non-React binding settles the same way.

### Headless

The character does not need React. `createMascot` is the same simulation with no renderer attached — call `advance` with elapsed seconds and write what `pose` returns. It lives in `@bakebot/core`, which carries no dependencies and knows nothing about the DOM; `@bakebot/react` re-exports it, so React callers need not install it separately.

```ts
import { createMascot, DEFAULT_GAZE_INTENTS } from "@bakebot/core";

const mascot = createMascot({ intents: DEFAULT_GAZE_INTENTS, seed: 7 });
mascot.advance(1 / 60);
const { x, y, angle, stretch, squash, lid, yaw, pitch } = mascot.pose();
```

`setIntents` changes where the eye looks without resetting the world, so a change of state is something the mascot lives through rather than something it is rebuilt by.

`mascotGeometry(shape)` is what a renderer draws from: the view square, the icon centre, the tile rect — which is also the shape to clip the eyes to — the sphere the pair sits on and the radius of each disc, and how far a shut lid flattens and drops. `MASCOT_GEOMETRY` is that for the default shape. All of it is derived from the same resolver the simulation is bounded by, so a second renderer draws the tile the eye actually reaches rather than one that resembles it — in any shape. `facingEyes(yaw, pitch)` goes with it: hand it the turn from `pose()` and it answers with where each disc goes and how foreshortened it is. `apps/playground/src/canvas-mascot.ts` is a working example — a canvas binding that imports nothing but `@bakebot/core`, running beside the SVG one in the playground.

`STATE_GAZE` says whether a state is alive and where it looks; `STATE_POSE` says what shape it holds while it does — `eyeX`, `pairScaleY` and the rest, in view units and bare scale factors, each state written as a departure from `REST_POSE`. The React binding writes those onto the root as custom properties rather than carrying a rule per state, so there is one definition and a canvas binding holds the same shapes.

What stays the renderer's own is colour, and the two one-shot entrances on `NeedsAttention` and `Notified` — those are transitions rather than poses, with no resting value to put in a table.

## Install

```bash
bun add @bakebot/react
```

Peer dependency: `react` ^19. `@bakebot/core` comes along with it.

For a renderer that is not React — canvas, Solid, a terminal — take the character alone:

```bash
bun add @bakebot/core
```

## Repository

Two published packages and one app that is not published.

| Path | Package | What it is |
| --- | --- | --- |
| `packages/core` | `@bakebot/core` | The character: springs, containment, the eye, the turn, the mascot driver, the tuning surface. No dependencies, no DOM. |
| `packages/react` | `@bakebot/react` | The React binding: the component, the stylesheet, the hook that writes a pose to transforms. |
| `apps/playground` | — | Every state side by side, with a slider for every dial, and the canvas binding beside the SVG one. |

The split is the reason tuning can be a supported surface: the physics has a package boundary of its own, and what that package exports is deliberately smaller than what it contains. The integrator, the distance field, and the eye's step function stay private, which is what makes retuning them a non-breaking change.

## Develop

```bash
bun install
bun test          # every package, no test config anywhere
bun run typecheck
bun run build     # core, then the binding
bun run play      # the playground on :3141
```

Tests and typechecks resolve `@bakebot/core` to its **source** through tsconfig `paths`, so nothing needs building first. The declaration build resolves it to `dist` instead — that is the resolution a consumer performs, so the published types are checked against the published types.

```bash
bun run verify:tarballs
```

That is the gate worth knowing about. Everything else tests the workspace; this packs both packages, installs the tarballs into a scratch project outside the workspace, and checks what a consumer actually receives: no `workspace:` or `catalog:` protocol left in either manifest, the binding's pin on the character matching the version being shipped, a consumer typechecking against the published declarations, the eye's fills still falling back to literals, a turning disc still narrowing about its own centre, and every export that existed in 0.2.0 still present.

## Publish

Push a `v*` tag with `NPM_TOKEN` set on the repo. The tag has to match both package versions or the workflow stops.

Bun packs and npm publishes, which is not arbitrary. npm does not rewrite `workspace:` or `catalog:`, so publishing from source would ship an unresolvable manifest; `bun publish` has no `--provenance`, so publishing with Bun would ship unattested. `bun pm pack` into `npm publish <tarball>` is the only combination that gets both. Because npm skips lifecycle scripts when handed a tarball path, every gate is an explicit step in [`.github/workflows/publish.yml`](./.github/workflows/publish.yml) — a `prepublishOnly` there would silently not run.
