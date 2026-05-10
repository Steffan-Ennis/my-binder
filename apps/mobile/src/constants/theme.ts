import { Platform } from 'react-native';

/**
 * Global theme tokens for the my-binder mobile app.
 *
 * Source of truth: `specs/002-mobile-binder-app/My-Binder--wireframe-v3.html`
 * (and the rendered front-page.png screenshot beside it).
 *
 * Visual identity: a digital recreation of an Ultra Pro Collectors Album —
 * deep crimson cover with warm dusty-gold debossing, a high-contrast italic
 * serif masthead, and rose secondary text. Light/CTA surfaces are pure white
 * so the Sign-in button reads as an applied label on the leather cover.
 *
 * The palette is dark-first: every screen lives on the crimson background by
 * default, and `light` is provided only for surfaces that explicitly invert
 * (the Google CTA, system sheets). This is the opposite of the create-expo-app
 * default; do not mistake the values below for a paper-on-grey UI.
 */

const palette = {
  /** Primary cover surface — the deep crimson the binder is bound in. */
  crimson900: '#1a0606',
  /** Mid-tone crimson — the dominant body background gradient. */
  crimson700: '#3a0f10',
  /** Highlight crimson — gradient top + slight specular sheen near the spine. */
  crimson500: '#5c1d1f',
  /** Page-edge crimson — divider lines, inactive tab, secondary surface. */
  crimson400: '#5c2b2e',
  /** Soft coral — error states, disabled gold ghosting. */
  coral400: '#ff8a80',

  /** Soft Grey for tabs */
  tabBackground : 'rgb(251, 247, 240)',

  /** Primary brand accent — warm dusty gold for masthead glyph + title. */
  gold500: '#c9a86b',
  /** Pressed/active gold — used for the underline rule under the masthead. */
  gold600: '#b8924a',
  /** Soft gold — secondary marks and hairline accents on the cover. */
  gold300: '#e0c891',

  /** Soft rose — body text on crimson (legal, "digital edition" italic). */
  rose200: '#e9b5b5',
  /** Muted rose — captions and de-emphasised footer copy. */
  rose400: '#a6797a',

  /** Pure white CTA surface (Sign-in with Google button background). */
  white: '#ffffff',
  /** Near-black CTA text colour — paired with `white` surface. */
  ink: '#1f1f1f',
  /** Outer device frame / shadow base. */
  black: '#050304',
} as const;

/**
 * Semantic colour tokens, split by colour scheme. Components MUST consume
 * these (not raw `palette` values) so a future light/dark toggle stays a
 * single-source change.
 *
 * The `dark` mode IS the default: the binder cover background applies on
 * every screen unless an inverted surface (Google CTA, modal sheet) opts
 * out. The `light` mode is provided for those inverted surfaces and for
 * users who later opt into a paper-binder skin (out of scope for spec 002).
 */
export const Colors = {
  dark: {

    // Primary palette
    primary : {
      gradient: `linear-gradient(${palette.crimson700} 0%, ${palette.crimson500} 100%)`
    },

    // Surfaces
    background: palette.crimson700,
    backgroundElevated: palette.crimson500,
    backgroundDeep: palette.crimson900,
    surfaceInverted: palette.white,
    pocketEmpty: palette.crimson400,

    // Text
    text: palette.rose200,
    textMuted: palette.rose400,
    textInverted: palette.ink,
    textOnAccent: palette.crimson900,

    // Brand / accent
    accent: palette.gold500,
    accentPressed: palette.gold600,
    accentSoft: palette.gold300,

    // Tab bar
    tabBarBackground: palette.tabBackground,
    tabIconDefault: palette.rose400,
    tabIconSelected: palette.gold500,

    // States
    error: palette.coral400,
    border: palette.crimson400,
    divider: palette.crimson500,
  },
  light: {
    // The inverted surface used by the Google CTA + system sheets.
    background: palette.white,
    backgroundElevated: palette.white,
    backgroundDeep: palette.white,
    surfaceInverted: palette.crimson700,
    pocketEmpty: palette.crimson400,

    text: palette.ink,
    textMuted: palette.rose400,
    textInverted: palette.rose200,
    textOnAccent: palette.crimson900,

    accent: palette.gold600,
    accentPressed: palette.gold600,
    accentSoft: palette.gold300,

    tabBarBackground: palette.white,
    tabIconDefault: palette.rose400,
    tabIconSelected: palette.gold600,

    error: palette.coral400,
    border: palette.crimson400,
    divider: palette.crimson400,
  },
} as const;

