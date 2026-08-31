import * as stylex from "@stylexjs/stylex";
import {
  facingEyes,
  type GisxIconState,
  type MascotShapeName,
  type MascotTuning,
  type SpringTuning,
} from "@bakebot/react";
import { useEffect, useRef, type ReactNode } from "react";

import { bp, DimH, DimV, Handles, Leader, Note, project, Stage, Window, type Projection } from "./blueprint";
import { drawMascot } from "./canvas-mascot";
import {
  fixed,
  LiveGroup,
  LiveMascot,
  LiveSpan,
  LiveText,
  useFrames,
  useSpec,
  type Frame,
  type MascotSpec,
} from "./live-frame";
import { styles as s } from "./ui";

/**
 * A spec card: the character drawn as a measured drawing, annotated with the
 * arithmetic that placed it and updating every frame.
 *
 * One card per section of the writing, and each one is the section's claim made
 * checkable. The numbers are not a debug overlay bolted onto a demo — they are
 * the same values the drawing was built from, read off one mascot mounted from
 * `@bakebot/core`, so a reading that disagreed with the picture would be a
 * bug in the package rather than in the card. They live in the drawing, against
 * the thing each one measures; one line underneath names the card's own figure
 * and nothing else. A column of readings under every drawing was a debug
 * overlay, and a card is not that.
 *
 * Almost nothing is quoted from inside the package. The tile, the pair's reach
 * and radius, the azimuth it sits at, its minimum gap and the lid's closure all
 * arrive through `mascotGeometry`, and the turn a full look holds is the angle
 * that azimuth implies — a quarter turn less the azimuth is where the far disc
 * reaches the silhouette. Two numbers are not on the public surface: how far
 * the eye's rim may hang past its tile, and how much gentler pitch is than yaw.
 * Both are checked rather than trusted, by `turn` below: it recomputes the turn
 * from them and puts the package's own answer beside it every frame. Retune
 * either in core and the travel card says so with a cross instead of quietly
 * drawing the wrong region.
 */

/* How far past the tile's border the eye's rim may go, and how much of yaw the
 * pitch is. `geometry.ts`, and checked rather than assumed — see `turn`. */
const OVERSHOOT = 6;
const PITCH_SHARE = 0.6;

/* The driver's clamp on one frame, which the strip on the first card is drawn
 * against: a frame longer than this buys no more steps. */
const MAX_DELTA = 1 / 15;

const round = (value: number) => Math.round(value * 1000) / 1000;
const clamp = (value: number, low: number, high: number) =>
  value < low ? low : value > high ? high : value;

/** The tile, the travel region inside it, and the full turn at its border. */
function regionOf(spec: MascotSpec) {
  const { tile, eyes } = spec.geometry;
  /* A full horizontal look is the one that puts the far disc on the sphere's
   * silhouette, which is a quarter turn less the azimuth it sits at. So the
   * turn is the pair's own geometry rather than a number chosen beside it. */
  const yawMax = 90 - (eyes.azimuth * 180) / Math.PI;
  /* `reach + radius` is the pair's bounding circle, which is what the travel
   * region is measured from — both halves off the public geometry rather than
   * a radius written down again. */
  const eyeRadius = eyes.reach + eyes.radius;
  const inset = eyeRadius - OVERSHOOT;
  const halfX = tile.width / 2;
  const halfY = tile.height / 2;
  return {
    eyeRadius,
    inset,
    halfX,
    halfY,
    yawMax,
    pitchMax: yawMax * PITCH_SHARE,
    travelHalfX: halfX - inset,
    travelHalfY: halfY - inset,
    travelRadius: clamp(tile.radius - inset, 0, Math.min(halfX - inset, halfY - inset)),
  };
}

/* ---- the frame every card wears --------------------------------------- */

