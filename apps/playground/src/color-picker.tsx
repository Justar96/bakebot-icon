import * as stylex from "@stylexjs/stylex";
import { useEffect, useId, useRef, useState } from "react";

import { Fader } from "./fader";
import { Popover } from "./popover";
import { tabStyles as tab } from "./tabs";
import { color, control, motion, radius, space, type } from "./tokens.stylex";
import { Swatch, styles as ui } from "./ui";

/**
 * The colour picker: a row that shows the colour, and a panel that changes it.
 *
 * Fluid Functionalism's anatomy, in its popover form: a trigger carrying a
 * label, a preview and the value; a panel holding the presets, the channels,
 * the notation the value is read in, and the eyedropper where the browser has
 * one. https://www.fluidfunctionalism.com/docs/color-picker
 *
 * Two departures from that component, both deliberate.
 *
 *   No alpha. The mascot's colour is the colour of a solid body — half of one
 *   is not a paler mascot, it is a mascot you can see the page through. A dial
 *   whose every value but one is wrong is not a dial.
 *
 *   No saturation-value area. The page already has a control that puts a name
 *   and a reading inside its own track, and three of them say hue, saturation
 *   and lightness in the vocabulary the rest of the composer is written in. A
 *   2D field would be the one control here that cannot be read, typed or
 *   arrowed — and it would say nothing the three faders do not.
 *
 * All four notations are here, and the field is the same field in each: what
 * you read is what you may type, and typing `oklch(70% 0.14 250)` sets the
 * same colour as dragging to it. The value handed out is always hex, because
 * it is also the value compared against the presets and printed in the call
 * the page copies — one canonical spelling, four ways to say it.
 *
 * Hue, saturation and lightness are held locally while the panel is open. The
 * round trip through hex is lossy in the last bit of each channel, so a fader
 * that re-derived its own position from the value it had just set would creep
 * as it was dragged. Local state creeps nowhere, and it resyncs the moment the
 * colour arrives from somewhere else — a preset, the eyedropper, the field.
 */

const FORMATS = [
  { value: "hex", label: "hex" },
  { value: "rgb", label: "rgb" },
  { value: "hsl", label: "hsl" },
  { value: "oklch", label: "oklch" },
] as const;

type Format = (typeof FORMATS)[number]["value"];

type Rgb = readonly [number, number, number];
type Hsl = readonly [number, number, number];

interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperCtor {
  new (): { open(): Promise<EyeDropperResult> };
}

/* ---- conversion ------------------------------------------------------- */

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const round = (value: number, places = 0) => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};

