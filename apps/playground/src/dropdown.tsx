import * as stylex from "@stylexjs/stylex";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { useHighlight } from "./highlight";
import { Popover } from "./popover";
import { color, control, motion, radius, space, type } from "./tokens.stylex";
import { styles as ui } from "./ui";

/**
 * A dropdown: the row that says what is chosen, and the menu that changes it.
 *
 * It replaces the native select this row used to be. A native select keeps the
 * platform's popup, which is the right trade until the thing being chosen has
 * a picture — a tile shape cannot be drawn in an `<option>`, and a list of six
 * shape names is a list of six words for something the reader would recognise
 * instantly if it were drawn. So the menu is ours, and the price is the
 * keyboard, which is paid below in full.
 *
 * Fluid Functionalism's anatomy, and its defaults: a trigger, a content panel
 * six pixels off it and aligned to its start edge, and menu items that carry
 * an icon, a label and a checked mark. One background travels to the item
 * under the pointer instead of each item lighting up where it stands — which
 * is what makes a menu read as one surface with a cursor on it.
 * https://www.fluidfunctionalism.com/docs/dropdown
 *
 * The trigger is the page's own control row, borrowed rather than restyled:
 * the same border, ground, height and padding as the fader and the colour
 * picker beside it, so three different controls read as three rows of one
 * panel. Only the focus ring is respelled — the ring belonged to a wrapper
 * around a hidden input, and this trigger is the button itself.
 *
 * Keyboard, per the menu pattern: the panel holds focus and names the active
 * item through `aria-activedescendant`, arrows and Home/End move it, Enter and
 * Space take it, typing jumps to what it spells, and Tab or Escape leave. No
 * item is ever focused itself, which is what keeps one travelling background
 * honest as the cursor.
 */

const REDUCED = "@media (prefers-reduced-motion: reduce)";

/* How long a typed prefix stands before the next keystroke starts a new one. */
const TYPEAHEAD_IDLE = 600;

const s = stylex.create({
  /* Laid over the borrowed select row: a real button, so the ring is its own
   * rather than a `:has()` on a wrapper, and the row is a full-width target. */
  trigger: {
    width: "100%",
    cursor: "pointer",
    textAlign: "start",
    outlineWidth: { default: 0, ":focus-visible": 2 },
  },
  /* Open is the hover state held: the row a menu is hanging off should not
   * look untouched the moment the pointer moves into that menu. */
  triggerOpen: {
    backgroundColor: { default: color.line, ":hover": color.line },
  },
  caret: {
    transitionProperty: { default: "transform", [REDUCED]: "none" },
    transitionDuration: motion.fastOut,
    transitionTimingFunction: motion.ease,
  },
  caretOpen: { transform: "rotate(180deg)", transitionDuration: motion.fastIn },

  /* ---- the menu -------------------------------------------------------- */
  /* The items' `offsetParent`, which is what makes the highlight's numbers
   * relative to the list rather than to the page. */
  list: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    padding: space.xs,
    maxHeight: "min(320px, 60vh)",
    overflowY: "auto",
    scrollbarWidth: "thin",
  },
  width: (width: number) => ({ minWidth: width }),
  /* The one background, under every item. Landing on a mark, so: the moderate
   * tier on the curve that settles without crossing it. Reduced motion keeps
   * the highlight and drops the travel. */
  glow: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 0,
    borderRadius: radius.md,
    backgroundColor: color.raised,
    pointerEvents: "none",
    transitionProperty: { default: "transform, width, height", [REDUCED]: "none" },
    transitionDuration: motion.moderateIn,
    transitionTimingFunction: motion.critical,
  },
  glowAt: (top: number, left: number, width: number, height: number) => ({
    transform: `translate(${left}px, ${top}px)`,
    width,
    height,
  }),
  item: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    gap: control.gap,
    width: "100%",
    height: control.height,
    paddingInline: `calc(${control.padX} - ${space.xs})`,
    borderWidth: 0,
    borderRadius: radius.md,
    backgroundColor: "transparent",
    color: color.dim,
    fontSize: control.text,
    fontWeight: 500,
    textAlign: "start",
    cursor: "pointer",
    outlineStyle: "none",
    transitionProperty: "color",
    transitionDuration: motion.fastIn,
    transitionTimingFunction: motion.ease,
  },
  /* Under the cursor, wherever the cursor came from. The background is the
   * layer above; this is only the type coming up to full ink. */
  itemActive: { color: color.ink },
  /* Checked is the accent and the weight, not a second fill: the fill in this
   * menu means "the pointer is here", and one fill cannot mean two things. */
  itemChecked: { color: color.accentInk, fontWeight: 600 },
  itemIcon: {
    display: "flex",
    flex: "none",
    alignItems: "center",
    justifyContent: "center",
    width: control.icon,
    height: control.icon,
  },
  itemLabel: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  /* Always in the layout, so a name does not shift sideways when it is taken. */
  check: {
    flex: "none",
    width: control.icon,
    height: control.icon,
    /* The label's blue, not the rule's: the mark and the name it belongs to
     * sit on the same row and cannot be two different blues. */
    color: color.accentInk,
    opacity: 0,
    transitionProperty: "opacity",
    transitionDuration: motion.moderateIn,
    transitionTimingFunction: motion.ease,
  },
  checkOn: { opacity: 1 },
  /* A menu of names of things wants to say what the names are for. */
  /* The menu's own label, which names what the list is a list of. `dim`
   * rather than `faint`: it is 11px, and 2.82:1 on the panel is under AA. */
  hint: {
    paddingBlock: space.xs,
    paddingInline: `calc(${control.padX} - ${space.xs})`,
    color: color.dim,
    fontSize: type.xs,
    letterSpacing: type.caps,
    textTransform: "uppercase",
  },
});