function Card({
  title,
  note,
  figure,
  children,
}: {
  title: string;
  note: string;
  figure: ReactNode;
  children: ReactNode;
}) {
  return (
    <div {...stylex.props(s.spec)}>
      <div {...stylex.props(s.specHead)}>
        <span {...stylex.props(s.specTitle)}>{title}</span>
        <span {...stylex.props(s.specNote)}>{note}</span>
      </div>
      <div {...stylex.props(s.specFigure)}>{figure}</div>
      <div {...stylex.props(s.specRows)}>{children}</div>
    </div>
  );
}

/**
 * One line of the readout: what it is, how it is arrived at, what it says now.
 *
 * `read` is a value the clock writes and `value` one the spec already knows.
 * A row has exactly one of them, which is also the distinction the card is
 * making — a number that changes sixty times a second and a number that
 * changed when you turned a dial are different kinds of fact.
 */
function Row({
  name,
  formula,
  read,
  value,
}: {
  name: string;
  formula?: string;
  read?: (frame: Frame, spec: MascotSpec) => string;
  value?: ReactNode;
}) {
  return (
    <>
      <span {...stylex.props(s.specKey)}>{name}</span>
      <span {...stylex.props(s.specFormula)}>{formula}</span>
      {read ? (
        <LiveSpan {...stylex.props(s.specValue, s.specLive)} read={read} />
      ) : (
        <span {...stylex.props(s.specValue)}>{value}</span>
      )}
    </>
  );
}

/* ---- the character, as a measured drawing ------------------------------ */

/* One layout for every card: a 64-unit window with room either side for the
 * annotations. The margins are what fix the width — a label is quoted in card
 * pixels, so a margin of 114 is a margin of twenty monospace characters, and
 * every note below is written to fit one. */
const LAYOUT = { width: 400, height: 224 };
const WINDOW = project(126, 30, 2.3);

/** One disc of the pair, placed the way both shipped renderers place it. */
function Disc({ side }: { side: 0 | 1 }) {
  const { geometry } = useSpec();
  return (
    <LiveGroup
      read={(frame, spec) => {
        const disc = facingEyes(frame.pose.yaw, frame.pose.pitch, spec.geometry)[side];
        const { close, drop } = spec.geometry.lid;
        const rotation = (disc.rotation * Math.PI) / 180;
        const verticalScale = Math.hypot(
          disc.scaleX * Math.sin(rotation),
          disc.scaleY * Math.cos(rotation),
        );
        const lidDrop = frame.pose.lid * drop * verticalScale;
        return (
          // Blink is screen-vertical outside the rotated ellipse, as it is in
          // both shipped renderers; the drop keeps its lower rim in place.
          `translate(${round(disc.x)} ${round(disc.y + lidDrop)}) ` +
          `scale(1 ${round(1 - frame.pose.lid * close)}) ` +
          `rotate(${round(disc.rotation)}) ` +
          `scale(${round(disc.scaleX)} ${round(disc.scaleY)})`
        );
      }}
    >
      <circle {...stylex.props(bp.outline, bp.hair)} r={geometry.eyes.radius} />
    </LiveGroup>
  );
}

/**
 * The mascot in outline, with the transform stack it is actually drawn by.
 *
 * The nesting is the one in `drawMascot` and in the SVG binding, in the same
 * order: the state's pose around the whole face, the simulation's translation,
 * the jelly axis, then the state's pose of the pair. Nothing is clipped, which
 * is the one departure — a renderer cuts the eye off at the tile, and here the
 * part that hangs over the border is the thing being measured.
 */