const hexOf = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, "0")).join("")}`;

function rgbOf(hex: string): Rgb {
  const digits = hex.trim().replace("#", "");
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((c) => c + c)
          .join("")
      : digits;
  const value = Number.parseInt(full.slice(0, 6), 16);
  return Number.isNaN(value)
    ? [0, 0, 0]
    : [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function hslOf([r, g, b]: Rgb): Hsl {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const span = max - min;
  const l = (max + min) / 2;
  if (span === 0) return [0, 0, l * 100];
  const s = span / (1 - Math.abs(2 * l - 1));
  const h =
    max === R
      ? ((G - B) / span + (G < B ? 6 : 0)) * 60
      : max === G
        ? ((B - R) / span + 2) * 60
        : ((R - G) / span + 4) * 60;
  return [h, s * 100, l * 100];
}

function rgbOfHsl([h, s, l]: Hsl): Rgb {
  const S = clamp(s, 0, 100) / 100;
  const L = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const turn = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((turn % 2) - 1));
  const [r, g, b] =
    turn < 1
      ? [c, x, 0]
      : turn < 2
        ? [x, c, 0]
        : turn < 3
          ? [0, c, x]
          : turn < 4
            ? [0, x, c]
            : turn < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = L - c / 2;
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/* OKLab, on Ottosson's own matrices. It is the one notation here that is not a
 * rearrangement of sRGB, which is the reason to carry it: equal steps in L are
 * equal steps in apparent lightness, and a hue held while L moves stays the
 * hue it was. https://bottosson.github.io/posts/oklab/ */
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function oklchOf([r, g, b]: Rgb): readonly [number, number, number] {
  const R = toLinear(r / 255);
  const G = toLinear(g / 255);
  const B = toLinear(b / 255);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.hypot(A, Bb);
  const hue = chroma < 1e-6 ? 0 : ((Math.atan2(Bb, A) * 180) / Math.PI + 360) % 360;
  return [L * 100, chroma, hue];
}

function rgbOfOklch([L, chroma, hue]: readonly [number, number, number]): Rgb {
  const rad = (hue * Math.PI) / 180;
  const A = chroma * Math.cos(rad);
  const Bb = chroma * Math.sin(rad);
  const lightness = L / 100;
  const l = (lightness + 0.3963377774 * A + 0.2158037573 * Bb) ** 3;
  const m = (lightness - 0.1055613458 * A - 0.0638541728 * Bb) ** 3;
  const s = (lightness - 0.0894841775 * A - 1.291485548 * Bb) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((channel) => clamp(toGamma(channel) * 255, 0, 255)) as unknown as Rgb;
}

/** The value, written the way the chosen notation writes it. */
function write(hex: string, format: Format): string {
  const rgb = rgbOf(hex);
  if (format === "hex") return hex;
  if (format === "rgb") return `rgb(${rgb.map((c) => Math.round(c)).join(" ")})`;
  if (format === "hsl") {
    const [h, s, l] = hslOf(rgb);
    return `hsl(${round(h)} ${round(s)}% ${round(l)}%)`;
  }
  const [L, chroma, hue] = oklchOf(rgb);
  return `oklch(${round(L, 1)}% ${round(chroma, 3)} ${round(hue, 1)})`;
}

/* Every notation but hex is three numbers in a wrapper, so every notation but
 * hex is parsed by pulling the three numbers out and reading them as the
 * format says. Forgiving on purpose: commas, spaces and a missing unit are all
 * somebody halfway through typing, not an error to reject. */
function read(text: string, format: Format): string | null {
  const input = text.trim();
  if (format === "hex" || input.startsWith("#")) {
    return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(input) ? hexOf(rgbOf(input)) : null;
  }
  const numbers = input.match(/-?\d*\.?\d+/g)?.map(Number);
  if (!numbers || numbers.length < 3) return null;
  const [a, b, c] = numbers as [number, number, number];
  if (format === "rgb") return hexOf([clamp(a, 0, 255), clamp(b, 0, 255), clamp(c, 0, 255)]);
  if (format === "hsl") return hexOf(rgbOfHsl([a, b, c]));
  return hexOf(rgbOfOklch([clamp(a, 0, 100), Math.max(0, b), c]));
}

/* ---- what a channel looks like ---------------------------------------- */

/* The three rails under the three faders. Written as CSS rather than derived,
 * because the browser interpolates them and it interpolates them in the space
 * the notation names: `hsl()` stops ramp round the hue wheel, which is the ramp
 * the dial above them is actually moving along.
 *
 * Saturation and lightness are drawn from the other two channels as they stand,
 * so the rails answer each other: turn the hue and both of the rails below it
 * turn with it, which is the whole reason for having them. */
const hslText = ([h, s, l]: Hsl) => `hsl(${round(h)} ${round(s)}% ${round(l)}%)`;

/* Six stops rather than a two-stop ramp: red to red the short way is a fade
 * through grey, and the wheel is what this dial travels. */
const HUE_RAIL =
  "linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))";

/* ---- the component ---------------------------------------------------- */

const s = stylex.create({
  trigger: {
    width: "100%",
    cursor: "pointer",
    textAlign: "start",
    outlineWidth: { default: 0, ":focus-visible": 2 },
  },
  triggerOpen: {
    backgroundColor: { default: color.line, ":hover": color.line },
  },
  /* The value in the colour it names, as the trigger's own preview. A ring
   * rather than a border, so a swatch the colour of the panel still reads as a
   * swatch. */
  preview: {
    flex: "none",
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    boxShadow: `0 0 0 1px ${color.lineStrong}`,
    transitionProperty: "background-color",
    transitionDuration: motion.moderateIn,
    transitionTimingFunction: motion.ease,
  },
  previewColor: (value: string) => ({ backgroundColor: value }),

  panel: {
    display: "flex",
    flexDirection: "column",
    gap: space.md,
    padding: space.md,
  },
  width: (width: number) => ({ minWidth: width }),
  /* The presets: one row, wrapping, on the region's own gap. */
  presets: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: control.gap },
  channels: { display: "flex", flexDirection: "column", gap: control.gap },
  /* The notation, and the field it governs: one answer written two ways rather
   * than two more dials.
   *
   * Nothing of its own holds it off the channels. There was a rule across here
   * once, and this padding was its clearance — but the rule went with every
   * other border on the page and the clearance stayed, so the panel paid
   * `panel`'s 12px gap *and* another 12 for a line that is not drawn: 24px of
   * nothing between the dials and the notation, in a panel padded 12. One
   * owner, and the ladder reads 12 between the groups against 8 inside them. */
  notation: {
    display: "flex",
    flexDirection: "column",
    gap: control.gap,
  },
  fieldRow: { display: "flex", alignItems: "center", gap: control.gap },
  field: {
    flex: 1,
    /* Wide enough for the longest reading it can ever hold, in the font's own
     * units: `oklch(100.0% 0.322 264.1)` is 25 characters, and one more is the
     * closing paren's air. It was `minWidth: 0`, which let the row shrink the
     * field to whatever was left after the eyedropper — so the one notation
     * worth having a picker for was the one you had to scroll to read. The
     * panel is this wide in every notation rather than only in oklch, because
     * a panel that resizes when you change how a colour is spelled has moved
     * the thing you were about to click. */
    minWidth: "26ch",
    height: control.height,
    paddingInline: control.padX,
    borderRadius: radius.md,
    /* Borderless, so hover is the ground moving: it deepens a step rather than
     * lightening toward the panel it would otherwise vanish into. */
    backgroundColor: { default: color.raised, ":hover": color.line },
    color: color.ink,
    fontFamily: type.mono,
    fontSize: control.text,
    outlineWidth: { default: 0, ":focus-visible": 2 },
    outlineStyle: "solid",
    outlineColor: color.accent,
    outlineOffset: 2,
    transitionProperty: "background-color, outline-width",
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.ease,
  },
  /* Only where the browser has one. Hidden rather than disabled: a control
   * that can never work is not a control the reader should have to read.
   * https://www.fluidfunctionalism.com/docs/color-picker */
  dropper: {
    display: "inline-flex",
    flex: "none",
    alignItems: "center",
    justifyContent: "center",
    width: control.height,
    height: control.height,
    borderRadius: radius.md,
    backgroundColor: { default: color.raised, ":hover": color.line },
    color: { default: color.dim, ":hover": color.ink },
    cursor: "pointer",
    outlineWidth: { default: 0, ":focus-visible": 2 },
    outlineStyle: "solid",
    outlineColor: color.accent,
    outlineOffset: 2,
    transitionProperty: "background-color, color, outline-width",
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.ease,
  },
  dropperIcon: { width: control.icon, height: control.icon },
});

export const colorPickerStyles = s;

export function ColorPicker({
  label,
  value,
  onChange,
  swatches = [],
}: {
  label: string;
  /** A `#rrggbb`, and what every notation below is written from. */
  value: string;
  onChange: (value: string) => void;
  swatches?: readonly string[];
}) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const trigger = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(0);
  const [format, setFormat] = useState<Format>("hex");
  const [hsl, setHsl] = useState<Hsl>(() => hslOf(rgbOf(value)));
  /* What is being typed, while it is being typed. `null` means the field is
   * showing the value rather than a draft of one. */
  const [draft, setDraft] = useState<string | null>(null);

  /* Resync only when the colour came from somewhere other than these faders.
   * Deliberately not keyed on `hsl`: this compares the value that arrived
   * against the one the faders would have produced. */
  useEffect(() => {
    if (hexOf(rgbOfHsl(hsl)).toLowerCase() === value.toLowerCase()) return;
    setHsl(hslOf(rgbOf(value)));
  }, [value]);

  const [hasDropper] = useState(() => typeof window !== "undefined" && "EyeDropper" in window);

  const setChannel = (at: 0 | 1 | 2, reading: number) => {
    const next = hsl.map((channel, index) => (index === at ? reading : channel)) as unknown as Hsl;
    setHsl(next);
    onChange(hexOf(rgbOfHsl(next)));
  };

  const pick = async () => {
    const Dropper = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper;
    try {
      const { sRGBHex } = await new Dropper().open();
      onChange(hexOf(rgbOf(sRGBHex)));
    } catch {
      /* Dismissed. A picker the reader backed out of has nothing to report. */
    }
  };

  const shown = draft ?? write(value, format);

  return (
    <>
      <button
        aria-controls={open ? `${id}-panel` : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${label}, ${value}`}
        data-cuelume-toggle
        onClick={() => {
          setWidth(trigger.current?.offsetWidth ?? 0);
          setOpen(!open);
        }}
        ref={trigger}
        type="button"
        {...stylex.props(ui.select, s.trigger, open && s.triggerOpen)}
      >
        <span {...stylex.props(ui.selectLabel)}>{label}</span>
        <span {...stylex.props(ui.selectValue)}>
          <span {...stylex.props(s.preview, s.previewColor(value))} />
          {value}
        </span>
      </button>

      <Popover
        anchor={trigger}
        id={`${id}-panel`}
        label={label}
        onClose={() => setOpen(false)}
        open={open}
        role="dialog"
      >
        <div {...stylex.props(s.panel, width > 0 && s.width(Math.max(width, 240)))}>
          {swatches.length > 0 ? (
            <div aria-label="Presets" role="group" {...stylex.props(s.presets)}>
              {swatches.map((preset) => (
                <Swatch
                  key={preset}
                  on={preset.toLowerCase() === value.toLowerCase()}
                  onClick={() => onChange(preset)}
                  value={preset}
                />
              ))}
            </div>
          ) : null}

          <div {...stylex.props(s.channels)}>
            <Fader
              format={(reading) => String(Math.round(reading))}
              label="hue"
              max={360}
              min={0}
              onChange={(reading) => setChannel(0, reading)}
              rail={HUE_RAIL}
              step={1}
              unit="°"
              value={hsl[0]}
            />
            <Fader
              format={(reading) => String(Math.round(reading))}
              label="saturation"
              max={100}
              min={0}
              onChange={(reading) => setChannel(1, reading)}
              rail={`linear-gradient(to right, ${hslText([hsl[0], 0, hsl[2]])}, ${hslText([hsl[0], 100, hsl[2]])})`}
              step={1}
              unit="%"
              value={hsl[1]}
            />
            <Fader
              format={(reading) => String(Math.round(reading))}
              label="lightness"
              max={100}
              min={0}
              onChange={(reading) => setChannel(2, reading)}
              rail={`linear-gradient(to right, ${hslText([hsl[0], hsl[1], 0])}, ${hslText([hsl[0], hsl[1], 50])}, ${hslText([hsl[0], hsl[1], 100])})`}
              step={1}
              unit="%"
              value={hsl[2]}
            />
          </div>

          <div {...stylex.props(s.notation)}>
            <div aria-label="Notation" role="group" {...stylex.props(tab.strip)}>
              {FORMATS.map((option) => (
                <button
                  aria-pressed={option.value === format}
                  key={option.value}
                  onClick={() => {
                    setFormat(option.value);
                    setDraft(null);
                  }}
                  type="button"
                  {...stylex.props(tab.tab, option.value === format && tab.tabOn)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div {...stylex.props(s.fieldRow)}>
              <input
                aria-label={`${label} as ${format}`}
                onBlur={() => setDraft(null)}
                onChange={(event) => {
                  setDraft(event.target.value);
                  const parsed = read(event.target.value, format);
                  if (parsed) onChange(parsed);
                }}
                spellCheck={false}
                value={shown}
                {...stylex.props(s.field)}
              />
              {hasDropper ? (
                <button
                  aria-label="Pick a colour from the screen"
                  onClick={pick}
                  type="button"
                  {...stylex.props(s.dropper)}
                >
                  <svg
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    viewBox="0 0 16 16"
                    {...stylex.props(s.dropperIcon)}
                  >
                    <path d="M10.5 2.5a1.75 1.75 0 0 1 2.475 2.475l-.9.9 1.05 1.05-1.4 1.4-1.05-1.05-4.3 4.3-2.6.6.6-2.6 4.3-4.3-1.05-1.05 1.4-1.4 1.05 1.05.9-.9Z" />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </Popover>
    </>
  );
}
