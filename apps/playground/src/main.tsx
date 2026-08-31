import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  DEFAULT_TUNING,
  GisxIcon,
  MASCOT_SHAPES,
  type GisxIconPaneState,
  type GisxIconState,
  type MascotShapeName,
  type MascotTuning,
  type SpringTuning,
} from "@bakebot/react";

/* Side-effect import, and it has to stay one. The compiler inlines every
 * `defineVars` reference into the rule that uses it and then drops the
 * now-unused import, so nothing else in the graph reaches the token file —
 * and a file the bundler never loads is a file the compiler never visits,
 * leaving the `:root` block that declares those variables unwritten. This
 * line is the only edge that survives the transform. */
import "./tokens.stylex";

import { ClipboardField } from "./clipboard-field";
import { Code } from "./code";
import { ColorPicker } from "./color-picker";
import { Composer, ComposerGroup, Key, Keys } from "./composer";
import { DetentSlider } from "./detents";
import { Dropdown } from "./dropdown";
import { Fader } from "./fader";
import { OVERLAY_HOST } from "./popover";
import { ShapeGlyph } from "./shape-glyph";
import { enableSound, startSound } from "./sound";
import { Tabs } from "./tabs";
import { HoldToConfirm, LoadingButton } from "./interior";
import {
  DriverCard,
  PoseCard,
  RendererCard,
  SpringCard,
  TravelCard,
  type SpecInput,
} from "./spec-cards";
import { useHighlight } from "./highlight";
import { compact, type Surface, surfaces } from "./themes";
import { ScrollArea } from "./scroll-area";
import { Button, styles as s } from "./ui";

/**
 * The gisx mascot, with its documentation on one side and its dials on the other.
 *
 * Three columns. The sidebar navigates and nothing else: where in the writing
 * to jump to. The middle is a document — the mascot at the top of it, then the
 * props that made it, then what the character actually is, each section ending
 * in a spec card that draws the claim it just made and prints the arithmetic
 * behind it live. It is the only column whose scroll position means anything,
 * which is why scrolling back to the top of it brings the preview back.
 *
 * The third column is a corner rather than a rail: one card in the top right
 * holding every dial, folded away by the reader when it is in the way. Turning
 * a dial still changes something without the thing you turned moving away from
 * you — it just no longer costs a full-height column to say so.
 */

const STATES: readonly GisxIconPaneState[] = [
  "Idle",
  "Working",
  "NeedsAttention",
  "Notified",
  "MaybeBlocked",
  { Exited: { code: 0 } },
];

const stateName = (state: GisxIconPaneState) =>
  typeof state === "string" ? state : `Exited(${state.Exited.code})`;

const appearanceOf = (state: GisxIconPaneState): GisxIconState =>
  typeof state === "string" ? state : "Exited";

/* The stops on the scrubber, in the order the docs list them. `stateName` is
 * already the one string that tells six pane states apart — payload included —
 * so the slider takes the names and `stateOf` reads the payload back. Derived
 * rather than written out, so the list above stays the only place a state is
 * added. */
const STATE_NAMES = STATES.map(stateName);
const stateOf = (name: string) => STATES.find((state) => stateName(state) === name) ?? STATES[0]!;

const SPRINGS = ["gaze", "jellyFree", "jellyContact"] as const;

/* The rail shows one group at a time. Eleven dials in a column is a mixing
 * desk nobody reads; four names and two faders is a question a reader can
 * answer. `feel` is the scalars — the dials that are not a spring. */
const DIAL_GROUPS = [
  { value: "gaze", label: "gaze" },
  { value: "jellyFree", label: "free" },
  { value: "jellyContact", label: "contact" },
  { value: "feel", label: "feel" },
] as const;

type DialGroup = (typeof DIAL_GROUPS)[number]["value"];
const SCALARS = [
  { key: "squish", min: 0, max: 3, step: 0.05 },
  { key: "restlessness", min: 0, max: 4, step: 0.05 },
  { key: "blinkInterval", min: 0.2, max: 12, step: 0.1 },
  { key: "blinkSpread", min: 0, max: 12, step: 0.1 },
  { key: "deadzone", min: 0, max: 30, step: 0.5 },
] as const;

const MASCOT_COLORS = ["#767676", "#5f8cff", "#3fbf7f", "#ff8a3d", "#e5484d", "#a855f7"];

/* Read off the character package rather than listed here: a shape added there
 * shows up in the playground without this file being told about it. */
const SHAPES = Object.keys(MASCOT_SHAPES) as MascotShapeName[];