function Outline({ at }: { at: Projection }) {
  const { geometry, statePose } = useSpec();
  const { tile, centre } = geometry;
  return (
    <Window at={at}>
      <rect
        {...stylex.props(bp.outline, bp.hair)}
        height={tile.height}
        rx={tile.radius}
        width={tile.width}
        x={tile.x}
        y={tile.y}
      />
      <g
        transform={
          `translate(${centre + statePose.eyeX} ${centre + statePose.eyeY}) ` +
          `scale(${statePose.eyeScaleX} ${statePose.eyeScaleY})`
        }
      >
        <LiveGroup read={(frame) => `translate(${round(frame.pose.x)} ${round(frame.pose.y)})`}>
          <LiveGroup
            read={({ pose }) =>
              `rotate(${round(pose.angle)}) scale(${round(pose.stretch)} ${round(pose.squash)}) ` +
              `rotate(${round(-pose.angle)})`
            }
          >
            <g
              transform={
                `translate(0 ${statePose.pairY}) ` +
                `scale(${statePose.pairScaleX} ${statePose.pairScaleY})`
              }
            >
              <Disc side={0} />
              <Disc side={1} />
            </g>
          </LiveGroup>
        </LiveGroup>
      </g>
    </Window>
  );
}

/** The eye's centre, which is the one point every other number is read from. */
function Crosshair({ at }: { at: Projection }) {
  return (
    <g transform={`translate(${at.x(32)} ${at.y(32)})`}>
      <LiveGroup
        read={({ pose }) =>
          `translate(${round(at.scale(pose.x))} ${round(at.scale(pose.y))})`
        }
      >
        <g {...stylex.props(bp.dim)}>
          <line x1={-7} x2={7} y1={0} y2={0} />
          <line x1={0} x2={0} y1={-7} y2={7} />
        </g>
        <circle {...stylex.props(bp.accent)} cx={0} cy={0} r={1.8} />
        <LiveText
          {...stylex.props(bp.label, bp.reading)}
          read={({ pose }) => `${fixed(pose.x, 1)}, ${fixed(pose.y, 1)}`}
          x={10}
          y={-6}
        />
      </LiveGroup>
    </g>
  );
}

/* ---- what it is: the read loop ---------------------------------------- */

const STRIP = { y: 198, height: 7 };

export function DriverCard(props: SpecInput) {
  return (
    <Held {...props} seed={7}>
      <Card
        figure={
          <Stage {...LAYOUT}>
            <Outline at={WINDOW} />
            <Crosshair at={WINDOW} />
            <Handles
              height={WINDOW.bottom - WINDOW.top}
              width={WINDOW.right - WINDOW.left}
              x={WINDOW.left}
              y={WINDOW.top}
            />
            <DimH from={WINDOW.left} label="64 view units" to={WINDOW.right} y={WINDOW.top - 12} />
            <Note anchor="end" x={WINDOW.left - 12} y={WINDOW.top + 14}>
              advance(Δt)
            </Note>
            <Note anchor="end" x={WINDOW.left - 12} y={WINDOW.top + 27}>
              pose()
            </Note>
            <Leader from={[WINDOW.left - 10, WINDOW.top + 24]} to={[WINDOW.left + 8, WINDOW.top + 40]} />

            {/* The frame the browser handed over, against the clamp it is
              * taken under. Each tick below the bar is one fixed 1/240 s step,
              * so a full bar is the sixteen steps a 1/15 s frame can buy. */}
            <Note x={WINDOW.left} y={STRIP.y - 8}>
              Δt
            </Note>
            <LiveText
              {...stylex.props(bp.label, bp.reading)}
              read={({ delta, steps }) => `${fixed(delta * 1000, 1)} ms → ${steps} steps`}
              x={WINDOW.left + 18}
              y={STRIP.y - 8}
            />
            <g transform={`translate(${WINDOW.left} ${STRIP.y})`}>
              <LiveGroup
                read={({ delta }) => `scale(${round(clamp(delta / MAX_DELTA, 0, 1))} 1)`}
              >
                <rect
                  {...stylex.props(bp.accent, s.specBar)}
                  height={STRIP.height}
                  width={WINDOW.right - WINDOW.left}
                />
              </LiveGroup>
              <rect
                {...stylex.props(bp.guide)}
                height={STRIP.height}
                width={WINDOW.right - WINDOW.left}
              />
              <g {...stylex.props(bp.dim)}>
                {Array.from({ length: 16 }, (_, index) => {
                  const x = ((index + 1) * (WINDOW.right - WINDOW.left)) / 16;
                  return <line key={index} x1={x} x2={x} y1={STRIP.height} y2={STRIP.height + 3} />;
                })}
              </g>
            </g>
            <Note anchor="end" x={WINDOW.right} y={STRIP.y + STRIP.height + 14}>
              min(Δt, 1/15 s)
            </Note>
          </Stage>
        }
        note="one clock, read once a frame"
        title="driver"
      >
        <Row
          formula="what requestAnimationFrame gave the driver"
          name="Δt"
          read={({ delta }) => `${fixed(delta * 1000, 2)} ms`}
        />
      </Card>
    </Held>
  );
}

