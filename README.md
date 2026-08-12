# gisx-icon

Code-native gisx brand mark. This package is private. It is not published to npm.

```ts
import { GisxIcon } from "gisx-icon";

<GisxIcon state={entry.attention.state} size={32} />
```

The mark takes a wire pane state whole, payload included, and normalises it itself.

## Install

From another private repo, pin a tag over SSH:

```bash
bun add git+ssh://git@github.com:Justar96/gisx-icon.git#v0.1.0
```

Peer dependency: `react` ^19.

## Develop

```bash
bun install
bun test
bun run typecheck
```
