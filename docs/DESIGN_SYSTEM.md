# Unleash Your Brave — Design System

Source of truth for the Flutter mobile app. Apply this aesthetic to all app screens
and shared UI unless a screen explicitly overrides it.

**Mood:** dark, luxury / editorial event-app. Warm off-black and off-white only —
never pure `#000` or `#FFF`.

---

## Colors

| Token | Value | Use |
| ----- | ----- | --- |
| `--bg-base` | `#0A0A0A` | Main background |
| `--bg-card` | `#120F0F` | Card backgrounds (slightly lifted from base) |
| `--bg-maroon` | `#1F1015` | Countdown boxes / recessed elements |
| `--accent-pink` | `#F04E93` | Primary accent — headlines emphasis, active states, icons, CTAs |
| `--accent-pink-dark` | `#E63E8C` | Pink hover / pressed |
| `--text-primary` | `#F5F0EC` | Main body text (warm off-white) |
| `--text-secondary` | `#A8A29B` | Labels, captions, muted text |
| `--text-tertiary` | `#8C8880` | Inactive nav, disabled states |
| `--border-subtle` | `rgba(255,255,255,0.08)` | Card borders |
| `--gradient-hero` | `linear-gradient(180deg, rgba(74,53,36,0.3) 0%, rgba(10,10,10,1) 100%)` | Overlay on hero images |

Flutter equivalents live in `app/lib/core/theme/app_colors.dart`.

---

## Typography

| Role | Family | Notes |
| ---- | ------ | ----- |
| Display / headlines / large numerals | **Playfair Display** | Weight 400–500; slight letter-spacing on numerals |
| UI / body / labels | **Inter** | All UI text, body copy, labels |

### Micro-labels (all-caps)

- Size: 11–12px  
- Letter-spacing: `0.15em`  
- Weight: 500  
- Color: `text-secondary`  
- Examples: section headers, nav-adjacent labels  

### Headlines

- Family: Playfair Display  
- Size: 32–40px  
- Line-height: 1.15  
- Color: `text-primary`  
- Second line / emphasis phrase: `accent-pink`

---

## Component styles

### Shared

- Card / container radius: **20px**
- Small elements (icon chips, buttons): **12px** (or 12–16px for chips)
- Card padding: **16–24px** (generous)
- Cards: `bg-card` + 1px `border-subtle` — **flat/moody, no heavy shadows**

### Countdown / stat boxes

- Background: `bg-maroon`
- Radius: **16px**
- Numerals: Playfair Display in `accent-pink`
- Label below: Inter, uppercase, `text-secondary`

### Icon chips (gift, calendar, etc.)

- Background: solid `accent-pink`
- Radius: 12–16px (`rounded-xl`)
- Icon: dark / black stroke on pink

### Bottom navigation

- Background: `bg-base` + subtle top border (`border-subtle`)
- Active icon + label: `accent-pink`
- Inactive: `text-tertiary`
- Icons: thin-stroke / line style (~1.5px stroke)

### Primary buttons

- Background: `accent-pink`
- Text: warm off-white (`text-primary`) or dark if contrast requires
- Radius: full pill or 12px (`rounded-xl`)
- Pressed: `accent-pink-dark`

---

## Apply to (Flutter app)

When building product screens, use this system on:

- Home / event overview
- Agenda
- Bottom navigation shell
- Countdown / stats modules
- Cards, chips, CTAs, section headers
- Any future event-app surfaces (gifts, guests, details, etc.)

Keep spacing generous and contrast high. Prefer warm `#0A0A0A` / `#F5F0EC` over pure black/white.
