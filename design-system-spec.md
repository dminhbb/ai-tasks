# AI Task Manager: Design System Specification

Derived from the `cursor-design` skill (Cursor — "Warm ivory software studio").

## 1. Core Principles
- **Warm Ivory Studio**: Clean, precise, functional — inspired by Linear, Stripe, Figma.
- **AI-Native UI**: Clear distinction between human and AI content; feedback loops for AI outputs.
- **Compact Density**: 14px body text, 8px element gaps, 12px card padding.

## 2. Typography
- **Primary Font**: `Lato` (fallback for CursorGothic), sans-serif.
- **Mono Font**: `Berkeley Mono` (fallback monospace), for code/inputs.
- **Base Body Size**: `14px`, line-height `1.43`, letter-spacing `0.08px`.
- **Headings**: Weight `400`, tighter letter-spacing at larger sizes.

### Type Scale
| Role | Size | Line Height | Letter Spacing |
|:-----|:-----|:------------|:---------------|
| caption | 10px | 1.1 | 0.06px |
| body-lg | 14px | 1.43 | 0.08px |
| heading-sm | 22px | 1.25 | -0.08px |
| heading | 26px | 1.2 | -0.35px |
| heading-lg | 36px | 1.1 | -0.45px |
| display | 72px | 1.0 | -2.16px |

## 3. Color Palette

### Core Colors
| Token | Hex | Role |
|:------|:----|:-----|
| Canvas Parchment | `#f7f7f4` | Page bg, card bg, neutral btn bg |
| Inkwell | `#262510` | Primary text, strong borders |
| Muted Stone | `#7a7974` | Secondary text, subtle borders, icons |
| Deep Shadow | `#141414` | Strongest text contrast |
| Pebble Gray | `#e6e5e0` | Hover states, elevated card bg |
| Onyx Outline | `#f54e00` | Outlined CTA borders, link text |
| Goldenrod Accent | `#c08532` | Build actions |
| Forest Green Action | `#34785c` | Secondary actions |
| Highlight Beige | `#cdcdc9` | Nested card bg, faint borders |

### Surfaces
| Level | Color | Purpose |
|:------|:------|:--------|
| 0 | `#f7f7f4` | Base page background |
| 1 | `#e6e5e0` | Elevated cards, section separation |
| 2 | `#cdcdc9` | Nested elements, subtle variations |

### Status Colors (Light Mode)
| Status | Background | Text |
|:-------|:-----------|:-----|
| Urgent | `#fef2f2` | `#991b1b` |
| In Progress | `#fef3c7` | `#92400e` |
| To Do | `#ecfdf5` | `#065f46` |
| Pending | `#fff7ed` | `#9a3412` |
| Done | `#f0fdf4` | `#166534` |

## 4. Components & Spacing
- **Element Gap**: `8px` (compact density).
- **Card Padding**: `12px`.
- **Section Gap**: `43px`.
- **Touch Targets**: Min `44px` height for buttons.
- **Borders**: `1px` solid, Pebble Gray `#e6e5e0` (light) / `rgba(255,255,255,0.06)` (dark).
- **Radius**: `4px` general (buttons/cards), `8px` prominent (dialogs/elevated cards).
- **Shadows**: Multi-layer `rgba(0,0,0,0.14) 0px 28px 70px...` for elevated elements.

## 5. Button Hierarchy
| Type | Background | Border/Text | Usage |
|:-----|:-----------|:------------|:------|
| Primary Filled | Inkwell `#262510` | Canvas Parchment text | Main CTA |
| Outlined Accent | Transparent | Onyx Outline `#f54e00` | Important interactive |
| Ghost | Transparent | Inkwell text | Low-priority actions |
