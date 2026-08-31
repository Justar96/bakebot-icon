import { describe, expect, test } from "bun:test";

import { lex } from "./lex";

/**
 * The lexer's two obligations.
 *
 * One: it never loses a character. The runs it returns are what the page
 * prints, so anything it drops is a snippet the reader cannot read — and a
 * regex with seven alternatives and two lookaheads is exactly the kind of
 * thing that silently eats a character at a boundary. Every case below is
 * round-tripped, whatever else it is checking.
 *
 * Two: it claims the right words in the four blocks this page actually has.
 */

const kinds = (source: string) =>
  lex(source)
    .filter(([kind]) => kind)
    .map(([kind, text]) => `${kind}:${text}`);

const rebuild = (source: string) =>
  lex(source)
    .map(([, text]) => text)
    .join("");

describe("lex", () => {
  test("returns every character it was given", () => {
    for (const source of [
      "",
      "  ",
      "<GisxIcon />",
      'const a = "x"; // done',
      "/* unterminated",
      'a === b ? "y" : "n"',
      "`a ${b} c`",
      "<<>>",
    ]) {
      expect(rebuild(source)).toBe(source);
    }
  });

  test("colours the call the composer writes", () => {
    expect(kinds('<GisxIcon state="Working" size={32} />')).toEqual([
      "tag:GisxIcon",
      "attr:state",
      'string:"Working"',
      "attr:size",
      "constant:32",
    ]);
  });

  test("colours an import and its screaming constant", () => {
    expect(kinds('import { createMascot, DEFAULT_GAZE_INTENTS } from "@bakebot/core";')).toEqual([
      "keyword:import",
      "constant:DEFAULT_GAZE_INTENTS",
      "keyword:from",
      'string:"@bakebot/core"',
    ]);
  });

  test("a call is an entity, the object it is called on is not", () => {
    expect(kinds("mascot.advance(delta);")).toEqual(["entity:advance"]);
  });

  test("a string wins over what looks like code inside it", () => {
    expect(kinds('"const x = 1 // not a comment"')).toEqual([
      'string:"const x = 1 // not a comment"',
    ]);
  });

  test("a comment wins over the keywords in it", () => {
    expect(kinds("// import from")).toEqual(["comment:// import from"]);
  });
});
