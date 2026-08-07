/**
 * WWE OS palette for React Native — sourced from `@bop/design-system/tokens`,
 * the same conversion of `packages/design-system/src/tokens.css` that any
 * client this platform ships (web, mobile) resolves colors from. Extends the
 * template's five legacy keys (text/background/backgroundElement/
 * backgroundSelected/textSecondary) so `ThemedText`/`ThemedView` keep working
 * unchanged, while exposing the full token set for real screens.
 */

import "@/global.css";

import { darkColors, lightColors, type ColorTokens } from "@bop/design-system/tokens";
import { Platform } from "react-native";

type LegacyColorAliases = {
  text: string;
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  textSecondary: string;
};

function withLegacyAliases(tokens: ColorTokens): ColorTokens & LegacyColorAliases {
  return {
    ...tokens,
    text: tokens.foreground,
    background: tokens.background,
    backgroundElement: tokens.card,
    backgroundSelected: tokens.accent,
    textSecondary: tokens.mutedForeground,
  };
}

export const Colors = {
  light: withLegacyAliases(lightColors),
  dark: withLegacyAliases(darkColors),
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
