# gisx-icon

Code-native gisx brand mark.

```ts
import { GisxIcon } from "gisx-icon";

<GisxIcon state={entry.attention.state} size={32} />
```

The mark takes a wire pane state whole, payload included, and normalises it itself. Styles ship with the component — no extra CSS import.

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