export const dropdownStyles = s;

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.75"
    viewBox="0 0 12 12"
    {...stylex.props(ui.selectCaret, s.caret, open && s.caretOpen)}
  >
    <path d="M3 4.75 6 7.75l3-3" />
  </svg>
);

const Check = ({ on }: { on: boolean }) => (
  <svg
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.75"
    viewBox="0 0 12 12"
    {...stylex.props(s.check, on && s.checkOn)}
  >
    <path d="M2.5 6.25 4.75 8.5 9.5 3.75" />
  </svg>
);

export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
  menuLabel,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  /** Drawn at the head of each item, and beside the trigger's own reading. */
  icon?: (option: T) => ReactNode;
  /** A line above the items, saying what the list is. */
  menuLabel?: string;
}) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ prefix: "", at: 0 });

  const [open, setOpen] = useState(false);
  /* Where the cursor is, whether it got there by pointer or by arrow. One
   * value for both, because there is one background and it can only be in one
   * place. */
  const [active, setActive] = useState<T>(value);
  /* The menu is at least as wide as the row it came out of. */
  const [width, setWidth] = useState(0);

  const glow = useHighlight(list, open ? active : null);

  const show = () => {
    setWidth(trigger.current?.offsetWidth ?? 0);
    setActive(value);
    setOpen(true);
  };
  const hide = () => setOpen(false);
  const take = (option: T) => {
    onChange(option);
    setOpen(false);
  };

  /* Keeps the active item in view when the arrows walk past the end of a menu
   * tall enough to scroll. */
  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-hl="${CSS.escape(active)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const step = (from: number, by: number) =>
    setActive(options[(from + by + options.length) % options.length] ?? value);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = options.indexOf(active);
    switch (event.key) {
      case "ArrowDown":
        step(at, 1);
        break;
      case "ArrowUp":
        step(at, -1);
        break;
      case "Home":
        setActive(options[0] ?? value);
        break;
      case "End":
        setActive(options[options.length - 1] ?? value);
        break;
      case "Enter":
      case " ":
        take(active);
        break;
      case "Tab":
        setOpen(false);
        return;
      default: {
        /* Typeahead. A prefix rather than a letter: two shapes starting with
         * `s` are two shapes a single keystroke cannot tell apart. */
        if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return;
        const now = Date.now();
        typed.current = {
          prefix: (now - typed.current.at > TYPEAHEAD_IDLE ? "" : typed.current.prefix) + event.key,
          at: now,
        };
        const hit = options.find((option) =>
          option.toLowerCase().startsWith(typed.current.prefix.toLowerCase()),
        );
        if (hit) setActive(hit);
        break;
      }
    }
    event.preventDefault();
    /* And stopped, so a letter typed at this menu is a letter typed at this
     * menu. The page binds single keys as shortcuts and skips them inside a
     * form control — a menu is not a form control, so it has to say so. */
    event.stopPropagation();
  };

  return (
    <>
      <button
        aria-controls={open ? `${id}-menu` : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        data-cuelume-toggle
        onClick={() => (open ? hide() : show())}
        onKeyDown={(event) => {
          if (open || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
          event.preventDefault();
          show();
        }}
        ref={trigger}
        type="button"
        {...stylex.props(ui.select, s.trigger, open && s.triggerOpen)}
      >
        <span {...stylex.props(ui.selectLabel)}>{label}</span>
        <span {...stylex.props(ui.selectValue)}>
          {icon ? <span {...stylex.props(s.itemIcon)}>{icon(value)}</span> : null}
          {value}
          <Chevron open={open} />
        </span>
      </button>

      <Popover
        activeDescendant={open ? `${id}-${active}` : undefined}
        anchor={trigger}
        id={`${id}-menu`}
        label={label}
        onClose={hide}
        onKeyDown={onMenuKeyDown}
        open={open}
        role="menu"
      >
        <div ref={list} {...stylex.props(s.list, width > 0 && s.width(width))}>
          {menuLabel ? <span {...stylex.props(s.hint)}>{menuLabel}</span> : null}
          {glow ? (
            <span
              aria-hidden="true"
              {...stylex.props(s.glow, s.glowAt(glow.top, glow.left, glow.width, glow.height))}
            />
          ) : null}
          {options.map((option) => (
            <button
              aria-checked={option === value}
              data-hl={option}
              id={`${id}-${option}`}
              key={option}
              onClick={() => take(option)}
              onPointerEnter={() => setActive(option)}
              role="menuitemradio"
              tabIndex={-1}
              type="button"
              {...stylex.props(
                s.item,
                option === active && s.itemActive,
                option === value && s.itemChecked,
              )}
            >
              {icon ? <span {...stylex.props(s.itemIcon)}>{icon(option)}</span> : null}
              <span {...stylex.props(s.itemLabel)}>{option}</span>
              <Check on={option === value} />
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}