/* ---- state: the pose stack -------------------------------------------- */

export function PoseCard(props: SpecInput) {
  return (
    <Held {...props} seed={11}>
      <PoseCardBody />
    </Held>
  );
}

function PoseCardBody() {
  const spec = useSpec();
  const pose = spec.statePose;
  const at = WINDOW;
  const rest = at.y(32);
  const posed = at.y(32 + pose.eyeY);
  return (
    <Card
      figure={
        <Stage {...LAYOUT}>
          {/* Rest, dashed, and the state's departure from it, solid. */}
          <Window at={at}>
            <g {...stylex.props(bp.guide, bp.hair)}>
              {facingEyes(0, 0, spec.geometry).map((disc, index) => (
                <circle
                  cx={spec.geometry.centre + disc.x}
                  cy={spec.geometry.centre + disc.y}
                  key={index}
                  r={spec.geometry.eyes.radius}
                />
              ))}
            </g>
          </Window>
          <Outline at={at} />
          {/* Only the departures are dimensioned. A state that does not move
            * the eyes has nothing to measure there, and a zero-length
            * dimension line reads as a mark rather than as a measurement. */}
          {pose.eyeY === 0 ? null : (
            <DimV from={rest} label={`eyeY ${fixed(pose.eyeY, 1)}`} right to={posed} x={at.right + 14} />
          )}
          {pose.eyeX === 0 ? null : (
            <DimH
              below
              from={at.x(32)}
              label={`eyeX ${fixed(pose.eyeX, 1)}`}
              to={at.x(32 + pose.eyeX)}
              y={at.bottom + 14}
            />
          )}
          <Note anchor="end" x={at.left - 12} y={at.y(22)}>
            {`pair ${fixed(pose.pairScaleX, 2)} × ${fixed(pose.pairScaleY, 2)}`}
          </Note>
          <Note anchor="end" x={at.left - 12} y={at.y(22) + 13}>
            {`eye ${fixed(pose.eyeScaleX, 2)} × ${fixed(pose.eyeScaleY, 2)}`}
          </Note>
          <Note anchor="end" x={at.left - 12} y={at.y(22) + 30}>
            lid
          </Note>
          <LiveText
            {...stylex.props(bp.label, bp.reading)}
            read={({ pose: live }) => fixed(live.lid, 2)}
            textAnchor="end"
            x={at.left - 12}
            y={at.y(22) + 43}
          />
          <Leader from={[at.left - 10, at.y(22) + 40]} to={[at.x(24), at.y(30)]} />
        </Stage>
      }
      note="a state's shape, and the life inside it"
      title={`pose · ${spec.state}`}
    >
      <Row
        formula="STATE_POSE[state] — a departure from REST_POSE"
        name="eyeX, eyeY"
        value={`${fixed(pose.eyeX, 2)}, ${fixed(pose.eyeY, 2)}`}
      />
    </Card>
  );
}

/* ---- shape: the travel region ----------------------------------------- */

