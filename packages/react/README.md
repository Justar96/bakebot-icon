# @bakebot/react

The React binding for the gisx mascot. It draws the paired-eye SVG, runs the
`@bakebot/core` simulation, and loads the stylesheet for you.

## Install

```bash
bun add @bakebot/react
```

React 19 is a peer dependency. `@bakebot/core` comes with the binding.

## Smallest component

```tsx
import { GisxIcon } from "@bakebot/react";

export function StatusMark() {
  return <GisxIcon state="Working" size={32} label="gisx is working" />;
}
```

## What it exports

- `GisxIcon` and `GisxIconProps`
- the state, gaze, tuning, geometry and reduced-motion types
- the public `@bakebot/core` helpers, among them `createMascot`, `facingEyes`
  and `mascotGeometry`

`GisxIcon` takes a pane `state`, a `size` in pixels or any CSS length, an
accessible `label`, `config.color`, `gazeIntents`, `tuning`, `shape`, `seed`
and `reducedMotion`. `className`, `style` and `ref` reach the root `<svg>`.
`className` merges with the mascot's own class rather than replacing it, and
caller styles are written last, so an explicit custom property wins.

## The headless entry

The default entry imports CSS, so importing it outside a bundler throws:

```
TypeError: Unknown file extension ".css"
```

That is any test runner without a CSS transform. Import the headless entry
there instead:

```tsx
import { GisxIcon } from "@bakebot/react/headless";
```

It carries no stylesheet side effect, so a browser build using it loads the
CSS itself:

```ts
import "@bakebot/react/gisx-icon.css";
```

Both entries are the same implementation, so importing each of them in one
bundle does not give you two mascots. Prefer the default entry in an
application, unless the build owns CSS loading.

## Repository

[github.com/Justar96/gisx-icon](https://github.com/Justar96/gisx-icon/tree/main/packages/react)
