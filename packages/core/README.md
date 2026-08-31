# @bakebot/core

The bakebot mascot with no renderer attached: a deterministic spring simulation,
a gaze model, the tuning surface, the state poses, and the geometry needed to
draw any of it. No runtime dependencies, and it knows nothing about React or
the DOM.

## Install

```bash
bun add @bakebot/core
```

ES modules only; there is no CommonJS build.

## Smallest run

```ts
import { createMascot, DEFAULT_GAZE_INTENTS } from "@bakebot/core";

const mascot = createMascot({ intents: DEFAULT_GAZE_INTENTS, seed: 7 });
mascot.advance(1 / 60);

const pose = mascot.pose();
console.log(pose.x, pose.y, pose.yaw, pose.pitch);
```

Hold the instance, call `advance(elapsedSeconds)` once a frame, and draw what
`pose()` returns. `setIntents` changes where it looks without rebuilding the
world.

## What it exports

- `createMascot`, and the `Mascot`, `MascotOptions` and `MascotPose` types
- `DEFAULT_GAZE_INTENTS` and `ATTENTIVE_GAZE_INTENTS`
- `DEFAULT_TUNING`, `SETTLED_TUNING`, `MascotTuning` and `SpringTuning`
- `mascotGeometry`, `MASCOT_GEOMETRY`, `MASCOT_SHAPES` and `TileSpec`
- `facingEyes` and `FacingEye`, for projecting the paired eyes
- `REST_POSE`, `STATE_GAZE` and `STATE_POSE`
- the state and gaze protocol types every renderer shares

The integrator, the distance field and the eye step stay private, so the
simulation can be retuned without breaking a renderer.

## Repository

[github.com/Justar96/bakebot-icon](https://github.com/Justar96/bakebot-icon/tree/main/packages/core)
