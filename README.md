# gisx-icon

The gisx mascot. A rounded tile and one eye that moves because it is a physical simulation, not because a clip is playing.

```ts
import { GisxIcon } from "gisx-icon";

<GisxIcon state={entry.attention.state} size={32} />
```

Pass the pane state whole, payload included. The mascot names itself, ships its own styles, and stays alive in every state except Exited.

Domain language lives in [`CONTEXT.md`](./CONTEXT.md).

## Motion

The eye is a mass on springs, confined to the tile. Stretch, splat, corner pooling, blinks, and flinches fall out of that simulation. A caller replaces where it looks; they do not sequence the motion. `prefers-reduced-motion: reduce` stops the simulation.

Idle wanders — some looks sit inside the tile, some sit past the border, so a corner press is an event. Every other living state attends: short looks, shell at the centre, so the state's pose is what moves it and the pupil is what stays alive.

## Customize

```ts
import { ATTENTIVE_GAZE_INTENTS, GisxIcon } from "gisx-icon";

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
| `gazeIntents` | Places to look while alive. A point past the tile is how the eye presses a wall. Exited stays shut. |
| `tuning` | Dials on the motion. Every dial is optional and clamped; see below. |
| `seed` | Fixes this mascot's run. Omit it — each mascot already differs from its neighbours. |

Two colours are worth knowing about. `config.color` is the tile. The eye's own two fills come from `--gisx-eye-color` and `--gisx-pupil-color`, which chain to the host application's `--text` and `--window-bg` if it defines them and otherwise fall back to a legible pair — so the mascot is visible in an app that has never heard of those tokens.

### Tuning

```ts
<GisxIcon
  state={entry.attention.state}
  tuning={{ restlessness: 1.4, squish: 0.6, blinkInterval: 4 }}
/>
```

| Dial | What it does |
| --- | --- |
| `gaze`, `pupil`, `jellyFree`, `jellyContact` | `{ frequency, damping }` — hertz and damping ratio. Ratio below 1 overshoots and rings; 1 arrives clean; above 1 crawls. |
| `squish` | Scales every deformation drive. `0` is a rigid eye, `1` is default. |
| `restlessness` | Scales drift and tremor. `0` is a still eye, which reads as a frozen one. |
| `blinkInterval`, `blinkSpread` | Mean seconds between blinks, and the random spread above it. |
| `shellDeadzone` | How far a look must reach before the shell follows the pupil. |

A spring is named by frequency and damping ratio rather than stiffness and damping because those two can be clamped independently: the frequency ceiling keeps the product of angular frequency and the 1/240 s step around 0.16, roughly a twelvefold margin on the stability bound of the integrator. So no tuning a caller can express — including a non-finite one, or garbage from a plain-JavaScript caller — can destabilise the simulation or put a non-finite value on screen. Anything non-finite takes the default; anything merely out of range is clamped.

Physics is still the mascot's: tuning moves dials inside a region that is known to be stable. Direct it; don't fork it.

### Headless

The character does not need React. `createMascot` is the same simulation with no renderer attached — call `advance` with elapsed seconds and write what `pose` returns.

```ts
import { createMascot, DEFAULT_GAZE_INTENTS } from "gisx-icon";

const mascot = createMascot({ intents: DEFAULT_GAZE_INTENTS, seed: 7 });
mascot.advance(1 / 60);
const { x, y, angle, stretch, squash, lid, dilation } = mascot.pose();
```

`setIntents` changes where the eye looks without resetting the world, so a change of state is something the mascot lives through rather than something it is rebuilt by.

## Install

```bash
bun add gisx-icon
```

Peer dependency: `react` ^19.

## Develop

```bash
bun install
bun test
bun run typecheck
bun run build
```

Publish is `npm publish` from a clean build, or pushing a `v*` tag once `NPM_TOKEN` is set on the repo.
