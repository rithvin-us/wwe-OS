import { duration, easing } from "@bop/design-system/tokens";
import { Easing, FadeIn, FadeInDown } from "react-native-reanimated";

/**
 * The RN side of the design bible's motion section — same numbers as
 * `packages/design-system/tokens.ts` (itself mirroring `tokens.css`'s
 * `--duration-*`/`--ease-*`), not independently invented values. "Product
 * register: 150-250ms, ease-out, state not decoration" applies here exactly
 * as it does on web.
 */
export const DURATION = duration;

export const EASE_OUT_QUART = Easing.bezier(...easing.outQuart);
export const EASE_OUT_EXPO = Easing.bezier(...easing.outExpo);

/** Screen/section entrance — mirrors web's `animate-in fade-in duration-(--duration-slow) ease-out-quart`. */
export function screenEntrance() {
  return FadeIn.duration(DURATION.slow).easing(EASE_OUT_QUART);
}

/** Hero/header entrance — mirrors web's `fade-in slide-in-from-bottom-2` (login page, dialogs). */
export function heroEntrance() {
  return FadeInDown.duration(DURATION.slow).easing(EASE_OUT_QUART);
}

/**
 * Staggered list-row entrance — mirrors the design bible's documented
 * pattern ("staggered list entrance uses animationDelay per index capped
 * ~40ms/item, KpiTile is the reference implementation").
 */
export function listItemEntrance(index: number) {
  const delay = Math.min(index * 40, 400);
  return FadeIn.duration(DURATION.base).easing(EASE_OUT_QUART).delay(delay);
}
