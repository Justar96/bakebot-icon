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

Physics is the mascot's. Direct it; don't fork it.

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
