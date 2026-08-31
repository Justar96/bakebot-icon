import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { CSSProperties } from "react";

import { readFileSync } from "node:fs";

import {
  ATTENTIVE_GAZE_INTENTS,
  facingEyes,
  BakebotIcon,
  mascotGeometry,
  MASCOT_GEOMETRY,
  MASCOT_SHAPES,
  STATE_POSE,
  type GazeIntent,
  type BakebotIconPaneState,
} from "../src/index.js";

function paneStateName(state: BakebotIconPaneState): string {
  return typeof state === "string" ? state : "Exited";
}

/** Model values, in the shape the wire actually delivers them. */
const STATES: BakebotIconPaneState[] = [
  "Idle",
  "Working",
  "NeedsAttention",
  "Notified",
  "MaybeBlocked",
  { Exited: { code: 1 } },
];

describe("the bakebot mascot", () => {
  it("projects every pane state onto the same pair of eyes", () => {
    for (const state of STATES) {
      const html = renderToStaticMarkup(<BakebotIcon state={state} />);
      expect(html).toContain(`data-state="${paneStateName(state)}"`);
      expect(html.match(/<circle/g)).toHaveLength(2);
      expect(html.match(/class="bakebot-icon__eyes"/g)).toHaveLength(1);
      expect(html.match(/class="bakebot-icon__disc"/g)).toHaveLength(2);
    }
  });

  it("takes a model value whole, payload and all", () => {
    // The wiring a caller writes is `state={entry.attention.state}`. If the
    // icon needed a flattened name first, every call site would carry its own
    // conversion and one of them would eventually differ.
    const html = renderToStaticMarkup(<BakebotIcon state={{ Exited: { code: 130 } }} />);
    expect(html).toContain('data-state="Exited"');
    // The code belongs to whatever shows the exit, not to the mascot.
    expect(html).not.toContain("130");
  });

  it("stays alive in every state but the one whose pose has shut the eye", () => {
    // `data-live` turns off the state transition on the motion layers, so it
    // has to agree with whether the simulation is actually running. A pose and
    // a transition writing the same property is the defect it prevents.
    for (const state of STATES) {
      const html = renderToStaticMarkup(<BakebotIcon state={state} />);
      expect(html.includes('data-live=""')).toBe(paneStateName(state) !== "Exited");
    }
  });

  it("is decorative by default and can carry an accessible name", () => {
    expect(renderToStaticMarkup(<BakebotIcon />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<BakebotIcon label="bakebot is working" />)).toContain(
      'aria-label="bakebot is working"',
    );
  });

  it("keeps neutral gray by default and accepts a configured colour", () => {
    const defaultIcon = renderToStaticMarkup(<BakebotIcon state="NeedsAttention" />);
    const configuredIcon = renderToStaticMarkup(<BakebotIcon config={{ color: "#5f8cff" }} />);

    expect(defaultIcon).not.toContain("--bakebot-icon-color");
    expect(configuredIcon).toContain("--bakebot-icon-color:#5f8cff");
  });

  it("keeps its own class beside the one a caller adds", () => {
    expect(renderToStaticMarkup(<BakebotIcon className="wordmark-mascot" />)).toContain(
      'class="bakebot-icon wordmark-mascot"',
    );
  });

  it("lets a caller add styles and deliberately override its custom properties", () => {
    const html = renderToStaticMarkup(
      <BakebotIcon
        config={{ color: "#5f8cff" }}
        state="Working"
        style={{ "--bakebot-icon-color": "hotpink", opacity: 0.75 } as CSSProperties}
      />,
    );

    expect(html).toContain("--bakebot-icon-color:hotpink");
    expect(html).not.toContain("--bakebot-icon-color:#5f8cff");
    expect(html).toContain("opacity:0.75");
    expect(html).toContain(`--bakebot-eye-x:${STATE_POSE.Working.eyeX}px`);
  });

  it("accepts a custom set of points of interest", () => {
    const gazeIntents: readonly GazeIntent[] = [
      { x: 2, y: -2, hold: 0.5 },
      { x: -2, y: 2, hold: 0.8 },
    ];

    expect(renderToStaticMarkup(<BakebotIcon gazeIntents={gazeIntents} />)).toContain(
      'data-state="Idle"',
    );
    expect(renderToStaticMarkup(<BakebotIcon gazeIntents={ATTENTIVE_GAZE_INTENTS} />)).toContain(
      'data-live=""',
    );
  });

  it("carries no motion into the served markup", () => {
    // Motion is simulated after mount, so the mascot ships undeformed
    // and every other state is CSS alone.
    expect(renderToStaticMarkup(<BakebotIcon />)).not.toContain("transform");
  });

  it("keeps state poses separate from live simulation transforms", () => {
    const html = renderToStaticMarkup(<BakebotIcon />);

    expect(html).toContain('class="bakebot-icon__state-pose"');
    expect(html).toContain('class="bakebot-icon__eye-motion"');
    expect(html).toContain('class="bakebot-icon__expression-motion"');
    expect(html).toContain('class="bakebot-icon__entrance"');
    expect(html).toContain('class="bakebot-icon__notified-blink"');
    expect(html.match(/class="bakebot-icon__disc"/g)).toHaveLength(2);
  });

  it("sanitises a degenerate size to the default instead of emitting NaN", () => {
    // A plain-JS caller can pass anything; an invalid width would otherwise
    // reach the DOM and React would warn about NaN attributes.
    expect(renderToStaticMarkup(<BakebotIcon size={Number.NaN} />)).toContain('width="32"');
    expect(renderToStaticMarkup(<BakebotIcon size={0} />)).toContain('width="32"');
    expect(renderToStaticMarkup(<BakebotIcon size={-16} />)).toContain('height="32"');
    expect(renderToStaticMarkup(<BakebotIcon size={48} />)).toContain('width="48"');
    expect(renderToStaticMarkup(<BakebotIcon size="0.78em" />)).toContain('width="0.78em"');
  });

  it("draws the tile the eye is actually bounded by", () => {
    // The geometry is exported so a second renderer draws this mascot rather
    // than one that resembles it. That is only true while *this* renderer also
    // reads it — a re-typed 60 or 14 here would drift the moment the character
    // moved, and nothing else would notice.
    const { view, centre, tile, eyes } = MASCOT_GEOMETRY;
    const [left, right] = facingEyes(0, 0);
    const html = renderToStaticMarkup(<BakebotIcon />);

    expect(html).toContain(`viewBox="0 0 ${view} ${view}"`);
    expect(html).toContain(`x="${tile.x}"`);
    expect(html).toContain(`y="${tile.y}"`);
    expect(html).toContain(`width="${tile.width}"`);
    expect(html).toContain(`height="${tile.height}"`);
    expect(html).toContain(`rx="${tile.radius}"`);
    expect(html).toContain(`cx="${centre + left.x}"`);
    expect(html).toContain(`cx="${centre + right.x}"`);
    expect(html).toContain(`r="${eyes.radius}"`);
    // The default is a circle: square, and rounded by half its width.
    expect(tile.width).toBe(tile.height);
    expect(tile.radius).toBe(tile.width / 2);
  });

  it("cuts the eye off at the tile, since it is allowed to hang over it", () => {
    // The eye reaches `TILE.overshoot` past the border and the tile clips it,
    // which is what makes a far look read as a face turning away rather than
    // as a whole shape sliding to a stop against a wall.
    const html = renderToStaticMarkup(<BakebotIcon />);
    const clip = html.match(/<clipPath id="([^"]+)">(.*?)<\/clipPath>/s);
    expect(clip).not.toBeNull();
    const [, id, inside] = clip!;

    // The clip is the tile, from the same numbers — not a shape that resembles
    // it. A rect that drifted from the drawn one would shave the wrong edge.
    const tile = MASCOT_GEOMETRY.tile;
    for (const attribute of [
      `x="${tile.x}"`,
      `y="${tile.y}"`,
      `width="${tile.width}"`,
      `height="${tile.height}"`,
      `rx="${tile.radius}"`,
    ]) {
      expect(inside).toContain(attribute);
    }

    // And it is worn by a layer with no transform of its own: a `clip-path` is
    // resolved in the user space of whatever carries it, so a clip on a moving
    // layer would drag the tile's outline along with the eye.
    expect(html).toContain(`<g class="bakebot-icon__frame" clip-path="url(#${id})">`);
    expect(id).toMatch(/^bakebot-tile-[A-Za-z0-9_-]+$/);

    // Two mascots on one page must not share an id, or the second one's clip
    // silently becomes the first one's tile.
    const pair = renderToStaticMarkup(
      <>
        <BakebotIcon shape="pill" />
        <BakebotIcon shape="card" />
      </>,
    );
    const ids = [...pair.matchAll(/<clipPath id="([^"]+)">/g)].map(([, value]) => value);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("draws every shape it ships, and the eye is the same size in all of them", () => {
    // Each name is a real tile the simulation collides against, not a drawing:
    // the rect comes from the same resolver, and the character inside it does
    // not change size or position between them.
    const drawn = new Set<string>();
    const [left] = facingEyes(0, 0);
    for (const name of Object.keys(MASCOT_SHAPES) as (keyof typeof MASCOT_SHAPES)[]) {
      const { tile, eyes, centre } = mascotGeometry(name);
      const html = renderToStaticMarkup(<BakebotIcon shape={name} />);
      expect(html).toContain(`rx="${tile.radius}"`);
      expect(html).toContain(`width="${tile.width}"`);
      expect(html).toContain(`height="${tile.height}"`);
      expect(html).toContain(`x="${tile.x}"`);
      expect(html).toContain(`y="${tile.y}"`);
      expect(html).toContain(`cx="${centre + left.x}"`);
      expect(html).toContain(`r="${eyes.radius}"`);
      drawn.add(`${tile.width}x${tile.height}r${tile.radius}`);
    }
    // Six names, six distinct silhouettes — otherwise two of them are the same
    // shape wearing different words.
    expect(drawn.size).toBe(Object.keys(MASCOT_SHAPES).length);

    // A caller may pass their own tile instead of a name, and it is clamped to
    // what the distance field can answer about rather than drawn as given.
    expect(renderToStaticMarkup(<BakebotIcon shape={{ radius: 999 }} />)).toContain('rx="30"');
    expect(renderToStaticMarkup(<BakebotIcon shape={{ radius: -5 }} />)).toContain('rx="0"');
    expect(renderToStaticMarkup(<BakebotIcon shape={{ halfY: 2 }} />)).toContain('height="28"');
  });

  it("draws the pair where the character says it sits", () => {
    const { centre, eyes } = MASCOT_GEOMETRY;
    const [left, right] = facingEyes(0, 0);
    const html = renderToStaticMarkup(<BakebotIcon />);

    // Drawn facing straight ahead. A mascot that is frozen, server-rendered or
    // simply has not had a frame yet is still a face, and the hook writes the
    // turn as a difference from here rather than as the whole placement.
    expect(html.match(/<circle/g)).toHaveLength(2);
    expect(html).toContain(`cx="${centre + left.x}"`);
    expect(html).toContain(`cx="${centre + right.x}"`);
    expect(html).toContain(`cy="${centre}"`);
    expect(html).toContain(`r="${eyes.radius}"`);

    // Face-on placement is the character's projection, not this renderer's.
    // Its collision constraint may open the raw spherical spacing slightly to
    // preserve the seam between the two projected discs.
    expect(right.x).toBeGreaterThanOrEqual(eyes.reach * Math.sin(eyes.azimuth));
    expect(left.x).toBeCloseTo(-right.x, 10);

    // The pair is derived from its own radii rather than from the tile, so it
    // is the same in every shape — which is why the tile never has to know
    // where the eyes are.
    for (const name of Object.keys(MASCOT_SHAPES) as (keyof typeof MASCOT_SHAPES)[]) {
      expect(mascotGeometry(name).eyes).toEqual(eyes);
    }
  });

  it("keeps the Notified blink inside the pair pose so it cannot move the eyes", () => {
    const html = renderToStaticMarkup(<BakebotIcon state="Notified" />);

    // `pairY` belongs to `__eyes`. A blink outside that group scales the offset
    // along with the discs, producing the upward jump this nesting prevents.
    expect(html).toContain(
      '<g class="bakebot-icon__eyes"><g class="bakebot-icon__notified-blink"><circle',
    );
    expect(html).not.toContain("bakebot-icon__state-expression");
  });

  it("writes a state's shape from the character's own table", () => {
    // What a state looks like is `STATE_POSE`, not a rule per state in the
    // stylesheet — which is what lets a canvas binding hold the same shapes.
    // Idle is the rest pose, so it writes nothing at all.
    expect(renderToStaticMarkup(<BakebotIcon />)).not.toContain("--bakebot-eye-x");

    const working = renderToStaticMarkup(<BakebotIcon state="Working" />);
    expect(working).toContain(`--bakebot-eye-x:${STATE_POSE.Working.eyeX}px`);
    expect(working).toContain(`--bakebot-pair-scale-y:${STATE_POSE.Working.pairScaleY}`);
    // A field this state holds at rest stays out of the markup.
    expect(working).not.toContain("--bakebot-pair-scale-x");

    const exited = renderToStaticMarkup(<BakebotIcon state={{ Exited: { code: 0 } }} />);
    expect(exited).toContain(`--bakebot-eye-y:${STATE_POSE.Exited.eyeY}px`);
    expect(exited).toContain(`--bakebot-eye-scale-y:${STATE_POSE.Exited.eyeScaleY}`);
  });

  it("leaves no second definition of a state's shape in the stylesheet", () => {
    // The whole point of moving the table into the character: two definitions
    // of what Working looks like would eventually disagree.
    const css = readFileSync(new URL("../src/bakebot-icon.css", import.meta.url), "utf8");
    for (const state of ["Working", "MaybeBlocked", "Exited"] as const) {
      expect(css).not.toContain(`data-state="${state}"`);
    }
    // The two one-shot entrances are transitions, not poses, and stay CSS.
    expect(css).toContain('data-state="NeedsAttention"] .bakebot-icon__entrance');
    expect(css).toContain('data-state="Notified"] .bakebot-icon__notified-blink');
  });

  it("degrades an unknown runtime state to a neutral, still mascot", () => {
    // A state added to the wire before the icon knows it must not crash the
    // mascot or leave it half-alive: no gaze means no simulation and no
    // data-live, and the pose stays the neutral default.
    const unknown = "Booting" as unknown as BakebotIconPaneState;
    const html = renderToStaticMarkup(<BakebotIcon state={unknown} />);

    expect(html).toContain('data-state="Booting"');
    expect(html).not.toContain("data-live");
    expect(html.match(/<circle/g)).toHaveLength(2);
  });
});
