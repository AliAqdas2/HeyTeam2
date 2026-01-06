---
alwaysApply: true
---
Design system
Rounded corners: lg 9px, md 6px, sm 3px; radius var --radius: .5rem.
Shadows defined for multiple depths (2xs through 2xl).
Light theme (selected tokens from client/src/index.css)
Primary: hsl(178 60% 50%) (teal) with white foreground.
Secondary: hsl(210 15% 25%) (deep muted blue/gray) with white foreground.
Background: white; Foreground: near-black hsl(240 10% 4%).
Card/Sidebar/Popover: soft grays with subtle borders; borders around 240 hue 6%–10% lightness.
Muted/Accent: soft grays; ring color matches primary teal.
Destructive: red hsl(0 84% 60%).
Chart palette: teal, green, amber, red, purple variants.
Dark theme overrides
Background: hsl(240 10% 4%) (near-black); Foreground: hsl(0 0% 100%).
Surfaces (card/sidebar/popover): slightly lighter dark grays; borders around 240 hue 3%–18% lightness.
Primary: hsl(178 55% 60%) teal; Secondary: hsl(210 15% 70%).
Muted/Accent: dark grays; ring: teal.
Destructive: red hsl(0 62% 50%).
Overall look
Teal primary, dark-muted secondary, white/near-black backgrounds depending on mode.
Soft grays for surfaces/borders, with subtle elevation tokens (--elevate-1/2).
Status colors: green (online), amber (away), red (busy), gray (offline).
Fonts: Inter (sans), Georgia (serif), SF Mono/monospace set.

Navigation Rules (VERY IMPORTANT)
Bottom Navigation

Use Bottom Tab Navigator for main app navigation

Tabs must be:

Home

Search (if applicable)

Notifications (if applicable)

Profile / Settings

Bottom tab must:

Be fixed

Respect safe area

Support dark mode

Use icons (Ionicons or Lucide)

Top Header (Status Bar + App Bar)

Every screen must have:

Back arrow (if not root screen)

Page title

Header must:

Be consistent across all screens

Respect iOS notch & Android status bar

Support dark mode

Use React Navigation header, not custom hacks

3. Theme Rules (DARK MODE REQUIRED)

App must support:

Light theme

Dark theme

Use:

useColorScheme() or theme provider

Colors must come from a central theme file

Never hardcode colors inside components

Backgrounds, text, icons, skeletons must all adapt to theme

4. UI & UX Rules
Panels & Modals

❌ Do NOT use center pop-up modals

✅ Use bottom-to-top sliding panels (bottom sheets)

Panels must:

Animate smoothly

Be dismissible by swipe

Respect safe area

Use:

@gorhom/bottom-sheet or Expo alternatives

Loading & Data Fetching

Every DB / API fetch must have:

Skeleton loader

❌ No spinners alone

Skeleton must:

Match actual layout

Respect dark mode

Skeleton must be shown until data is fully ready

5. Component Structure Rules

One component per file

Screens go in /screens

Reusable UI components go in /components

Shared logic goes in /shared

Styles must use:

StyleSheet.create

No inline styles unless very small

6. Data & State Rules

API logic must be:

Separated from UI

Placed in /services or /api

Use:

React Query OR clean custom hooks

No API calls directly inside JSX

Always handle:

loading

error

empty states

7. Platform Rules (iOS & Android)

Must work on:

iOS

Android

Use:

SafeAreaView

Avoid platform-specific code unless necessary

When platform specific:

Use Platform.OS

8. Animation Rules

Animations must be:

Smooth

Subtle

Mobile-friendly

Use:

react-native-reanimated

No heavy animations that affect performance

9. Performance Rules

Use:

FlatList for lists

Avoid:

ScrollView for long lists

Use memoization where needed

Do not re-render entire screens unnecessarily

10. Error Handling

Always show:

User-friendly error messages

No raw error text from API

Error UI must respect dark mode

11. Code Quality Rules

Clean and readable code

Meaningful variable names

No commented dead code

No console.logs in production code

12. Accessibility Rules

Buttons must have:

Proper touch size

Text must be readable in both themes

Icons must have labels where needed

13. What Cursor MUST NOT Do

Do NOT generate:

HTML tags (div, span)

CSS files

Web libraries

Do NOT use:

WebView unless explicitly asked

Do NOT ignore dark mode

Do NOT skip skeleton loaders

14. Default Libraries (USE THESE)

@react-navigation/native

@react-navigation/bottom-tabs

@gorhom/bottom-sheet

react-native-reanimated

expo-status-bar

react-native-safe-area-context

15. Code Generation Instruction

When generating new code:

Assume this is a production mobile app

Follow mobile UX best practices

Follow all rules above strictly