import * as stylex from "@stylexjs/stylex";
import { useId, useRef, useState } from "react";

import { cue } from "./sound";
import { color, motion, radius, space, type } from "./tokens.stylex";

/**
 * A slider whose only values are stops.
 *
 * Ported from interior.dev's slider-detents
 * (https://www.interior.dev/docs/slider-detents) into StyleX and onto a bare
 * `role="slider"`. Detents there are "stops you can feel": named values inside
 * a range that pull the pointer toward them as it passes, so a reader lands on
 * one without aiming. The reference carries a step grid between them and a
 * pull radius of 4.5% of the range to capture the pointer near one.
 *
 * There is no grid here, and no radius, because this slider has nothing
 * between its stops. The six pane states are the whole of what it can be set
 * to, so the pull radius is half the gap to the next one and capture is simply
 * the nearest — which is what the reference's magnetism becomes when the
 * detents fill the range. Implementing the resistance as well would be
 * implementing a case this page does not have.
 *
 * The states are not a scale. `Idle → Working → NeedsAttention → Notified →
 * MaybeBlocked → Exited` is the order the docs list them in, not an amount of
 * anything, so the track carries no fill: a filled bar says "this much", and
 * there is no much. It is a scrubber — the stops in a row, and the thing you
 * are on.
 *
 * Every stop is named, which is the one place this departs from the reference.
 * There the readout is `0.50x, Normal` — the value, and the label of the detent
 * it is sitting in — because the range is continuous and the stops are notes
 * inside it. Here the stops *are* the range: a reader cannot discover that
 * `MaybeBlocked` exists by dragging toward it, because there is nothing between
 * here and there to drag through. So the six names are printed under their own
 * ticks and the current one is inked, which makes the travelling readout
 * redundant — the highlight says the same thing in the same place.
 *
 * The row is edge-anchored rather than centred throughout: the first name
 * starts at its tick, the last ends at its, the middle four are centred on
 * theirs. Centring all six would hang `Idle` half off the left edge of the
 * track, and a legend that overflows the thing it labels is a legend that has
 * to be given its own margin.
 *
 * Three tiers, as everywhere else. The thumb travels on `moderate` because it
 * is landing on a mark, and the travel is switched off entirely while a
 * pointer is down: a spring between the finger and the thumb is lag, not
 * motion. The grab is `fast`, and reduced motion keeps the colours and drops
 * both. https://www.fluidfunctionalism.com/docs/motion
 */

const REDUCED = "@media (prefers-reduced-motion: reduce)";

/* The reference's own figure: a 6ms tick, short enough to read as the edge of
 * a stop rather than as a buzz. */
const HAPTIC_MS = 6;

/* The reference's own geometry, one step down: it draws a 2x5 tick and a thumb
 * a little under the height of a compact control. The whole control is a
 * caption with a track in it, so nothing in it is set at control size. */
const THUMB = 12;
const TRACK = 3;
const TICK = 5;

const s = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: space.xs,
    userSelect: "none",
    touchAction: "none",
    borderRadius: radius.md,
    outlineWidth: { default: 0, ":focus-visible": 2 },
    outlineStyle: "solid",
    outlineColor: color.accent,
    outlineOffset: 4,
    cursor: { default: "grab", ":active": "grabbing" },
    transitionProperty: "outline-width",
    transitionDuration: motion.fastIn,
    transitionTimingFunction: motion.ease,
  },
  label: {
    color: color.dim,
    fontSize: type.xs,
    fontWeight: 500,
    lineHeight: 1.3,
  },
  /* The track is the hit target as well as the drawing, so it is a row the
   * height of the thumb with a 4px bar drawn down the middle of it. A 4px
   * target is a miss. */
  lane: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    height: THUMB,
    /* Inset by half a thumb at each end, so the thumb's own edge lands on the
     * end of the track rather than half a thumb past it. */
    marginInline: THUMB / 2,
  },
  bar: {
    width: "100%",
    height: TRACK,
    borderRadius: radius.pill,
    backgroundColor: color.raised,
  },
  /* Where a stop is. Not coloured by whether it has been passed: passing a
   * state is not progress through anything. */
  tick: {
    position: "absolute",
    top: "50%",
    width: 2,
    height: TICK,
    marginTop: -TICK / 2,
    marginLeft: -1,
    borderRadius: radius.pill,
    backgroundColor: color.lineStrong,
  },
  thumb: {
    position: "absolute",
    top: "50%",
    width: THUMB,
    height: THUMB,
    marginTop: -THUMB / 2,
    marginLeft: -THUMB / 2,
    borderRadius: radius.pill,
    backgroundColor: color.ink,
    transitionProperty: { default: "left, transform", [REDUCED]: "none" },
    transitionDuration: motion.moderateIn,
    transitionTimingFunction: motion.critical,
  },
  /* Under the finger, the travel stops: the thumb is where the pointer is, and
   * a curve between the two is the interface lagging behind the hand. */
  thumbHeld: { transform: "scale(1.15)", transitionDuration: motion.none },
  /* Every stop, named, on the same axis as the ticks. Absolute rather than a
   * `space-between` row: a justified row spaces the *gaps* evenly, so with six
   * names of six different lengths not one of them would land on its tick. */
  legend: {
    position: "relative",
    height: 14,
    marginInline: THUMB / 2,
  },
  hint: {
    position: "absolute",
    top: 0,
    whiteSpace: "nowrap",
    color: color.dim,
    fontFamily: type.mono,
    fontSize: type.xs,
    lineHeight: 1.3,
    /* Colour, not motion: the highlight moves by changing which word is inked,
     * so there is nothing here for reduced motion to switch off. */
    transitionProperty: "color",
    transitionDuration: motion.fastIn,
    transitionTimingFunction: motion.ease,
  },
  hintOn: { color: color.ink },
  /* Which edge of the name sits on the tick. */
  fromStart: { transform: "none" },
  onTick: { transform: "translateX(-50%)" },
  fromEnd: { transform: "translateX(-100%)" },
  at: (percent: number) => ({ left: `${percent}%` }),
});

