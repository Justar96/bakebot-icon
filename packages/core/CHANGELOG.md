# Changelog

## 0.4.0

Hard-renames the mascot vocabulary to Bakebot. The protocol now exports
`BakebotIconState`, `BakebotIconPaneState` and `BakebotIconConfig`; the retired
names are removed rather than kept as aliases.

This starts a new compatibility line. Patch releases in the 0.4 line remain
checked against the latest published 0.4 surface.

## 0.3.2

The declarations now spell their relative imports with the `.js` extension the
runtime already used. Without it, a project on `moduleResolution: node16` or
`nodenext` could not resolve `./mascot` and friends, and TypeScript reported
that against the consumer's own import line rather than against this package,
where `skipLibCheck` could not suppress it. The runtime bundle was always
correct, which is why nothing here noticed until `are-the-types-wrong` was
pointed at the tarball.

The build now refuses to emit a declaration with an extensionless relative
specifier, and `verify:tarballs` runs `publint` and `attw` against the packed
artifact.

Declares `engines.node`, and ships this changelog.

## 0.3.1

The README was rewritten. The code is byte-identical to 0.3.0.

## 0.3.0

Ships its own README and keywords, carries the MIT licence text, and drops
source maps and declaration maps from the tarball. Builds reproducibly: the
temporary bundling path no longer leaks into the output, so the same source
produces the same bytes.

## 0.2.0

First release under the `@bakebot` scope.
