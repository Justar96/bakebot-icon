import * as stylex from "@stylexjs/stylex";
import { useCallback, useEffect, useRef, useState } from "react";

import { cue } from "./sound";
import { color, control, motion, radius, type } from "./tokens.stylex";

/**
 * The command row: a prompt glyph, a label that can be swapped for another
 * without the row resizing, and a mark on the end.
 *
 * The two labels are stacked in one grid cell rather than swapped in the DOM,
 * so the wider of them fixes the width before either is shown — the same
 * reserved-width rule the interior.dev ports follow, for the same reason: a
 * copy confirmation that widens the row shoves the page around.
 *
 * Reduced motion drops the scale and keeps the fade, at the same speed it
 * always ran. A reader who asked for less motion still gets to watch the label
 * change hands — they just do not get the thing that moves.
 */

const REDUCED = "@media (prefers-reduced-motion: reduce)";


const s = stylex.create({
  chrome: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    columnGap: control.gap,
    width: "100%",
    /* The system's control height, shared with every other row on the page.
     * https://www.fluidfunctionalism.com/docs/sizes */
    height: control.height,
    paddingInline: control.padX,
    borderRadius: radius.lg,
    /* Borderless, so hover has to be the ground moving: it deepens a step
     * rather than lightening toward the panel it would otherwise vanish into. */
    backgroundColor: { default: color.raised, ":hover": color.line },
    color: color.ink,
    fontFamily: type.mono,
    fontSize: control.text,
    lineHeight: 1,
    textAlign: "start",
    cursor: "pointer",
    userSelect: "none",
    outlineColor: color.accent,
    outlineOffset: 2,
    /* Hover-as-preview on the fast preset, asymmetric: the row lights under
     * the cursor in `fastIn` and lets go in `fastOut`. All three properties
     * are colour, so reduced motion leaves them alone. */
    transitionProperty: "background-color, color",
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.ease,
    transform: { default: null, ":active": "scale(0.98)" },
  },
  prompt: { gridArea: "1 / 1", color: color.faint, fontVariantNumeric: "tabular-nums" },

  /* Both labels live in column 2, row 1. */
  cell: {
    gridArea: "1 / 2",
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    transitionProperty: { default: "opacity, transform", [REDUCED]: "opacity" },
    transitionTimingFunction: motion.easeOut,
  },
  valueIdle: { color: color.dim, pointerEvents: "none" },
  copied: { color: color.good },

  /* The two sides of the crossing, as a transition rather than a pair of
   * keyframes. A row that is clicked again mid-crossing retargets from where
   * it is instead of restarting from nothing — and a transition only runs when
   * something changes, so the row no longer fades itself in on page load.
   *
   * The arriving side waits out `stagger` so the leaving one is already on its
   * way; leaving takes `fastOut`, arriving `fastIn`. Reduced motion keeps the
   * fade and drops the scale, which is why the transform is conditional rather
   * than the duration. */
  shown: {
    opacity: 1,
    transform: "none",
    transitionDuration: motion.fastIn,
    transitionDelay: motion.stagger,
  },
  hidden: {
    opacity: 0,
    transform: { default: "scale(0.98)", [REDUCED]: "none" },
    transitionDuration: motion.fastOut,
  },

  /* The system's icon size, for the two marks on the end of the row. Read off
   * the token and applied in CSS rather than written on the SVG: an attribute
   * cannot follow a variable, and the mark has to step down with its region.
   * https://www.fluidfunctionalism.com/docs/sizes */
  mark: {
    gridArea: "1 / 3",
    position: "relative",
    width: control.icon,
    height: control.icon,
    flexShrink: 0,
    color: color.faint,
  },
  /* The mark crosses on the same two states as the label, so the row changes
   * hands once rather than twice. It scales and nothing else: a mark that also
   * tilted was the one piece of motion on this page doing something for its
   * own sake. */
  markLayer: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transitionProperty: { default: "opacity, transform", [REDUCED]: "opacity" },
    transitionTimingFunction: motion.easeOut,
  },
  markHidden: { transform: { default: "scale(0.85)", [REDUCED]: "none" } },
  checked: { color: color.good },
});

function CopyMark() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="100%"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      width="100%"
    >
      <rect height="12" rx="2" width="12" x="9" y="9" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="100%"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width="100%"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * A line of code you can take away: click it and it is on the clipboard.
 *
 * The whole row is the button, because a copy target the size of a word is a
 * copy target you miss.
 */
export function ClipboardField({
  value,
  label = value,
  prompt = "$",
  copiedLabel = "Copied to clipboard",
  copyLabel = "Copy to clipboard",
  resetDelay = 2000,
  onCopy,
}: {
  value: string;
  /** What the row reads, when the thing copied is too long to be a row. */
  label?: string;
  prompt?: string;
  copiedLabel?: string;
  copyLabel?: string;
  resetDelay?: number;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    cue("droplet");
    onCopy?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), resetDelay);
  }, [value, onCopy, resetDelay]);

  return (
    <button
      {...stylex.props(s.chrome)}
      aria-label={copied ? copiedLabel : copyLabel}
      onClick={() => void copy()}
      /* The row is a click target, not a selection: dragging across it should
       * not leave the code half-highlighted behind the confirmation. */
      onPointerDown={(event) => event.preventDefault()}
      type="button"
    >
      <span {...stylex.props(s.prompt)}>{prompt}</span>

      <span {...stylex.props(s.cell, s.valueIdle, copied ? s.hidden : s.shown)}>
        {label}
      </span>
      <span aria-hidden={!copied} {...stylex.props(s.cell, s.copied, copied ? s.shown : s.hidden)}>
        {copiedLabel}
      </span>

      <span {...stylex.props(s.mark)}>
        <span {...stylex.props(s.markLayer, copied ? s.hidden : s.shown, copied && s.markHidden)}>
          <CopyMark />
        </span>
        <span
          {...stylex.props(
            s.markLayer,
            s.checked,
            copied ? s.shown : s.hidden,
            !copied && s.markHidden,
          )}
        >
          <CheckMark />
        </span>
      </span>
    </button>
  );
}
