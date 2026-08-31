# Changelog

## 0.4.0

Hard-renames the component to `BakebotIcon` and its props to
`BakebotIconProps`. CSS moves to `.bakebot-icon`, every custom property and
animation uses the `--bakebot-*`/`bakebot-*` prefix, and the explicit stylesheet
entry is now `@bakebot/react/bakebot-icon.css`.

The old component, types, classes, variables and stylesheet path are removed;
there are no compatibility aliases. This starts a new compatibility line.

## 0.3.2

Fixes the types for anyone not using a bundler-style resolver.

Two defects, both in the shipped declarations rather than in anything that
runs. `dist/index.d.ts` re-exported `./headless` without a file extension, so
`moduleResolution: node16` and `nodenext` could not resolve it and concluded
the package exported nothing — reported as `error TS2305` on the consumer's own
import, where `skipLibCheck` does not help. It also carried
`import "./bakebot-icon.css"`, which TypeScript cannot resolve as a type; that
made the browser entry unresolvable under *every* mode, bundler included. The
stylesheet import stays in `dist/index.js`, where it does something.

The build now refuses to emit a declaration that imports a stylesheet or names
a relative specifier without an extension, and `verify:tarballs` runs
`publint` and `attw` against the packed artifact.

Declares `engines.node`, and ships this changelog.

## 0.3.1

The README was rewritten. The code is byte-identical to 0.3.0.

## 0.3.0

Adds `@bakebot/react/headless`, a CSS-free entry for test runners and other
environments with no stylesheet loader. `className`, `style` and `ref` now
reach the root `<svg>`, `className` merging with the mascot's own class rather
than replacing it, and `size` accepts any CSS length as well as a pixel
number.

Ships its own README and keywords, carries the MIT licence text, and drops
source maps from the tarball, which took an install from 204 KB to 84 KB.
`sideEffects` names the stylesheet-bearing wrapper as well as the stylesheet,
so a bundler cannot resolve the component from the headless entry and drop the
CSS.

## 0.2.0

First release under the `@bakebot` scope.