/*
 * The call that reproduces what the stage is showing, and only that call.
 *
 * Two rules, and they are the same rule: a prop the component would have
 * defaulted to anyway is not part of the answer, and a number is written to as
 * many places as a reader can act on. `JSON.stringify` broke both — it printed
 * every dial at every default and `2.7009489484713183` for a frequency that a
 * caller will type as 2.7. What comes out of this is copy-and-run JSX rather
 * than a dump of the component's state.
 *
 * The component's own defaults are what "unchanged" is measured against:
 * `size = 32`, no shape is the circle, no colour is the gisx neutral.
 */
const DEFAULT_SIZE = 32;
const DEFAULT_SHAPE: MascotShapeName = "circle";

/* The two fixed lines of the wiring. The third one is the call, which is built
 * per frame from the dials. The stylesheet is a side-effect import inside the
 * component, so there is never a second thing for a caller to remember. */
const INSTALL_LINE = "bun add @bakebot/react";
const IMPORT_LINE = 'import { GisxIcon } from "@bakebot/react";';

const near = (value: number) => String(Math.round(value * 100) / 100);

const springProp = (name: string, spring: SpringTuning) =>
  `    ${name}: { frequency: ${near(spring.frequency)}, damping: ${near(spring.damping)} },`;

const tuningProp = (tuning: MascotTuning) =>
  [
    "  tuning={{",
    ...SPRINGS.map((key) => springProp(key, tuning[key])),
    ...SCALARS.map(({ key }) => `    ${key}: ${near(tuning[key])},`),
    "  }}",
  ].join("\n");

/* Written the way the docs write it, not the way `JSON.stringify` would: the
 * payload arm is an object literal a reader can type, with its keys unquoted. */
const stateProp = (state: GisxIconPaneState) =>
  typeof state === "string" ? `"${state}"` : `{{ Exited: { code: ${state.Exited.code} } }}`;

/** Every prop that departs from a default, one to a line. State always leads. */
function propLines(
  paneState: GisxIconPaneState,
  shape: MascotShapeName,
  size: number,
  color: string,
  tuning: MascotTuning,
): string[] {
  const lines = [`  state=${stateProp(paneState)}`];
  if (shape !== DEFAULT_SHAPE) lines.push(`  shape="${shape}"`);
  if (size !== DEFAULT_SIZE) lines.push(`  size={${size}}`);
  if (color !== MASCOT_COLORS[0]) lines.push(`  config={{ color: "${color}" }}`);
  // Compared as written rather than by identity: a slider dragged back to the
  // number it started on is a tuning nobody needs to pass.
  if (tuningProp(tuning) !== tuningProp(DEFAULT_TUNING)) lines.push(tuningProp(tuning));
  return lines;
}

