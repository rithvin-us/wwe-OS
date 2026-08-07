/**
 * RN-safe mirror of tokens.css. React Native's style engine has no CSS custom
 * properties and no oklch() parser, so color/radius/duration values that
 * `tokens.css` defines as OKLCH are hand-converted to sRGB hex here via the
 * CSS Color 4 OKLab matrices (same math browsers use) — not eyeballed.
 * Change `tokens.css` first (governed by docs/design/design-bible.md), then
 * re-derive the affected value(s) here. The two files must describe the same
 * palette under two runtimes that can't share one source file.
 */

export interface ColorTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  mutedForegroundSubtle: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  statusOperational: string;
  statusBuilding: string;
  statusPlanned: string;
  statusAttention: string;
}

export const lightColors: ColorTokens = {
  background: "#f7fef8",
  foreground: "#0a140f",
  card: "#ffffff",
  cardForeground: "#0a140f",
  popover: "#ffffff",
  popoverForeground: "#0a140f",
  primary: "#008cba",
  primaryForeground: "#f2fafe",
  secondary: "#e4f3ea",
  secondaryForeground: "#0e1913",
  muted: "#ecf4ef",
  mutedForeground: "#4c5951",
  mutedForegroundSubtle: "#65726b",
  accent: "#e4f3ea",
  accentForeground: "#0e1913",
  destructive: "#cc272e",
  destructiveForeground: "#fff6f5",
  border: "#dfe7e2",
  input: "#dfe7e2",
  ring: "#008cba",
  chart1: "#007083",
  chart2: "#2b9667",
  chart3: "#c8942d",
  chart4: "#656e9b",
  chart5: "#bb6d67",
  success: "#008655",
  successForeground: "#f3fbf6",
  warning: "#a56700",
  warningForeground: "#1e1406",
  statusOperational: "#06915f",
  statusBuilding: "#c0851f",
  statusPlanned: "#69737d",
  statusAttention: "#cc272e",
};

export const darkColors: ColorTokens = {
  background: "#090d10",
  foreground: "#e5e8eb",
  card: "#101419",
  cardForeground: "#e5e8eb",
  popover: "#101419",
  popoverForeground: "#e5e8eb",
  primary: "#58b4c4",
  primaryForeground: "#001015",
  secondary: "#1a1f24",
  secondaryForeground: "#d9dfe3",
  muted: "#1a1f24",
  mutedForeground: "#858a8f",
  mutedForegroundSubtle: "#7d8288",
  accent: "#19262b",
  accentForeground: "#d7e0e3",
  destructive: "#e85854",
  destructiveForeground: "#fcf3f2",
  border: "#20252a",
  input: "#25292f",
  ring: "#3595a4",
  chart1: "#3ba9ba",
  chart2: "#49af7e",
  chart3: "#d6a54d",
  chart4: "#818cc0",
  chart5: "#d47c76",
  success: "#44b782",
  successForeground: "#021109",
  warning: "#dca744",
  warningForeground: "#181003",
  statusOperational: "#44b782",
  statusBuilding: "#dca744",
  statusPlanned: "#889098",
  statusAttention: "#ec5b57",
};

// tokens.css: --radius: 0.5rem, computed at a 16px root.
export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
};

// tokens.css: --duration-fast/base/slow.
export const duration = {
  fast: 120,
  base: 180,
  slow: 260,
};

// tokens.css: --ease-out-quart / --ease-out-expo, as cubic-bezier control
// points for react-native-reanimated's `Easing.bezier(...)`.
export const easing = {
  outQuart: [0.25, 1, 0.5, 1] as const,
  outExpo: [0.16, 1, 0.3, 1] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
};