/**
 * Typography roles, mapped to the wireframe v3 hierarchy.
 *
 * Custom display serif ("Collectors Album" masthead) is planned via
 * `expo-font` (Playfair Display Italic 700) but not yet loaded at runtime;
 * until the font is registered, the `display` role falls back to the
 * platform-default serif so the layout still renders. See
 * `specs/002-mobile-binder-app/plan.md` for the planned `expo-font` task.
 */
export const Fonts = Platform.select({
  ios: {
    /** Body sans (system San Francisco). */
    sans: 'system-ui',
    /** Display serif — "Collectors Album". Falls back to UI serif until expo-font loads Playfair Display. */
    serif: 'ui-serif',
    /** Wide-tracked small caps — "ULTRA · ESTABLISHED · 1972". */
    rounded: 'ui-rounded',
    /** Monospaced — diagnostics + version strings only. */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "'Playfair Display', Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
}) as { sans: string; serif: string; rounded: string; mono: string };

/**
 * Type roles tied to the wireframe v3 hierarchy. `font`, `size`, and
 * `lineHeight` are kept together so a single role import (e.g.
 * `Type.display`) gives a component everything it needs — no separate
 * `fontSize` + `lineHeight` lookups across the codebase.
 *
 * Sizes follow a 1.25 modular scale rounded to integers.
 */
export const Type = {
  /** "Collectors Album" masthead — large italic serif. */
  display: { font: Fonts.serif, size: 44, lineHeight: 52, letterSpacing: 0, weight: '700' as const, italic: true },
  /** Section headers ("Today's binder", future feature titles). */
  title: { font: Fonts.sans, size: 28, lineHeight: 34, letterSpacing: 0, weight: '600' as const, italic: false },
  /** Sub-section / card-name headlines. */
  headline: { font: Fonts.sans, size: 20, lineHeight: 26, letterSpacing: 0, weight: '600' as const, italic: false },
  /** "ULTRA · ESTABLISHED · 1972" wide-tracked masthead caption. */
  overline: { font: Fonts.sans, size: 11, lineHeight: 14, letterSpacing: 4, weight: '500' as const, italic: false },
  /** Body copy — terms, modals, inline help. */
  body: { font: Fonts.sans, size: 15, lineHeight: 22, letterSpacing: 0, weight: '400' as const, italic: false },
  /** Body emphasised — CTA labels ("Sign in with Google"). */
  bodyStrong: { font: Fonts.sans, size: 15, lineHeight: 20, letterSpacing: 0, weight: '600' as const, italic: false },
  /** "digital edition" italic subtitle. */
  subtitleItalic: { font: Fonts.serif, size: 16, lineHeight: 22, letterSpacing: 0, weight: '400' as const, italic: true },
  /** Footer / legal / "[demo error]" link. */
  caption: { font: Fonts.sans, size: 12, lineHeight: 16, letterSpacing: 0, weight: '400' as const, italic: false },
} as const;

/**
 * 4-pt spacing scale. The wireframe's vertical rhythm reads cleanly when
 * laid out on a 4-pt grid: cover padding ≈ 24 (`xl`), button ≈ 16 (`lg`)
 * vertical / 24 (`xl`) horizontal, hairline gaps ≈ 4 (`xxs`).
 */
export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  giant: 64,
} as const;

/**
 * Corner radii. The Sign-in button is a soft pill; the binder pockets are
 * `md`; modal sheets land at `lg`.
 */
export const Radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  pill: 999,
} as const;

/**
 * Elevation tokens. The binder cover prefers an inset/specular look over
 * Material drop shadows, so each token below is intentionally subtle —
 * `lg` is reserved for floating sheets, not cards.
 */
export const Elevation = {
  none: { shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  sm: { shadowColor: palette.black, shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  md: { shadowColor: palette.black, shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  lg: { shadowColor: palette.black, shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
} as const;

/**
 * Touch-target minimums. iOS HIG: 44pt; Material: 48dp. We adopt the
 * Material floor for cross-platform parity.
 */
export const Touch = {
  minTarget: 48,
  buttonHeight: 52,
  tabBarHeight: 56,
} as const;

/**
 * Animation durations (ms). Page-turn and fade-through transitions in the
 * binder share these constants so the motion language stays unified.
 */
export const Motion = {
  fast: 120,
  base: 200,
  slow: 320,
  pageTurn: 360,
} as const;

export type ColorScheme = keyof typeof Colors;
export type ColorToken = keyof typeof Colors['dark'];
export type SpacingToken = keyof typeof Spacing;
export type RadiusToken = keyof typeof Radius;
export type ElevationToken = keyof typeof Elevation;
export type TypeRole = keyof typeof Type;