export function TravelCard(props: SpecInput) {
  return (
    <Held {...props} seed={13}>
      <TravelCardBody />
    </Held>
  );
}

function TravelCardBody() {
  const spec = useSpec();
  const at = WINDOW;
  const { tile } = spec.geometry;
  const region = regionOf(spec);
  const travel = {
    x: 32 - region.travelHalfX,
    y: 32 - region.travelHalfY,
    width: region.travelHalfX * 2,
    height: region.travelHalfY * 2,
  };
  return (
    <Card
      figure={
        <Stage {...LAYOUT}>
          <Outline at={at} />
          <Window at={at}>
            {/* Where the eye's centre may go: the tile, inset. */}
            <rect
              {...stylex.props(bp.guide, bp.hair)}
              height={travel.height}
              rx={region.travelRadius}
              width={travel.width}
              x={travel.x}
              y={travel.y}
            />
          </Window>
          <Crosshair at={at} />
          <DimH
            from={at.x(tile.x)}
            label={`${fixed(tile.width, 0)} × ${fixed(tile.height, 0)}  r${fixed(tile.radius, 0)}`}
            to={at.x(tile.x + tile.width)}
            y={at.top - 12}
          />
          <DimH
            below
            from={at.x(travel.x)}
            label={`travel ${fixed(travel.width, 0)} × ${fixed(travel.height, 0)}`}
            to={at.x(travel.x + travel.width)}
            y={at.bottom + 16}
          />
          <DimV
            from={at.y(tile.y)}
            label={`inset ${fixed(region.inset, 0)}`}
            to={at.y(travel.y)}
            x={at.left - 16}
          />
          <Note anchor="end" x={at.left - 16} y={at.y(34)}>
            {`eye ${fixed(region.eyeRadius, 0)}`}
          </Note>
          <Note anchor="end" x={at.left - 16} y={at.y(34) + 13}>
            {`− overshoot ${OVERSHOOT}`}
          </Note>
          {/* The turn, recomputed from the region drawn here and checked against
            * the package's own answer. The tick is the identity holding, and so
            * is the evidence that this is the region the eye is really confined
            * to — the two numbers behind it are not on the public surface. */}
          <Note x={at.right + 10} y={at.top + 6}>
            {`yaw ${fixed(region.yawMax, 0)}°×x/${fixed(region.travelHalfX, 0)}`}
          </Note>
          <LiveText
            {...stylex.props(bp.label, bp.reading)}
            read={({ pose }) => turn(pose.x, pose.yaw, region.yawMax, region.travelHalfX)}
            x={at.right + 10}
            y={at.top + 19}
          />
          <Note x={at.right + 10} y={at.top + 36}>
            {`pitch ${fixed(region.pitchMax, 0)}°×y/${fixed(region.travelHalfY, 0)}`}
          </Note>
          <LiveText
            {...stylex.props(bp.label, bp.reading)}
            read={({ pose }) => turn(pose.y, pose.pitch, region.pitchMax, region.travelHalfY)}
            x={at.right + 10}
            y={at.top + 49}
          />
          <Note x={at.right + 10} y={at.top + 66}>
            ✓ = matches pose()
          </Note>
        </Stage>
      }
      note="where the pair's centre may go"
      title={`travel · ${spec.shape}`}
    >
      <Row
        formula="mascotGeometry(shape).tile — what a renderer draws"
        name="tile"
        value={`${fixed(tile.width, 0)} × ${fixed(tile.height, 0)}  r ${fixed(tile.radius, 0)}`}
      />
    </Card>
  );
}

/**
 * One turn, ours against the package's.
 *
 * The rule is the documented one — a full turn at the border, linear on the way
 * — evaluated here from the region above rather than read off `pose`. Printing
 * ours and ticking it against theirs is what keeps the two constants this file
 * has to quote from drifting quietly.
 */
