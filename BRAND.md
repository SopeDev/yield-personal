# Yield brand

Yield is an umbrella brand shared by Yield Personal (this app) and Yield Café
(POS, `../yield-cafe`). Both use the same palette, typography, and mark; each
product is distinguished by the colour of the Y.

## Mark

The mark is a bold Y resting in an open cup.

| Product        | Y colour       | Cup   |
| -------------- | -------------- | ----- |
| Yield Personal | Yield Green    | Crema |
| Yield Café     | Espresso Amber | Crema |

Assets:

- `public/brand/yield-icon.svg` — mark only, transparent background.
- `public/brand/yield-logo.svg` — "yield" wordmark, transparent background.
- `public/icons/icon-source.svg` — app icon: mark on Void, full-bleed.
- `public/icons/icon-maskable-source.svg` — app icon with the mark inside the
  maskable safe zone.
- `src/app/icon.svg` — favicon (rounded tile).

The PNG icons in `public/icons/` are rendered from the source SVGs with `sharp`
(192, 512, 180 for Apple touch, and 512 maskable). Re-render them if the
sources change.

## Colours

The palette is dark-first; there is no light theme.

| Name           | Hex       | Role                        | Tailwind token                  |
| -------------- | --------- | --------------------------- | ------------------------------- |
| Void           | `#0D0F12` | Background                  | `background`                    |
| Surface        | `#13161A` | Cards and panels            | `surface`                       |
| Border         | `#1E2228` | Dividers                    | `border`                        |
| Yield Green    | `#00C896` | Primary accent, gains       | `primary`, `gain`               |
| Espresso Amber | `#F5A623` | Warnings and alerts         | `warning`                       |
| Loss Red       | `#E05252` | Negative amounts and losses | `loss`                          |
| Crema          | `#F0EDE8` | Primary text                | `foreground`                    |
| Muted          | `#5A6070` | Decorative and disabled     | `subtle`                        |
| Muted Text     | `#8B91A1` | Secondary text              | `muted-foreground`              |

Brand Muted on Void is about 3:1 contrast, too low for small text. Muted Text is
a lighter derivative (about 6:1) used for readable secondary text; keep brand
Muted for decorative or disabled elements.

## Typography

| Font    | Use                         | Tailwind class |
| ------- | --------------------------- | -------------- |
| Syne    | Logo and display headings   | `font-display` |
| Inter   | Interface and body text     | `font-sans`    |
| DM Mono | Numbers and amounts only    | `font-mono`    |
