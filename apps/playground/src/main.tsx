import * as stylex from "@stylexjs/stylex";
import { type CSSProperties, Fragment, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  DEFAULT_TUNING,
  GisxIcon,
  type GisxIconPaneState,
  type MascotTuning,
  type SpringTuning,
} from "gisx-icon";

import { type Accent, type Surface, accents, surfaces } from "./themes.stylex";
import { color, radius, space } from "./tokens.stylex";
import { Button, Panel, Preview, Section, Segmented, Slider, Swatch, styles as s } from "./ui";

/**
 * The design-system playground, on the design system it is tuning against.
 *
 * Laid out as documentation: a sidebar of sections, one column of prose, and
 * a framed live preview per idea. Two things are exercised. The mascot's
 * dials, as before — every control writes a public prop. And the tokens: the
 * page is styled only through `tokens.stylex.ts`, and a theme click swaps a
 * token group under the whole tree, mascot included, since it reads `--text`
 * and `--window-bg` and the root forwards those from the active theme.
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

const SPRINGS = ["gaze", "pupil", "jellyFree", "jellyContact"] as const;
const SCALARS = [
  { key: "squish", min: 0, max: 3, step: 0.05 },
  { key: "restlessness", min: 0, max: 4, step: 0.05 },
  { key: "blinkInterval", min: 0.2, max: 12, step: 0.1 },
  { key: "blinkSpread", min: 0, max: 12, step: 0.1 },
  { key: "shellDeadzone", min: 0, max: 30, step: 0.5 },
] as const;

const MASCOT_COLORS = ["#767676", "#5f8cff", "#3fbf7f", "#ff8a3d", "#e5484d", "#a855f7"];

const ACCENT_PREVIEW: Record<Accent, string> = {
  blue: "#2f6fed",
  green: "#1f9d62",
  orange: "#e5732a",
  red: "#d83a3f",
  violet: "#8b5cf6",
};

const NAV = [
  ["theme", "Theme"],
  ["tokens", "Tokens"],
  ["primitives", "Primitives"],
  ["states", "Pane states"],
  ["idle", "Idle crowd"],
  ["tuning", "Tuning"],
] as const;

/* Read what each token resolves to on the live root, so the inspector shows
 * what the theme actually produced rather than what was typed. */
function useResolvedTokens(
  ref: React.RefObject<HTMLElement | null>,
  group: object,
  key: string,
) {
  const [values, setValues] = useState<[string, string][]>([]);
  useEffect(() => {
    if (!ref.current) return;
    const computed = getComputedStyle(ref.current);
    const next: [string, string][] = [];
    for (const [name, variable] of Object.entries(group)) {
      const v = String(variable);
      if (!v.startsWith("var(")) continue;
      next.push([name, computed.getPropertyValue(v.slice(4, -1)).trim()]);
    }
    setValues(next);
  }, [ref, group, key]);
  return values;
}

