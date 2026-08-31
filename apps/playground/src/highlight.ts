import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

/**
 * Where one item in a group is, so a single layer can be moved onto it.
 *
 * Fluid Functionalism's dropdown and radio group both describe themselves as
 * having "proximity hover and an animated background": one highlight that
 * travels to the item under the pointer rather than a background per item
 * fading in place. This is the measurement that makes that possible, and it is
 * shared because both components wanted the same four numbers.
 * https://www.fluidfunctionalism.com/docs/radio-group
 *
 * The item is found by a data attribute rather than through a map of refs: a
 * group renders its items from a list, and a list does not want a ref callback
 * per row to make one div move. Offsets are read rather than rects, so the
 * numbers are already relative to the group — which is why the group has to be
 * the items' `offsetParent`, and why every caller positions it.
 *
 * Re-measured when the group's own size changes: a card that gets narrower
 * relays a two-column grid, and the highlight has to follow the item rather
 * than the coordinates the item used to be at.
 */

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const same = (a: Box, b: Box) =>
  a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

/** The box of the item marked `data-hl="<key>"` inside `group`. */
export function useHighlight(group: RefObject<HTMLElement | null>, key: string | null): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  const at = useRef<Box | null>(null);

  const measure = useCallback(() => {
    const host = group.current;
    const item =
      host && key !== null
        ? host.querySelector<HTMLElement>(`[data-hl="${CSS.escape(key)}"]`)
        : null;
    if (!item) {
      at.current = null;
      setBox(null);
      return;
    }
    const next: Box = {
      top: item.offsetTop,
      left: item.offsetLeft,
      width: item.offsetWidth,
      height: item.offsetHeight,
    };
    if (at.current && same(at.current, next)) return;
    at.current = next;
    setBox(next);
  }, [group, key]);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const host = group.current;
    if (!host) return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [group, measure]);

  return box;
}
