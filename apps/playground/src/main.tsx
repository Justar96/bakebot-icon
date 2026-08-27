import { useState } from "react";
import { createRoot } from "react-dom/client";

import {
  DEFAULT_TUNING,
  GisxIcon,
  type GisxIconPaneState,
  type MascotTuning,
  type SpringTuning,
} from "gisx-icon";

/**
 * The tuning surface, driven live.
 *
 * This exists to answer the one question source reading cannot: whether a
 * given set of dials actually *looks* like a living mascot. Every control below
 * writes the same public props a consumer has, so anything achievable here is
 * achievable from outside the package.
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

const COLORS = ["#767676", "#5f8cff", "#3fbf7f", "#ff8a3d", "#e5484d", "#a855f7"];

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider">
      <span className="slider__label">{label}</span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <output>{value.toFixed(2)}</output>
    </label>
  );
}

function App() {
  const [tuning, setTuning] = useState<MascotTuning>(DEFAULT_TUNING);
  const [size, setSize] = useState(96);
  const [color, setColor] = useState(COLORS[0]!);

  const setSpring = (key: (typeof SPRINGS)[number], part: keyof SpringTuning, value: number) =>
    setTuning((current) => ({ ...current, [key]: { ...current[key], [part]: value } }));

  return (
    <main>
      <header>
        <h1>gisx mascot</h1>
        <p>
          Every control is a public prop. The physics is one simulation, so a dial changes the
          character mid-motion rather than restarting it.
        </p>
      </header>

      <section>
        <h2>Every pane state, one tuning</h2>
        <div className="row">
          {STATES.map((state) => (
            <figure key={stateName(state)}>
              <GisxIcon
                config={{ color }}
                label={stateName(state)}
                size={size}
                state={state}
                tuning={tuning}
              />
              <figcaption>{stateName(state)}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section>
        <h2>Six Idle mascots</h2>
        <p className="hint">
          Each draws its own seed and its own clock phase, so they do not blink together. Pass{" "}
          <code>seed</code> to pin one.
        </p>
        <div className="row">
          {Array.from({ length: 6 }, (_, index) => (
            <GisxIcon config={{ color }} key={index} size={size} tuning={tuning} />
          ))}
        </div>
      </section>

      <section className="controls">
        <h2>Tuning</h2>

        <div className="grid">
          {SPRINGS.map((key) => (
            <fieldset key={key}>
              <legend>{key}</legend>
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
            </fieldset>
          ))}

          <fieldset>
            <legend>character</legend>
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
          </fieldset>

          <fieldset>
            <legend>presentation</legend>
            <Slider
              label="size (px)"
              max={256}
              min={16}
              onChange={setSize}
              step={1}
              value={size}
            />
            <div className="swatches">
              {COLORS.map((option) => (
                <button
                  aria-label={option}
                  className={option === color ? "swatch swatch--on" : "swatch"}
                  key={option}
                  onClick={() => setColor(option)}
                  style={{ background: option }}
                  type="button"
                />
              ))}
            </div>
            <button className="reset" onClick={() => setTuning(DEFAULT_TUNING)} type="button">
              Reset tuning
            </button>
          </fieldset>
        </div>

        <details>
          <summary>Current tuning as a prop</summary>
          <pre>{`tuning={${JSON.stringify(tuning, null, 2)}}`}</pre>
        </details>
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
