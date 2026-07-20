# Contrast Verification Notes

Real WCAG contrast math for the tokens in `packages/design-system/src/
tokens.css`, computed (not eyeballed) via OKLCH → linear sRGB → relative
luminance → contrast ratio. Re-run this method whenever a color token
changes — OKLCH lightness doesn't map linearly to perceived contrast, so a
value that "looks about right" can measure short of WCAG AA.

## Method

```python
# OKLCH -> linear sRGB (OKLab inverse transform), then WCAG relative
# luminance and contrast ratio. See git history of this file for the
# full script used to verify the tokens below.
```

## Findings

**Success/warning as small text (badges, KPI deltas — 11–12px, below the
"large text" WCAG threshold) needed correcting.** The values that looked
right at a glance —`oklch(0.58 0.13 160)` (success) and
`oklch(0.66 0.14 75)` (warning) — measured only 3.0–4.0:1 against white,
short of the 4.5:1 floor for text this small.

| Token               | As drafted             | Measured  | Corrected               | Measured |
| ------------------- | ---------------------- | --------- | ----------------------- | -------- |
| `--success` (light) | `oklch(0.58 0.13 160)` | 3.8–4.0:1 | `oklch(0.545 0.13 160)` | 4.6:1    |
| `--warning` (light) | `oklch(0.66 0.14 75)`  | 3.0–3.2:1 | `oklch(0.565 0.14 75)`  | 4.6:1    |

Dark-mode values passed comfortably as drafted (7.3–9.0:1) — dark surfaces
have more luminance headroom, so the same hue/chroma that fails in light
mode routinely passes in dark. Don't assume a token pair is symmetric;
check both.

**Already-passing, checked for completeness:**

| Token                              | Mode  | Ratio  |
| ---------------------------------- | ----- | ------ |
| `--destructive` text on background | Light | 5.11:1 |
| `--destructive` text on background | Dark  | 5.55:1 |

## Rule going forward

Any new token used as **text** (not just a fill/background) — badges,
status text, links, form feedback — gets checked against every surface it
can realistically sit on (background and card, both themes) before it
ships. A token that only works as a background fill with a paired
foreground color (like the module-status dots) doesn't need this — only
tokens used as the text color itself.