function preferredSurface(): Surface {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

const Term = ({ children }: { children: React.ReactNode }) => (
  <strong {...stylex.props(s.term)}>{children}</strong>
);

/**
 * The caller-facing surface, one prop to a line.
 *
 * Read off the package's own documentation rather than off its types: a type
 * says `number | undefined`, and what a caller needs to know about `size` is
 * that it is CSS pixels and that leaving it out gives 32.
 *
 * Ordered by how often a caller reaches for it rather than alphabetically, so
 * the first four rows are the ones a first integration touches. A null default
 * is the honest answer where there is no literal to copy: the component
 * decides, and the description says what it decides.
 */
const PROPS: readonly {
  name: string;
  type: string;
  /** The literal a caller can read, or null where the component decides. */
  defaultValue: string | null;
  description: string;
}[] = [
  {
    name: "state",
    type: "GisxIconPaneState",
    defaultValue: '"Idle"',
    description: "Pass pane state straight from your model, including the Exited payload.",
  },
  {
    name: "size",
    type: "number",
    defaultValue: "32",
    description: "Rendered width and height, in CSS pixels.",
  },
  {
    name: "shape",
    type: "MascotShapeName | TileSpec",
    defaultValue: '"circle"',
    description:
      "A named tile from MASCOT_SHAPES, or half extents and a corner radius of your own.",
  },
  {
    name: "reducedMotion",
    type: '"freeze" | "settle"',
    defaultValue: '"freeze"',
    description:
      "What happens under prefers-reduced-motion: freeze stops the simulation, settle keeps it alive on quieter dials.",
  },
  {
    name: "tuning",
    type: "Partial<MascotTuning>",
    defaultValue: "DEFAULT_TUNING",
    description: "Adjusts the motion. Every value is optional and clamped to stable limits.",
  },
  {
    name: "config",
    type: "{ color?: string }",
    defaultValue: null,
    description: "Visual overrides. color accepts any CSS colour; unset, the tile is neutral gray.",
  },
  {
    name: "gazeIntents",
    type: "readonly GazeIntent[]",
    defaultValue: null,
    description: "Where an alive mascot looks. Unset, each state's own preset runs. Exited stays shut.",
  },
  {
    name: "label",
    type: "string",
    defaultValue: null,
    description: "Accessible name. Unset, the mascot is decorative and hidden from assistive technology.",
  },
  {
    name: "seed",
    type: "number",
    defaultValue: null,
    description: "Fixes the random run for tests and captures. Unset, every instance differs.",
  },
];

/**
 * The writing, as the one list both the sidebar and the document read from.
 *
 * Kept as data rather than as markup in two places, so a section cannot exist
 * in the nav without existing on the page or the other way round. It is the
 * vocabulary from CONTEXT.md, cut to what someone turning these dials needs.
 */
const DOCS: readonly {
  id: string;
  title: string;
  body: React.ReactNode;
  /** The section's claim, drawn and measured. One card, one mascot of its own. */
  demo: (spec: SpecInput) => React.ReactNode;
}[] = [
  {
    id: "what",
    title: "What it is",
    body: (
      <>
        <p {...stylex.props(s.prose)}>
          One tile, two eyes, either alive or shut. The icon is a{" "}
          <Term>character</Term> rather than a picture: there is no clip, no
          sprite and no timeline. A physics simulation runs on its own clock and
          a renderer reads it once a frame, which is why the preview above never
          repeats a frame it has already played.
        </p>
        <p {...stylex.props(s.prose)}>
          Every dial in the composer is a real prop. Nothing on this page reaches
          past what the package exports.
        </p>
      </>
    ),
    demo: (spec) => <DriverCard {...spec} />,
  },
  {
    id: "state",
    title: "State",
    body: (
      <>
        <p {...stylex.props(s.prose)}>
          Pass the <Term>pane state</Term> whole, payload and all.{" "}
          <code {...stylex.props(s.code)}>{'{ Exited: { code: 0 } }'}</code> goes
          straight in: the mascot reads the name out of it, so you never write a
          converter first.
        </p>
        <p {...stylex.props(s.prose)}>
          Idle, Working, NeedsAttention, Notified and MaybeBlocked are all{" "}
          <Term>alive</Term>. Exited is the one that is not, because its pose has
          already closed the lids. Alive or shut is the whole signal.
        </p>
        <p {...stylex.props(s.prose)}>
          Every state also carries a <Term>pose</Term>: offsets and scales for
          the eyes and for the pair inside them, each written as a departure
          from rest. The pose belongs to the character rather than to a
          stylesheet, which is why both renderers at the end of this page apply
          the same one.
        </p>
      </>
    ),
    demo: (spec) => <PoseCard {...spec} />,
  },
  {
    id: "shape",
    title: "Shape and eyes",
    body: (
      <>
        <p {...stylex.props(s.prose)}>
          The <Term>tile</Term> is the shape the eyes live inside. Its border is
          how far the face can turn, and it is also the edge that clips whatever
          hangs over. Six tiles are named — square, rounded, squircle, circle,
          pill, card — and you can pass two half extents and a corner radius of
          your own instead. The names are shorthand for numbers, not modes:
          nothing in the simulation ever asks which shape it is in.
        </p>
        <p {...stylex.props(s.prose)}>
          The <Term>eyes</Term> are two discs on a shared sphere, moved as one
          mass. Their midpoint stays on the simulation origin, so yaw closes the
          gap between them, pitch tilts their baseline, and each disc narrows
          around its own rotated centre. A minimum seam keeps the two readable
          as a pair, and a half-width floor keeps both of them drawn at every
          angle the eyes can reach. That is enough to read as a turned face
          without a second translation or a 3D renderer.
        </p>
      </>
    ),
    demo: (spec) => <TravelCard {...spec} />,
  },
  {
    id: "motion",
    title: "Motion",
    body: (
      <>
        <p {...stylex.props(s.prose)}>
          <Term>Springs</Term>, described by frequency and damping ratio instead
          of duration. A look can be interrupted and redirected mid-flight
          rather than restarting, and those two numbers clamp into a region
          where the integrator is provably stable. Turn them in the composer and
          the mascot answers on the next frame, not on the next replay.
        </p>
        <p {...stylex.props(s.prose)}>
          The pair's centre stays inside a <Term>travel region</Term>: the tile,
          inset by the eyes' reach less their overshoot. Reach the boundary and
          the centre is put back on it, with only the part of the velocity that
          was leaving taken away. Nothing rebounds, so the face slides along the
          border instead of stopping dead. How far it has travelled is read as a{" "}
          <Term>turn</Term>, which is what makes a wide look read as looking
          rather than as a ball resting in a corner.
        </p>
        <p {...stylex.props(s.prose)}>
          <Term>Jelly</Term> stretches the pair along the way it is travelling
          and preserves area, so the mascot never gains visual weight. Ask for
          less motion and you get <Term>Settle</Term>: the same simulation on
          quieter dials, alive inside a widened deadzone with nothing crossing
          the tile. It is still running, only calmer.
        </p>
      </>
    ),
    demo: (spec) => <SpringCard {...spec} />,
  },
  {
    id: "use",
    title: "Use",
    body: (
      <>
        <p {...stylex.props(s.prose)}>
          One import and one prop. The mascot normalises names, payloads, size,
          gaze and colour itself, so there is no adapter to write. The install
          line, the import and the call that draws whatever the stage is showing
          are all under <Term>Get the code</Term>, at the top of this column.
        </p>

        <h3 {...stylex.props(s.h3)}>The call</h3>
        <p {...stylex.props(s.prose)}>
          Pass the pane state straight off the model. Styles ship with the
          component, so there is no stylesheet to import and nothing to
          configure before the first render.
        </p>
        <Code>
          {[
            'import { GisxIcon } from "@bakebot/react";',
            "",
            "<GisxIcon state={entry.attention.state} size={32} />",
          ].join("\n")}
        </Code>
        <p {...stylex.props(s.prose)}>
          Everything else is a departure from a default. The composer writes
          one for you as you turn it — the row above the writing is the call
          that reproduces what the stage is showing, and it prints only the
          props that are no longer at rest.
        </p>

        <h3 {...stylex.props(s.h3)}>The props</h3>
        <p {...stylex.props(s.prose)}>
          Every prop on <code {...stylex.props(s.code)}>GisxIconProps</code> is
          optional. Start with <code {...stylex.props(s.code)}>state</code>, then
          add only the controls your product needs — a dash under Default means
          the component decides.
        </p>
        <table {...stylex.props(s.propsTable)}>
          <thead {...stylex.props(s.propsHead)}>
            <tr>
              <th scope="col" {...stylex.props(s.propsHeading, s.propNameColumn)}>
                Prop
              </th>
              <th scope="col" {...stylex.props(s.propsHeading, s.propDefaultColumn)}>
                Default
              </th>
              <th scope="col" {...stylex.props(s.propsHeading, s.propDescriptionColumn)}>
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {PROPS.map(({ name, type, defaultValue, description }) => (
              <tr key={name} {...stylex.props(s.propRow)}>
                <th scope="row" {...stylex.props(s.propCell)}>
                  <code {...stylex.props(s.propName)}>{name}</code>
                  <code {...stylex.props(s.propType)}>{type}</code>
                </th>
                <td {...stylex.props(s.propCell, s.propDefaultCell)}>
                  <span {...stylex.props(s.propCellLabel)}>Default</span>
                  {defaultValue ? (
                    <code {...stylex.props(s.propDefault)}>{defaultValue}</code>
                  ) : (
                    <span {...stylex.props(s.propDefaultNone)}>—</span>
                  )}
                </td>
                <td {...stylex.props(s.propCell, s.propDescriptionCell)}>{description}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 {...stylex.props(s.h3)}>Reduced motion</h3>
        <p {...stylex.props(s.prose)}>
          <code {...stylex.props(s.code)}>prefers-reduced-motion: reduce</code>{" "}
          stops the simulation. That is the default, and it stays the default
          because stopping is the only mechanism the component offers for WCAG
          2.2.2. A caller who would rather keep the character alive asks for{" "}
          <code {...stylex.props(s.code)}>settle</code> instead: the same
          simulation on quieter dials inside a widened deadzone, which on a 32px
          icon is a fifth of a pixel of travel against Idle's eleven.
        </p>
        <Code>{'<GisxIcon state="Working" reducedMotion="settle" />'}</Code>

        <h3 {...stylex.props(s.h3)}>Two colours</h3>
        <p {...stylex.props(s.prose)}>
          <code {...stylex.props(s.code)}>config.color</code> is the tile. The
          eyes are filled from{" "}
          <code {...stylex.props(s.code)}>--gisx-eye-color</code>, which chains
          to the host application's{" "}
          <code {...stylex.props(s.code)}>--window-bg</code> where one is
          defined and falls back to a literal where none is — so they read as
          two holes in the tile rather than as two dots on it, and they stay
          visible in an app that has never heard of that token.
        </p>

        <h3 {...stylex.props(s.h3)}>Without React</h3>
        <p {...stylex.props(s.prose)}>
          <code {...stylex.props(s.code)}>@bakebot/core</code> is the same
          character with no renderer attached: one clock, the gaze scheduler,
          the blink cadence and a pose you can read. Advance it by the seconds
          that have actually elapsed and read a frame — what you draw it with is
          your business. Intents are what give it a life of its own; a mascot
          built without them holds still.
        </p>
        <Code>
          {[
            'import { createMascot, DEFAULT_GAZE_INTENTS } from "@bakebot/core";',
            "",
            "const mascot = createMascot({ intents: DEFAULT_GAZE_INTENTS });",
            "",
            "let previous = performance.now();",
            "requestAnimationFrame(function tick(time) {",
            "  mascot.advance((time - previous) / 1000);",
            "  previous = time;",
            "  const { x, y, yaw, pitch, lid } = mascot.pose();",
            "  draw(x, y, yaw, pitch, lid);",
            "  requestAnimationFrame(tick);",
            "});",
          ].join("\n")}
        </Code>
        <p {...stylex.props(s.prose)}>
          The canvas below is that package on its own. Both drawings take the
          same frame from the same driver, so the second renderer gets this
          mascot rather than one that looks like it.
        </p>
      </>
    ),
    demo: (spec) => <RendererCard {...spec} />,
  },
];

/* The document's last block, and the one thing the contents list watches that
 * is not a section of it. */
const COLOPHON = "colophon";

/**
 * Which section is being read, for the contents list to mark.
 *
 * The band is the top of the reading column rather than the whole of it: a
 * heading that has just arrived under the stage is the one a reader is at, and
 * a rule that waits for a section to fill the column would lag a screen
 * behind. Sections are observed rather than scroll-listened so the browser
 * does the measuring, and the root is the viewport — the document scrolls in a
 * column of its own, and an intersection is clipped by that column already.
 *
 * The footer is watched too, and by a second observer rather than the same
 * one, because it is answering a different question. A band across the top of
 * the column cannot reach the end of the column: at full scroll the footer is
 * resting on the bottom edge of the window, hundreds of pixels below the band,
 * and so is the last section's heading. Nothing is in the band down there. So
 * the footer is watched against the whole window instead — the tail rule —
 * and it only speaks when the band has nothing to say: a reader at the bottom
 * of the page is still reading the last thing the page said, and the list has
 * to go on pointing at that row rather than at whichever row happened to be
 * marked on the way down.
 */
function useCurrentSection(): string {
  const [current, setCurrent] = useState(DOCS[0]?.id ?? "");

  useEffect(() => {
    const sections = DOCS.map(({ id }) => document.getElementById(id)).filter(
      (node): node is HTMLElement => node !== null,
    );
    if (sections.length === 0) return;

    const inBand = new Set<string>();
    let atTail = false;
    const mark = () => {
      // The first in document order, so scrolling up marks the section being
      // scrolled back into rather than the one being left.
      const first = DOCS.find(({ id }) => inBand.has(id));
      if (first) setCurrent(first.id);
      else if (atTail) setCurrent(DOCS[DOCS.length - 1]?.id ?? "");
    };

    const spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        mark();
      },
      { rootMargin: "-88px 0px -62% 0px" },
    );
    for (const node of sections) spy.observe(node);

    const footer = document.getElementById(COLOPHON);
    const tail = footer
      ? new IntersectionObserver((entries) => {
          atTail = entries[entries.length - 1]?.isIntersecting ?? false;
          mark();
        })
      : null;
    if (footer && tail) tail.observe(footer);

    return () => {
      spy.disconnect();
      tail?.disconnect();
    };
  }, []);

  return current;
}

/**
 * Single letters, the way the docs site the composer is modelled on does it.
 *
 * A panel of dials in the corner is faster to reach by name than by pointer,
 * and the three worth naming are the three that change what the page *is*
 * rather than what the mascot is tuned like: the surface, the fold, and the
 * replay. Anything more would be a shortcut nobody remembers and a footer full
 * of keycaps. https://www.fluidfunctionalism.com/docs
 *
 * A modifier held means the key belongs to the browser, and a key pressed
 * inside a control belongs to the control — a slider takes Home and End, a
 * select takes the first letter of its options, and the page must not steal
 * either. The handlers are read through a ref so the listener is bound once
 * and still calls the current closures.
 */
function useKeys(handlers: Record<string, () => void>) {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      /* A key pressed inside an overlay belongs to the overlay. The panel a
       * dropdown or a colour picker opens holds focus itself and is a div, so
       * the check above does not cover it — and `c` typed at a menu of shapes
       * must not also fold the card the menu came out of. */
      if (target?.closest('[role="menu"], [role="dialog"]')) return;
      const run = latest.current[event.key.toLowerCase()];
      if (!run) return;
      event.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

function App() {
  const [tuning, setTuning] = useState<MascotTuning>(DEFAULT_TUNING);
  const [size, setSize] = useState(96);
  const [shape, setShape] = useState<MascotShapeName>("circle");
  const [paneState, setPaneState] = useState<GisxIconPaneState>("Idle");
  const [mascotColor, setMascotColor] = useState(MASCOT_COLORS[0]!);
  const [surface, setSurface] = useState<Surface>(preferredSurface);
  // Bumping the key remounts the mascots: the way to watch a state's entrance
  // again, because the simulation is continuous and does not otherwise restart.
  const [replay, setReplay] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [dials, setDials] = useState<DialGroup>("gaze");
  const [composing, setComposing] = useState(true);
  /* Read once, from the reader's last visit. `startSound` also delegates
   * cuelume's listeners at the document, which is why it runs here rather than
   * in an effect: one call, before the first press can land. */
  const [sounding, setSounding] = useState(startSound);
  const reading = useCurrentSection();

  /* Where the contents list's ground has to be. Measured off the row rather
   * than computed from an index, so a name that wraps or a font that loads
   * late moves the ground with it instead of leaving it behind. */
  const contents = useRef<HTMLElement>(null);
  const marker = useHighlight(contents, reading);

  const setSpring = (key: (typeof SPRINGS)[number], part: keyof SpringTuning, value: number) =>
    setTuning((current) => ({ ...current, [key]: { ...current[key], [part]: value } }));

  useKeys({
    t: () => setSurface((current) => (current === "dark" ? "light" : "dark")),
    c: () => setComposing((open) => !open),
    r: () => setReplay((n) => n + 1),
  });

  const common = { config: { color: mascotColor }, shape, size, tuning };

  const lines = propLines(paneState, shape, size, mascotColor, tuning);
  const snippet = `<GisxIcon\n${lines.join("\n")}\n/>`;
  /* The row shows the same props on one line, with the tuning block standing in
   * as a single token: the cell ellipsizes, and a wall of numbers would push
   * everything a reader can actually read off the end of it. */
  const summary = lines
    .map((line) => (line.startsWith("  tuning") ? "tuning={…}" : line.trim()))
    .join(" ");

  /* What the cards are all describing: the appearance the pane state resolves
   * to, and the dials beside it. One object, so a card cannot be looking at a
   * different mascot than the stage is. */
  const spec: SpecInput = {
    state: appearanceOf(paneState),
    shape,
    color: mascotColor,
    tuning,
  };

  return (
    <div
      {...stylex.props(
        s.page,
        s.mascotHost,
        surface === "dark" ? s.darkSurface : s.lightSurface,
        surfaces[surface],
      )}
    >
      <div {...stylex.props(s.shell)}>
        <ScrollArea as="aside" fade style={s.rail} viewportStyle={s.railInner}>
          {/* The brand alone now: the surface is something you customize, so
              its toggle went where the rest of the customizing is. */}
          <div {...stylex.props(s.railHead)}>
            <div {...stylex.props(s.brand)}>
              gisx <span {...stylex.props(s.brandSub)}>/ playground</span>
            </div>
          </div>

          <nav ref={contents} {...stylex.props(s.railGroup, s.navGroup)}>
            {/* One ground for the whole list, moved onto the row being read.
                Nothing until the first measurement lands, so it arrives on a
                row rather than sliding out of the corner on load. */}
            {marker ? (
              <span
                aria-hidden="true"
                {...stylex.props(s.navMark, s.readingGround, s.markAt(marker))}
              />
            ) : null}
            {DOCS.map(({ id, title }) => (
              <a
                aria-current={id === reading ? "true" : undefined}
                data-hl={id}
                href={`#${id}`}
                key={id}
                {...stylex.props(s.docLink, id === reading && s.docLinkOn)}
              >
                {title}
              </a>
            ))}
          </nav>

        </ScrollArea>

        {/* The dials, in the corner. The compact size theme is carried here
            rather than on the card itself, so the dock's own top padding reads
            the same 28 the controls inside it do and the card's first row lands
            on the line the brand and the stage header are already on. */}
        <div {...stylex.props(s.dock, compact)}>
          <Composer
            actions={
              <>
                {/* Off until asked for, and asked for here. A page that makes
                    noise before anyone has said yes to it is a page people
                    close, so the switch is the first thing sound needs — and
                    the reader's answer outlives the visit. */}
                <button
                  aria-label={
                    sounding ? "Turn interaction sounds off" : "Turn interaction sounds on"
                  }
                  aria-pressed={sounding}
                  onClick={() => {
                    const next = !sounding;
                    setSounding(next);
                    enableSound(next);
                  }}
                  type="button"
                  {...stylex.props(s.iconButton, sounding && s.iconButtonOn)}
                >
                  ♪
                </button>
                <button
                  aria-label={`Switch to ${surface === "dark" ? "light" : "dark"} surface`}
                  data-cuelume-toggle
                  onClick={() => setSurface(surface === "dark" ? "light" : "dark")}
                  type="button"
                  {...stylex.props(s.iconButton)}
                >
                  {surface === "dark" ? "☀" : "☾"}
                </button>
              </>
            }
            footer={
              <>
                <HoldToConfirm
                  confirmedLabel="Tuning reset"
                  duration={1200}
                  holdingLabel="Keep holding…"
                  onConfirm={() => setTuning(DEFAULT_TUNING)}
                >
                  Hold to reset
                </HoldToConfirm>
                <Keys>
                  <Key hint="Switch the surface">T</Key>
                  <Key hint="Fold the composer">C</Key>
                  <Key hint="Replay the state">R</Key>
                </Keys>
              </>
            }
            onOpenChange={setComposing}
            open={composing}
          >
            <ComposerGroup label="Mascot">
              {/* Drawn as well as named: the six tiles are the one thing in
                  this card a reader recognises faster than they read. */}
              <Dropdown
                icon={(option) => <ShapeGlyph shape={option} />}
                label="shape"
                menuLabel="tile"
                onChange={setShape}
                options={SHAPES}
                value={shape}
              />
              <Fader
                format={(reading) => String(Math.round(reading))}
                label="size"
                max={256}
                min={16}
                onChange={setSize}
                step={1}
                unit="px"
                value={size}
              />
              <ColorPicker
                label="color"
                onChange={setMascotColor}
                swatches={MASCOT_COLORS}
                value={mascotColor}
              />
            </ComposerGroup>

            <ComposerGroup label="Motion">
              <Tabs ariaLabel="Which dials" items={DIAL_GROUPS} onChange={setDials} value={dials}>
                {dials === "feel" ? (
                  SCALARS.map(({ key, min, max, step }) => (
                    <Fader
                      key={key}
                      label={key}
                      max={max}
                      min={min}
                      onChange={(value) => setTuning((current) => ({ ...current, [key]: value }))}
                      step={step}
                      value={tuning[key]}
                    />
                  ))
                ) : (
                  <>
                    {/* Frequency and damping, never a duration: that is what lets
                        a spring be interrupted and redirected mid-flight. */}
                    <Fader
                      label="frequency"
                      max={6}
                      min={0.3}
                      onChange={(value) => setSpring(dials, "frequency", value)}
                      step={0.05}
                      unit="Hz"
                      value={tuning[dials].frequency}
                    />
                    <Fader
                      label="damping"
                      max={4}
                      min={0.05}
                      onChange={(value) => setSpring(dials, "damping", value)}
                      step={0.05}
                      value={tuning[dials].damping}
                    />
                  </>
                )}
              </Tabs>
            </ComposerGroup>
          </Composer>
        </div>

        <ScrollArea
          as="main"
          barStyle={s.pageScrollbar}
          fade
          style={s.studio}
          viewportStyle={s.studioInner}
        >
          <section {...stylex.props(s.stage)}>
            <div {...stylex.props(s.stageBar)}>
              <span {...stylex.props(s.eyebrow)}>
                {`${stateName(paneState)} · ${shape} · ${size}px`}
              </span>
              <Button ghost onClick={() => setReplay((n) => n + 1)}>
                ↺ Replay
              </Button>
            </div>
            <div {...stylex.props(s.stageFrame)}>
              <div {...stylex.props(s.stageStand)}>
                <GisxIcon
                  key={`stage-${replay}`}
                  {...common}
                  label={stateName(paneState)}
                  state={paneState}
                />
              </div>

              {/* The dial that changes what is standing above it, on the
                  panel it is standing on. Six stops and nothing between them:
                  interior.dev's detents, with the pull radius collapsed to the
                  nearest stop because the stops are the whole range. */}
              <DetentSlider
                detents={STATE_NAMES}
                label="state"
                onChange={(name) => setPaneState(stateOf(name))}
                value={stateName(paneState)}
              />
            </div>

            {/* interior.dev's loading-button, driving the mascot: pending is
                Working, a resolve lands Notified, a rejection blocks. Off the
                card and in the compact tier — you run these at the mascot
                rather than setting it, and the running is incidental to the
                page the card is the subject of. */}
            <div {...stylex.props(s.stageRuns, compact)}>
              <LoadingButton
                onAction={() => new Promise((resolve) => setTimeout(resolve, 1800))}
                onStatus={(status) => {
                  if (status === "pending") setPaneState("Working");
                  else if (status === "success") setPaneState("Notified");
                  else if (status === "error") setPaneState("MaybeBlocked");
                }}
                pendingLabel="Working…"
                successLabel="Landed"
              >
                Run a task
              </LoadingButton>
              <LoadingButton
                onAction={() => {
                  throw new Error("canary failed");
                }}
                onStatus={(status) => {
                  if (status === "pending") setPaneState("Working");
                  else if (status === "success") setPaneState("Notified");
                  else if (status === "error") setPaneState("MaybeBlocked");
                }}
                pendingLabel="Working…"
              >
                Run a canary
              </LoadingButton>
            </div>
          </section>

          {/* Install, import, render — the whole of the wiring, folded away.
              The stage above is what the page is for; this is what you take
              home from it, and it is only worth the room once you want it. */}
          <section {...stylex.props(s.readout)}>
            <button
              aria-controls="readout-code"
              aria-expanded={showCode}
              onClick={() => setShowCode((open) => !open)}
              type="button"
              {...stylex.props(s.summary)}
            >
              <span {...stylex.props(s.caret, showCode && s.caretOpen)}>▶</span>
              Get the code
              <span {...stylex.props(s.summaryNote)}>
                {`install · ${lines.length} ${lines.length === 1 ? "prop" : "props"}`}
              </span>
            </button>

            {showCode ? (
              <div id="readout-code" {...stylex.props(s.drawer)}>
                <div {...stylex.props(s.step)}>
                  <span {...stylex.props(s.eyebrow)}>1 · Install</span>
                  <ClipboardField
                    copiedLabel="Install command copied"
                    copyLabel="Copy the install command"
                    value={INSTALL_LINE}
                  />
                  <p {...stylex.props(s.hint)}>
                    React 19 is the only peer, and{" "}
                    <code {...stylex.props(s.code)}>@bakebot/core</code> comes with it.
                    The component imports its own stylesheet, so there is nothing else to
                    add.
                  </p>
                </div>

                {/* The prompt is not a `$` on these two: neither line is
                    something you type at a shell. */}
                <div {...stylex.props(s.step)}>
                  <span {...stylex.props(s.eyebrow)}>2 · Import</span>
                  <ClipboardField
                    copiedLabel="Import copied"
                    copyLabel="Copy the import"
                    prompt="›"
                    value={IMPORT_LINE}
                  />
                </div>

                <div {...stylex.props(s.step)}>
                  <span {...stylex.props(s.eyebrow)}>3 · Render</span>
                  <ClipboardField
                    copiedLabel="Copied"
                    copyLabel="Copy this call"
                    label={`<GisxIcon ${summary} />`}
                    prompt="›"
                    value={snippet}
                  />
                  {/* The row copies it and ellipsizes it; the block is there to
                      be read. Nothing to read when the row is the whole call. */}
                  {lines.length > 1 ? (
                    <Code>{snippet}</Code>
                  ) : null}
                  <p {...stylex.props(s.hint)}>
                    Only the props that differ from a default. Every dial in the composer
                    lands here first.
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          <div {...stylex.props(s.docs)}>
            {DOCS.map(({ id, title, body, demo }) => (
              <section {...stylex.props(s.docSection)} id={id} key={id}>
                {/* The rail's ground, worn by the heading the rail is naming.
                    Same flag, same style — it fades here rather than travelling,
                    because two headings are a screen apart and a ground that
                    flew between them would be crossing the reading. */}
                <h2 {...stylex.props(s.h2, id === reading && s.readingGround)}>{title}</h2>
                {body}
                {demo(spec)}
              </section>
            ))}
          </div>

          <footer id={COLOPHON} {...stylex.props(s.colophon)}>
            <div {...stylex.props(s.colophonSlab)}>
              <span {...stylex.props(s.colophonBrand)}>
                <span {...stylex.props(s.colophonName)}>gisx-icon</span>
                <span>0.2.0 · MIT</span>
              </span>
              <nav {...stylex.props(s.colophonLinks)}>
                <a
                  href="https://github.com/Justar96/gisx-icon"
                  rel="noreferrer"
                  target="_blank"
                  {...stylex.props(s.colophonLink)}
                >
                  Source
                </a>
                <a
                  href="https://github.com/Justar96/gisx-icon/issues"
                  rel="noreferrer"
                  target="_blank"
                  {...stylex.props(s.colophonLink)}
                >
                  Issues
                </a>
                <a
                  href="https://www.npmjs.com/package/@bakebot/react"
                  rel="noreferrer"
                  target="_blank"
                  {...stylex.props(s.colophonLink)}
                >
                  npm
                </a>
              </nav>
            </div>
          </footer>
        </ScrollArea>
      </div>

      {/* Where every popover is parented. Inside the surface, so a menu opened
          over a near-black page reads the near-black tokens; outside every
          column, so nothing clips it or fades its edges. */}
      <div id={OVERLAY_HOST} />
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
