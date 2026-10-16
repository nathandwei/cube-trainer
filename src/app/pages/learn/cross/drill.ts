// Pieces both full-page drills (cross, lookahead) share: a frame clock, the key handling rules of the timer page, and
// how a word is shown.

import { useEffect, useState } from "react";

/** A word as shown on screen (docs/UI.md: sentence case), e.g. a verdict: "inaccuracy" → "Inaccuracy". */
export function sentenceCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** performance.now(), refreshed every animation frame while `active`. */
export function useFrameClock(active: boolean): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = requestAnimationFrame(function tick() {
      setNow(performance.now());
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return now;
}

export function fromTextField(event: KeyboardEvent): boolean {
  const target = event.target;
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/**
 * Space was taken by the drill: stop it scrolling the page now, and stop its keyup from clicking whatever button
 * still has focus (the one that opened the drill, say).
 */
export function takeSpace(event: KeyboardEvent): void {
  event.preventDefault();
  const swallowKeyUp = (up: KeyboardEvent) => {
    if (up.code !== "Space") return;
    up.preventDefault();
    window.removeEventListener("keyup", swallowKeyUp, true);
  };
  window.addEventListener("keyup", swallowKeyUp, true);
}

/** Opening the full page: the button that opened it should not keep a focus ring (or take a later space). */
export function releaseFocus(): void {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

/** Keys a drill never takes: with a modifier they belong to the browser. */
export function hasModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey;
}
