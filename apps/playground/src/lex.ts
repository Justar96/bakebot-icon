/**
 * A lexer for the code blocks, and only for them.
 *
 * Not Shiki, and not `@pierre/diffs` over it. Both were considered and both
 * are the wrong size for this page: they carry a TextMate grammar and a theme
 * resolver so that any language can be highlighted correctly, and this page
 * has four blocks in one language — a `GisxIcon` call, an import, and a dozen
 * lines of a requestAnimationFrame loop. A grammar bundle is a hundred times
 * the weight of what it would be lexing here.
 *
 * The deciding constraint is the fourth block, though. It is not written in
 * this repository: the composer generates it as the reader turns the dials, so
 * it is a different string on every frame. Highlighting that at build time is
 * impossible, and a page where three blocks are coloured by a build step and
 * the one the reader is actually watching is not would be worse than a page
 * with no colour at all. One mechanism, in the browser, for all four.
 *
 * So this is a lexer for a small language rather than a parser for a large
 * one: seven rules, in priority order, and everything they do not claim is
 * left alone. It gets the four blocks on this page right and it will get most
 * short JavaScript right, and it is honestly not a JavaScript parser —
 * `label:` in a loop or `a ? b : c` will claim the wrong word, because both
 * look exactly like an object key from inside a regular expression. If a
 * snippet ever needs one of those, colour is not what it needs.
 *
 * Its own module, with no React and no StyleX in it, so the test beside it can
 * run the rules directly: the rules are the part that can be wrong, and a rule
 * that is wrong is wrong in a way a test can say out loud.
 */

/* One pass, in priority order: a `//` inside a string must lose to the string,
 * and a keyword must lose to a comment. Named groups rather than indices so
 * the kind is read off the match rather than counted to.
 *
 * No lookbehind anywhere. A JSX tag is the only rule that needs to know what
 * came before it, and it is spelled as two groups — the bracket and the name —
 * so the regex still compiles on an engine without variable-length lookbehind
 * rather than throwing at module load and taking the page with it. */
const RULES = new RegExp(
  [
    String.raw`(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)`,
    String.raw`(?<string>"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\`(?:[^\`\\]|\\.)*\`)`,
    String.raw`(?<bracket><\/?)(?<tag>[A-Z][\w.]*)`,
    String.raw`\b(?<keyword>import|from|export|default|const|let|var|function|return|new|await|async|class|extends|typeof|instanceof|in|of|if|else|for|while|switch|case|break|continue|throw|try|catch|finally|this|null|undefined|true|false|void|as|satisfies)\b`,
    String.raw`(?<constant>\b\d+(?:\.\d+)?\b|\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b)`,
    String.raw`(?<attr>[A-Za-z_$][\w$]*)(?==[^=]|\s*:)`,
    String.raw`(?<entity>[A-Za-z_$][\w$]*)(?=\s*\()`,
  ].join("|"),
  "g",
);

/* The seven the rules can produce. `null` is the eighth possibility and the
 * commonest one: the runs no rule claimed. */
export type Kind = "comment" | "string" | "tag" | "keyword" | "constant" | "attr" | "entity";

/**
 * The source, as a list of `[kind, text]` pairs — `null` for the runs no rule
 * claimed, which are most of the characters in any snippet.
 */
export function lex(source: string): [Kind | null, string][] {
  const out: [Kind | null, string][] = [];
  let at = 0;

  for (const match of source.matchAll(RULES)) {
    const groups = match.groups as Record<Kind | "bracket", string | undefined>;
    if (match.index > at) out.push([null, source.slice(at, match.index)]);

    /* The one rule that emits two runs: `</` is punctuation and keeps the ink,
     * the name after it is the entity. */
    if (groups.bracket !== undefined) out.push([null, groups.bracket]);

    for (const kind of ["comment", "string", "tag", "keyword", "constant", "attr", "entity"] as const) {
      const text = groups[kind];
      if (text !== undefined) {
        out.push([kind, text]);
        break;
      }
    }
    at = match.index + match[0].length;
  }

  if (at < source.length) out.push([null, source.slice(at)]);
  return out;
}