function preferredSurface(): Surface {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function App() {
  const [tuning, setTuning] = useState<MascotTuning>(DEFAULT_TUNING);
  const [size, setSize] = useState(96);
  const [mascotColor, setMascotColor] = useState(MASCOT_COLORS[0]!);
  const [surface, setSurface] = useState<Surface>(preferredSurface);
  const [accent, setAccent] = useState<Accent>("blue");
  // Bumping the key remounts the mascots: the way to watch a state's entrance
  // again, because the simulation is continuous and does not otherwise restart.
  const [replay, setReplay] = useState(0);

  const pageRef = useRef<HTMLDivElement>(null);
  const resolved = useResolvedTokens(pageRef, color, `${surface}/${accent}`);
  const spaces = useResolvedTokens(pageRef, space, "");

  const setSpring = (key: (typeof SPRINGS)[number], part: keyof SpringTuning, value: number) =>
    setTuning((current) => ({ ...current, [key]: { ...current[key], [part]: value } }));

  // The mascot's stylesheet reaches for the host's `--text` and `--window-bg`.
  // Forwarding the tokens keeps the eye legible on either surface.
  const hostVars = {
    "--text": color.ink,
    "--window-bg": color.bg,
    colorScheme: surface,
  } as CSSProperties;

  return (
    <div
      ref={pageRef}
      {...stylex.props(s.page, surfaces[surface], accents[accent])}
      style={hostVars}
    >
      <div {...stylex.props(s.shell)}>
        <aside {...stylex.props(s.sidebar)}>
          <div {...stylex.props(s.brand)}>
            <GisxIcon size={18} state="Idle" />
            gisx <span {...stylex.props(s.brandSub)}>/ playground</span>
          </div>
          <nav {...stylex.props(s.navGroup)}>
            <span {...stylex.props(s.navLabel)}>Sections</span>
            {NAV.map(([id, label]) => (
              <a href={`#${id}`} key={id} {...stylex.props(s.navLink)}>
                {label}
              </a>
            ))}
          </nav>
          <div {...stylex.props(s.sidebarFoot)}>
            <span {...stylex.props(s.eyebrow)}>Surface</span>
            <Segmented onChange={setSurface} options={["light", "dark"]} value={surface} />
          </div>
        </aside>

        <main {...stylex.props(s.main)}>
          <header>
            <h1 {...stylex.props(s.h1)}>The gisx mascot, on StyleX</h1>
            <p {...stylex.props(s.lede)}>
              One tile, one living eye, and the design system it sits in. Every control here writes
              a public prop; every colour on this page is a token. Motion appears only where it
              carries information, and never on a control you would use all day.
            </p>
          </header>

          <Section
            id="theme"
            intro={
              <>
                Themes are <code {...stylex.props(s.code)}>createTheme</code> classes over one{" "}
                <code {...stylex.props(s.code)}>defineVars</code> group. Surface and accent are
                separate axes so they compose; the mascot follows because the root forwards{" "}
                <code {...stylex.props(s.code)}>--text</code> and{" "}
                <code {...stylex.props(s.code)}>--window-bg</code> from the active tokens.
              </>
            }
            title="Theme"
          >
            <Preview
              actions={
                <>
                  {(Object.keys(accents) as Accent[]).map((option) => (
                    <Swatch
                      key={option}
                      on={option === accent}
                      onClick={() => setAccent(option)}
                      value={ACCENT_PREVIEW[option]}
                    />
                  ))}
                </>
              }
              note="Surface switch animates at 220ms so the eye can follow the ground changing. Accent does not: it is a swatch you may click repeatedly."
            >
              <GisxIcon label="Idle" size={72} state="Idle" tuning={tuning} />
              <Button onClick={() => {}}>Secondary</Button>
              <Button on onClick={() => {}}>
                Primary
              </Button>
              <Segmented onChange={setSurface} options={["light", "dark"]} value={surface} />
            </Preview>
          </Section>

          <Section
            id="tokens"
            intro="What the current theme resolves each colour token to, read off the live DOM. Spacing and radius are fixed scales; a theme cannot change them."
            title="Tokens"
          >
            <div {...stylex.props(s.grid)}>
              <Panel legend="color">
                <div {...stylex.props(s.tokenTable)}>
                  {resolved.map(([name, value]) => (
                    <Fragment key={name}>
                      <span {...stylex.props(s.tokenChip)} style={{ background: value }} />
                      <span {...stylex.props(s.tokenName)}>{name}</span>
                      <span {...stylex.props(s.tokenValue)}>{value}</span>
                    </Fragment>
                  ))}
                </div>
              </Panel>
              <Panel legend="space">
                <div {...stylex.props(s.tokenTable)}>
                  {spaces.map(([step, value]) => (
                    <Fragment key={step}>
                      <span {...stylex.props(s.tokenName)}>{step}</span>
                      <span {...stylex.props(s.scaleBar)} style={{ width: value }} />
                      <span {...stylex.props(s.tokenValue)}>{value}</span>
                    </Fragment>
                  ))}
                </div>
              </Panel>
              <Panel legend="radius">
                <div {...stylex.props(s.chips)}>
                  {(["sm", "md", "lg", "pill"] as const).map((step) => (
                    <span
                      key={step}
                      {...stylex.props(s.tokenChip)}
                      style={{ width: 36, height: 36, borderRadius: radius[step] }}
                      title={step}
                    />
                  ))}
                </div>
              </Panel>
            </div>
          </Section>

          <Section
            id="primitives"
            intro="The controls the playground is built from. None of them animate: a slider is dragged and a swatch is clicked too often for a transition to be anything but lag."
            title="Primitives"
          >
            <Preview note="Button, segmented control, swatch, slider. Hover and pressed states are colour changes with no duration.">
              <div {...stylex.props(s.chips)}>
                <Button onClick={() => {}}>Button</Button>
                <Button on onClick={() => {}}>
                  Selected
                </Button>
                <Button ghost onClick={() => {}}>
                  Ghost
                </Button>
              </div>
              <Segmented onChange={() => {}} options={["one", "two", "three"]} value="two" />
              <div {...stylex.props(s.chips)}>
                {MASCOT_COLORS.map((option, index) => (
                  <Swatch key={option} on={index === 1} onClick={() => {}} value={option} />
                ))}
              </div>
              <div style={{ width: 280 }}>
                <Slider label="damping" max={4} min={0} onChange={() => {}} step={0.05} value={1} />
              </div>
            </Preview>
            <details {...stylex.props(s.details)}>
              <summary {...stylex.props(s.summary)}>How a primitive is written</summary>
              <pre {...stylex.props(s.pre)}>{`import * as stylex from "@stylexjs/stylex";
import { color, radius, type } from "./tokens.stylex";

const s = stylex.create({
  button: {
    height: 28,
    borderRadius: radius.md,
    borderColor: { default: color.line, ":hover": color.lineStrong },
    backgroundColor: { default: color.panel, ":hover": color.raised },
    fontSize: type.sm,
  },
});

<button {...stylex.props(s.button)} />`}</pre>
            </details>
          </Section>

          <Section
            id="states"
            intro="Every pane state under the same tuning. The eye is one simulation, so a dial changes the character mid-motion rather than restarting it. Replay remounts them to watch an entrance again."
            title="Pane states"
          >
            <Preview
              actions={
                <Button ghost onClick={() => setReplay((n) => n + 1)}>
                  ↺ Replay
                </Button>
              }
              note="The mascot is the one thing here that moves, because motion is the information: it is alive or it is shut."
            >
              {STATES.map((state) => (
                <figure key={`${stateName(state)}-${replay}`} {...stylex.props(s.figure)}>
                  <GisxIcon
                    config={{ color: mascotColor }}
                    label={stateName(state)}
                    size={size}
                    state={state}
                    tuning={tuning}
                  />
                  <figcaption {...stylex.props(s.caption)}>{stateName(state)}</figcaption>
                </figure>
              ))}
            </Preview>
          </Section>

          <Section
            id="idle"
            intro={
              <>
                Each draws its own seed and clock phase, so they do not blink together. Pass{" "}
                <code {...stylex.props(s.code)}>seed</code> to pin one.
              </>
            }
            title="Idle crowd"
          >
            <Preview note="Six independent runs of the same tuning.">
              {Array.from({ length: 6 }, (_, index) => (
                <GisxIcon
                  config={{ color: mascotColor }}
                  key={`${index}-${replay}`}
                  size={size}
                  tuning={tuning}
                />
              ))}
            </Preview>
          </Section>

          <Section
            id="tuning"
            intro="Springs are frequency and damping, not durations. Everything below is a public prop."
            title="Tuning"
          >
            <div {...stylex.props(s.grid)}>
              {SPRINGS.map((key) => (
                <Panel key={key} legend={key}>
                  <Slider
                    label="frequency (Hz)"
                    max={6}
                    min={0.3}
                    onChange={(value) => setSpring(key, "frequency", value)}
                    step={0.05}
                    value={tuning[key].frequency}
                  />
                  <Slider
                    label="damping ratio"
                    max={4}
                    min={0.05}
                    onChange={(value) => setSpring(key, "damping", value)}
                    step={0.05}
                    value={tuning[key].damping}
                  />
                </Panel>
              ))}

              <Panel legend="character">
                {SCALARS.map(({ key, min, max, step }) => (
                  <Slider
                    key={key}
                    label={key}
                    max={max}
                    min={min}
                    onChange={(value) => setTuning((current) => ({ ...current, [key]: value }))}
                    step={step}
                    value={tuning[key]}
                  />
                ))}
              </Panel>

              <Panel legend="presentation">
                <Slider label="size (px)" max={256} min={16} onChange={setSize} step={1} value={size} />
                <div {...stylex.props(s.chips)} style={{ paddingBlock: 8 }}>
                  {MASCOT_COLORS.map((option) => (
                    <Swatch
                      key={option}
                      on={option === mascotColor}
                      onClick={() => setMascotColor(option)}
                      value={option}
                    />
                  ))}
                </div>
                <Button onClick={() => setTuning(DEFAULT_TUNING)}>Reset tuning</Button>
              </Panel>
            </div>

            <details {...stylex.props(s.details)}>
              <summary {...stylex.props(s.summary)}>Current tuning as a prop</summary>
              <pre {...stylex.props(s.pre)}>{`tuning={${JSON.stringify(tuning, null, 2)}}`}</pre>
            </details>
          </Section>
        </main>
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