export const detentStyles = s;

export function DetentSlider({
  label,
  detents,
  value,
  onChange,
  haptic = true,
}: {
  label: string;
  /** The stops, in the order they sit on the track. */
  detents: readonly string[];
  value: string;
  onChange: (value: string) => void;
  haptic?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const lane = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(false);
  const id = useId();

  const last = detents.length - 1;
  const index = Math.max(0, detents.indexOf(value));
  const percent = last > 0 ? (index / last) * 100 : 0;

  /* One place decides what a position means, and one place reports it. The
   * tick is fired here rather than at the call site because crossing into a
   * stop is what is being felt, and only this function knows it happened. */
  const land = (next: number) => {
    const clamped = Math.min(last, Math.max(0, next));
    if (clamped === index) return;
    if (haptic && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(HAPTIC_MS);
    }
    /* The same crossing, in the other channel. A detent is a stop you can feel,
     * and cuelume keeps a cue named after the sound one makes. */
    cue("tick");
    onChange(detents[clamped]!);
  };

  const nearest = (clientX: number) => {
    const box = lane.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    land(Math.round(((clientX - box.left) / box.width) * last));
  };

  return (
    <div
      aria-labelledby={id}
      aria-valuemax={last}
      aria-valuemin={0}
      aria-valuenow={index}
      aria-valuetext={value}
      onKeyDown={(event) => {
        const step =
          event.key === "ArrowRight" || event.key === "ArrowUp"
            ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowDown"
              ? -1
              : 0;
        if (step !== 0) land(index + step);
        else if (event.key === "Home") land(0);
        else if (event.key === "End") land(last);
        else return;
        event.preventDefault();
      }}
      ref={root}
      role="slider"
      tabIndex={0}
      {...stylex.props(s.root)}
    >
      <span id={id} {...stylex.props(s.label)}>
        {label}
      </span>

      <div
        onPointerCancel={() => setHeld(false)}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          /* The track is a child of the thing that has the role and the
           * tabindex, and a press on a child does not focus its parent — so a
           * reader who grabs the thumb and then reaches for the arrow keys
           * would be pressing them at the page. */
          root.current?.focus();
          setHeld(true);
          nearest(event.clientX);
        }}
        onPointerMove={(event) => {
          if (held) nearest(event.clientX);
        }}
        onPointerUp={() => setHeld(false)}
        ref={lane}
        {...stylex.props(s.lane)}
      >
        <span {...stylex.props(s.bar)} />
        {detents.map((detent, at) => (
          <span
            key={detent}
            {...stylex.props(s.tick, s.at(last > 0 ? (at / last) * 100 : 0))}
          />
        ))}
        <span {...stylex.props(s.thumb, s.at(percent), held && s.thumbHeld)} />
      </div>

      {/* Hidden from assistive tech: `aria-valuetext` already announces where
          the slider is, and a screen reader reading the row as well would
          announce all six names on every crossing. */}
      <span aria-hidden="true" {...stylex.props(s.legend)}>
        {detents.map((detent, at) => (
          <span
            key={detent}
            {...stylex.props(
              s.hint,
              s.at(last > 0 ? (at / last) * 100 : 0),
              at === 0 ? s.fromStart : at === last ? s.fromEnd : s.onTick,
              at === index && s.hintOn,
            )}
          >
            {detent}
          </span>
        ))}
      </span>
    </div>
  );
}