const turn = (offset: number, reported: number, max: number, half: number): string => {
  const ours = half > 0 ? max * clamp(offset / half, -1, 1) : 0;
  return `${fixed(ours, 1)}° ${Math.abs(ours - reported) < 0.01 ? "✓" : `✗ ${fixed(reported, 1)}°`}`;
};

/* ---- motion: the springs ---------------------------------------------- */

const SIM_STEP = 1 / 240;
/* Semi-implicit Euler is stable while ω·h stays under about two. Every card
 * below quotes its margin to that, which is the reason the caller-facing dials
 * are frequency and ratio rather than stiffness and damping. */
const STABILITY_LIMIT = 2;

const springOf = (spring: SpringTuning) => {
  const angular = 2 * Math.PI * spring.frequency;
  return {
    angular,
    stiffness: angular * angular,
    damping: 2 * spring.damping * angular,
    step: angular * SIM_STEP,
  };
};

const SPRING_NAMES = ["gaze", "jellyFree", "jellyContact"] as const;

export function SpringCard(props: SpecInput) {
  return (
    <Held {...props} seed={17}>
      <SpringCardBody />
    </Held>
  );
}

function SpringCardBody() {
  const spec = useSpec();
  const springs = SPRING_NAMES.map((name) => ({ name, ...springOf(spec.tuning[name]) }));
  const jelly = { x: 102, y: 112, radius: 40 };
  const bars = { x: 232, width: 130, top: 62, gap: 30 };
  return (
    <Card
      figure={
        <Stage {...LAYOUT}>
          {/* The jelly, as the one shape it is: a circle taken onto an axis,
            * scaled along it, and taken back. Area is what does not change. */}
          <circle
            {...stylex.props(bp.guide)}
            cx={jelly.x}
            cy={jelly.y}
            r={jelly.radius}
          />
          <g transform={`translate(${jelly.x} ${jelly.y})`}>
            <LiveGroup
              read={({ pose }) =>
                `rotate(${round(pose.angle)}) scale(${round(pose.stretch)} ${round(pose.squash)})`
              }
            >
              <circle {...stylex.props(bp.outline, bp.hair)} r={jelly.radius} />
            </LiveGroup>
            <LiveGroup read={({ pose }) => `rotate(${round(pose.angle)})`}>
              <g {...stylex.props(bp.dim)}>
                <line x1={-jelly.radius - 10} x2={jelly.radius + 10} y1={0} y2={0} />
              </g>
            </LiveGroup>
          </g>
          <Note anchor="middle" x={jelly.x} y={jelly.y - jelly.radius - 26}>
            stretch × squash
          </Note>
          <LiveText
            {...stylex.props(bp.label, bp.reading)}
            read={({ pose }) =>
              `${fixed(pose.stretch, 3)} × ${fixed(pose.squash, 3)} = ${fixed(pose.stretch * pose.squash, 3)}`
            }
            textAnchor="middle"
            x={jelly.x}
            y={jelly.y - jelly.radius - 13}
          />
          <LiveText
            {...stylex.props(bp.label, bp.reading)}
            read={({ pose }) => `axis ${fixed(pose.angle, 1)}°`}
            textAnchor="middle"
            x={jelly.x}
            y={jelly.y + jelly.radius + 22}
          />

          {/* Stability, one bar a spring: ω·h against the limit the
            * integrator holds to. The dials cannot reach it. */}
          <Note x={bars.x} y={bars.top - 16}>
            ω·h against 2
          </Note>
          {springs.map((spring, index) => {
            const y = bars.top + index * bars.gap;
            const width = (spring.step / STABILITY_LIMIT) * bars.width;
            return (
              <g key={spring.name}>
                <Note x={bars.x} y={y - 4}>
                  {spring.name}
                </Note>
                <rect {...stylex.props(bp.guide)} height={7} width={bars.width} x={bars.x} y={y} />
                <rect
                  {...stylex.props(bp.accent, s.specBar)}
                  height={7}
                  width={Math.max(width, 1)}
                  x={bars.x}
                  y={y}
                />
                <Note reading x={bars.x + bars.width + 6} y={y + 7}>
                  {fixed(spring.step, 3)}
                </Note>
              </g>
            );
          })}
          <DimH
            below
            from={bars.x}
            label="stable region"
            to={bars.x + bars.width}
            y={bars.top + 3 * bars.gap - 8}
          />
        </Stage>
      }
      note="frequency and ratio, never a duration"
      title="springs"
    >
      {springs.map((spring) => (
        <Row
          formula={`f ${fixed(spec.tuning[spring.name].frequency, 2)} Hz · ζ ${fixed(spec.tuning[spring.name].damping, 2)} → ω = 2πf, k = ω², c = 2ζω`}
          key={spring.name}
          name={spring.name}
          value={`k ${fixed(spring.stiffness, 1)}  c ${fixed(spring.damping, 1)}`}
        />
      ))}
    </Card>
  );
}

