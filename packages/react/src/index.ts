/**
 * The browser public surface of `@bakebot/react`.
 *
 * The implementation lives in the CSS-free headless entry. This wrapper adds
 * the stylesheet once and re-exports that same module, so browser code and a
 * Node test importing different entry points do not receive two mascots.
 */

import "./gisx-icon.css";

export * from "./headless.js";
