import * as stylex from "@stylexjs/stylex";

import { lex } from "./lex";
import { syntax } from "./tokens.stylex";
import { styles as ui } from "./ui";

/**
 * The code blocks, coloured.
 *
 * `lex.ts` decides what each run of characters is; this decides what colour
 * that is. The colours come from the `syntax` token group, so a block changes
 * with the surface the same way the rest of the page does and there is no
 * second theme to keep in step with the first.
 */

const s = stylex.create({
  comment: { color: syntax.comment },
  string: { color: syntax.string },
  /* A tag and a call are the same role: the thing the line is about. */
  tag: { color: syntax.entity },
  entity: { color: syntax.entity },
  keyword: { color: syntax.keyword },
  constant: { color: syntax.constant },
  attr: { color: syntax.attr },
});

/**
 * A code block: the same box `ui.pre` always drew, with the words coloured.
 *
 * The children are a string rather than nodes, because the lexer reads
 * characters. Every block on this page was already a single template or a
 * joined array of lines, so nothing loses anything by saying so in its type.
 */
export function Code({ children }: { children: string }) {
  return (
    <pre {...stylex.props(ui.pre)}>
      {lex(children).map(([kind, text], index) =>
        kind ? (
          /* The index is the key because the output is positional: run 3 of
           * this string is run 3 of it on every render. */
          <span key={index} {...stylex.props(s[kind])}>
            {text}
          </span>
        ) : (
          text
        ),
      )}
    </pre>
  );
}
