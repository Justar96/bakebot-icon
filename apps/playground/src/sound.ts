import { bind, play, setEnabled, setVolume, type SoundName } from "cuelume";

/**
 * Sound, on unless turned off.
 *
 * cuelume synthesises seventeen interaction cues through one shared
 * `AudioContext` — no files, no dependencies — and splits the work in two:
 * `bind()` delegates the pointer grammar off `data-cuelume-*` attributes, and
 * `play()` is there for the moments an attribute cannot describe.
 * https://cuelume-site.pages.dev/docs/
 *
 * Both halves are used here, because they are answering two different
 * questions. A press and a release are properties of the *control* — every
 * button on the page has them, they never vary, and a data attribute on the
 * shared button is the whole of that. A success and an error are properties of
 * the *outcome*, which no attribute can know: the task has to come back first.
 * So the controls are marked and the outcomes are played.
 *
 * The one rule the library leaves to the app is the preference: cuelume applies
 * one but deliberately never stores one. Playback starts on — this is a
 * playground for a mascot, and the cues are part of what there is to try — and
 * the switch in the composer's header turns it off. Only an explicit "off" is
 * remembered, so a reader who has never touched the switch hears the page the
 * way it is meant to sound, and a reader who has silenced it keeps that.
 *
 * Nothing sounds before the first click regardless: a browser holds the
 * `AudioContext` suspended until a gesture, so the opening state of this switch
 * cannot make a page make noise at somebody unasked.
 *
 * `bind()` is called once regardless of that switch. It is delegated at the
 * document, so it costs one listener per event type and stays correct as React
 * mounts and unmounts everything under it; and while sound is off every cue it
 * fires is a no-op inside the engine. Nothing needs re-binding after a render.
 */

const KEY = "bakebot-playground-sound";

/* Interface sound sits under the content, not over it. cuelume's cues are
 * synthesised with soft envelopes rather than transients, so this is quieter
 * than it looks written down — it is the level at which a press is felt in the
 * room rather than heard from it. */
const LEVEL = 0.32;

/* A browser in a private window throws on `localStorage` rather than returning
 * nothing, and a playground that cannot remember a preference should still
 * play. Both directions are guarded, and neither reports — and the fallback is
 * the default, which is on. */
function remembered(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

function remember(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* Nothing to do about it, and nothing worth saying. */
  }
}

/** Wires the page's cues up and reports whether the reader wants to hear them. */
export function startSound(): boolean {
  const on = remembered();
  setVolume(LEVEL);
  setEnabled(on);
  bind();
  return on;
}

export function enableSound(on: boolean) {
  setEnabled(on);
  remember(on);
  /* The switch is its own confirmation. Turning sound on with no sound is the
   * one case where saying nothing is the wrong answer, and `ready` is the cue
   * cuelume keeps for exactly this. */
  if (on) play("ready");
}

/** An outcome, said out loud. A no-op while sound is off. */
export function cue(name: SoundName) {
  play(name);
}
