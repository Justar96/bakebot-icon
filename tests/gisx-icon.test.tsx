import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ATTENTIVE_GAZE_INTENTS,
  GisxIcon,
  type GazeIntent,
  type GisxIconPaneState,
} from "../src/index";

function paneStateName(state: GisxIconPaneState): string {
  return typeof state === "string" ? state : "Exited";
}

/** Model values, in the shape the wire actually delivers them. */
const STATES: GisxIconPaneState[] = [
  "Idle",
  "Working",
  "NeedsAttention",
  "Notified",
  "MaybeBlocked",
  { Exited: { code: 1 } },
];

describe("the gisx mascot", () => {
  it("projects every pane state onto the same two-circle eye", () => {
    for (const state of STATES) {
      const html = renderToStaticMarkup(<GisxIcon state={state} />);
      expect(html).toContain(`data-state="${paneStateName(state)}"`);
      expect(html.match(/<circle/g)).toHaveLength(2);
      expect(html.match(/class="gisx-icon__outer"/g)).toHaveLength(1);
      expect(html.match(/class="gisx-icon__inner"/g)).toHaveLength(1);
    }
  });

  it("takes a model value whole, payload and all", () => {
    // The wiring a caller writes is `state={entry.attention.state}`. If the
    // icon needed a flattened name first, every call site would carry its own
    // conversion and one of them would eventually differ.
    const html = renderToStaticMarkup(<GisxIcon state={{ Exited: { code: 130 } }} />);
    expect(html).toContain('data-state="Exited"');
    // The code belongs to whatever shows the exit, not to the mascot.
    expect(html).not.toContain("130");
  });

  it("stays alive in every state but the one whose pose has shut the eye", () => {
    // `data-live` turns off the state transition on the motion layers, so it
    // has to agree with whether the simulation is actually running. A pose and
    // a transition writing the same property is the defect it prevents.
    for (const state of STATES) {
      const html = renderToStaticMarkup(<GisxIcon state={state} />);
      expect(html.includes('data-live=""')).toBe(paneStateName(state) !== "Exited");
    }
  });

  it("is decorative by default and can carry an accessible name", () => {
    expect(renderToStaticMarkup(<GisxIcon />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<GisxIcon label="gisx is working" />)).toContain(
      'aria-label="gisx is working"',
    );
  });

  it("keeps neutral gray by default and accepts a configured colour", () => {
    const defaultIcon = renderToStaticMarkup(<GisxIcon state="NeedsAttention" />);
    const configuredIcon = renderToStaticMarkup(<GisxIcon config={{ color: "#5f8cff" }} />);

    expect(defaultIcon).not.toContain("--gisx-icon-color");
    expect(configuredIcon).toContain("--gisx-icon-color:#5f8cff");
  });

  it("accepts a custom set of points of interest", () => {
    const gazeIntents: readonly GazeIntent[] = [
      { x: 2, y: -2, hold: 0.5 },
      { x: -2, y: 2, hold: 0.8 },
    ];

    expect(renderToStaticMarkup(<GisxIcon gazeIntents={gazeIntents} />)).toContain(
      'data-state="Idle"',
    );
    expect(renderToStaticMarkup(<GisxIcon gazeIntents={ATTENTIVE_GAZE_INTENTS} />)).toContain(
      'data-live=""',
    );
  });

  it("carries no motion into the served markup", () => {
    // Motion is simulated after mount, so the mascot ships undeformed
    // and every other state is CSS alone.
    expect(renderToStaticMarkup(<GisxIcon />)).not.toContain("transform");
  });

  it("keeps state poses separate from live simulation transforms", () => {
    const html = renderToStaticMarkup(<GisxIcon />);

    expect(html).toContain('class="gisx-icon__state-pose"');
    expect(html).toContain('class="gisx-icon__eye-motion"');
    expect(html).toContain('class="gisx-icon__state-expression"');
    expect(html).toContain('class="gisx-icon__expression-motion"');
    expect(html).toContain('class="gisx-icon__pupil-pose"');
    expect(html).toContain('class="gisx-icon__pupil-motion"');
  });

  it("sanitises a degenerate size to the default instead of emitting NaN", () => {
    // A plain-JS caller can pass anything; an invalid width would otherwise
    // reach the DOM and React would warn about NaN attributes.
    expect(renderToStaticMarkup(<GisxIcon size={Number.NaN} />)).toContain('width="32"');
    expect(renderToStaticMarkup(<GisxIcon size={0} />)).toContain('width="32"');
    expect(renderToStaticMarkup(<GisxIcon size={-16} />)).toContain('height="32"');
    expect(renderToStaticMarkup(<GisxIcon size={48} />)).toContain('width="48"');
  });

  it("degrades an unknown runtime state to a neutral, still mascot", () => {
    // A state added to the wire before the icon knows it must not crash the
    // mascot or leave it half-alive: no gaze means no simulation and no
    // data-live, and the pose stays the neutral default.
    const unknown = "Booting" as unknown as GisxIconPaneState;
    const html = renderToStaticMarkup(<GisxIcon state={unknown} />);

    expect(html).toContain('data-state="Booting"');
    expect(html).not.toContain("data-live");
    expect(html.match(/<circle/g)).toHaveLength(2);
  });
});