/* ---- use: one pose, two renderers ------------------------------------- */

/** The canvas binding, drawing the frame the wireframe beside it is drawing. */
function CanvasFrame({ size }: { size: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const context = useRef<CanvasRenderingContext2D | null>(null);
  const eyes = useRef("#fbfbfd");
  const spec = useSpec();

  /* The eyes read as two holes in the tile, so they take the colour of the
   * window behind it — `--window-bg`, the same custom property the stylesheet
   * resolves `--gisx-eye-color` from. CSS hands the SVG binding that for free;
   * a canvas has to ask. Read after every render so a theme change lands. */
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const surface = getComputedStyle(element).getPropertyValue("--window-bg").trim();
    if (surface) eyes.current = surface;
  });

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = element.height = Math.round(size * ratio);
    element.style.width = element.style.height = `${size}px`;
    const drawing = element.getContext("2d");
    context.current = drawing;
    if (!drawing) return;
    const scale = (size * ratio) / spec.geometry.view;
    drawing.setTransform(scale, 0, 0, scale, 0, 0);
  }, [size, spec.geometry.view]);

  useFrames((frame) => {
    const drawing = context.current;
    if (!drawing) return;
    drawMascot(
      drawing,
      frame.pose,
      spec.statePose,
      { tile: spec.color, eyes: eyes.current },
      spec.geometry,
    );
  });

  return <canvas ref={canvas} />;
}

const RENDERER_WINDOW = project(4, 4, 2.3);

export function RendererCard(props: SpecInput) {
  return (
    <Held {...props} seed={19}>
      <Card
        figure={
          <div {...stylex.props(s.specPair)}>
            <div {...stylex.props(s.specPairItem, s.specPairFrame)}>
              <Stage height={155} width={155}>
                <Outline at={RENDERER_WINDOW} />
              </Stage>
              <span {...stylex.props(s.specFormula)}>svg, in outline</span>
            </div>
            <div {...stylex.props(s.specPairItem)}>
              <CanvasFrame size={147} />
              <span {...stylex.props(s.specFormula)}>canvas 2d, off core</span>
            </div>
          </div>
        }
        note="every field a renderer consumes"
        title="pose()"
      >
        <Row formula="the eyes' offset from the icon centre" name="x, y" read={({ pose }) => `${fixed(pose.x, 3)}, ${fixed(pose.y, 3)}`} />
      </Card>
    </Held>
  );
}

/* ---- what a card is handed --------------------------------------------- */

export interface SpecInput {
  state: GisxIconState;
  shape: MascotShapeName;
  color: string;
  tuning: MascotTuning;
}

/** Each card runs its own mascot on a fixed seed, so its numbers are its own. */
function Held({ children, seed, ...spec }: SpecInput & { seed: number; children: ReactNode }) {
  return (
    <LiveMascot {...spec} seed={seed}>
      {children}
    </LiveMascot>
  );
}
