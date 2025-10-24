# HeyTeam Design Guidelines

## Design Approach: Design System Foundation

**Selected System:** Linear-inspired modern productivity aesthetic with Material Design information density patterns

**Justification:** HeyTeam is a utility-focused workforce coordination tool requiring:
- High information density (rosters, calendars, messaging threads)
- Daily operational use demanding consistency and learnability
- Fast decision-making workflows for managers
- Professional, trustworthy appearance for business contexts

**Core Principles:**
1. **Clarity First** - Every interaction supports quick comprehension and action
2. **Information Hierarchy** - Clear visual distinction between critical (job status, confirmations) and supporting data
3. **Purposeful Minimalism** - Clean layouts that reduce cognitive load during high-pressure coordination
4. **Reliable Patterns** - Consistent UI elements that build muscle memory for frequent users

---

## Color Palette

### Light Mode
- **Background:** 0 0% 100% (pure white)
- **Surface:** 240 5% 96% (subtle gray for cards/panels)
- **Border:** 240 6% 90% (light borders)
- **Primary:** 217 91% 60% (professional blue for actions, job cards)
- **Success:** 142 71% 45% (confirmed availability, positive states)
- **Warning:** 38 92% 50% (maybe responses, pending actions)
- **Destructive:** 0 84% 60% (declined, cancellations)
- **Text Primary:** 240 10% 4% (near-black)
- **Text Secondary:** 240 4% 46% (muted gray)

### Dark Mode
- **Background:** 240 10% 4% (deep charcoal)
- **Surface:** 240 6% 10% (elevated panels)
- **Border:** 240 4% 16% (subtle borders)
- **Primary:** 217 91% 65% (slightly lighter blue)
- **Success:** 142 76% 36% (muted green)
- **Warning:** 38 92% 50% (unchanged)
- **Destructive:** 0 84% 60% (unchanged)
- **Text Primary:** 0 0% 98% (near-white)
- **Text Secondary:** 240 5% 65% (muted light gray)

---

## Typography

**Font Family:** Inter (via Google Fonts CDN) - optimized for UI readability

**Scale:**
- **Display (Job Names, Headers):** 32px / 2rem, semibold (600)
- **Heading 1 (Page Titles):** 24px / 1.5rem, semibold (600)
- **Heading 2 (Section Titles):** 18px / 1.125rem, medium (500)
- **Body (Default Text):** 14px / 0.875rem, normal (400)
- **Small (Metadata, Timestamps):** 12px / 0.75rem, normal (400)
- **Caption (Micro Labels):** 11px / 0.6875rem, medium (500)

**Line Heights:** 1.5 for body, 1.2 for headings, 1.4 for UI components

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8, 12, 16** consistently
- Component padding: `p-4` standard, `p-6` for cards
- Section spacing: `gap-4` for tight groups, `gap-8` for major sections
- Page margins: `px-6 py-8` on mobile, `px-8 py-12` on desktop

**Container Strategy:**
- **Full App:** `max-w-screen-2xl mx-auto` (1536px max)
- **Content Panels:** `max-w-4xl` for forms and single-column content
- **Dashboard Grid:** No max-width, use full available space

**Grid Patterns:**
- **Roster Board:** 4-column kanban (Confirmed/Maybe/Declined/No Reply) - equal width on desktop, stack on mobile
- **Job Cards Grid:** `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` with `gap-4`
- **Contact List:** Single column with grouped sections

---

## Component Library

### Navigation
**Top Bar:** Fixed header with org logo, navigation tabs (Dashboard/Jobs/Calendar/Contacts/Templates), user menu, and plan badge
- Height: `h-16`
- Background: Surface color with subtle border-bottom
- Tabs use underline indicator on active state (primary color, 2px thick)

### Cards
**Job Card:**
- Rounded corners: `rounded-lg`
- Border: 1px solid border color
- Shadow: Subtle on hover (`hover:shadow-md`)
- Header: Job name + location badge
- Body: Time range, fill indicator (4/6 with progress bar)
- Footer: Quick actions (View Roster, Edit, Reschedule)

**Contact Card:**
- Compact horizontal layout
- Avatar (initials on colored background) + name + status badge
- Metadata: Phone, email, last contacted
- Hover: Slight elevation and border highlight

### Roster Board (Kanban)
**Columns:** Equal-width flex columns with headers showing count
- **Header:** Column title + count badge (e.g., "Confirmed (4)")
- **Cards:** Contact cards with drag handles, reply snippet, timestamp
- **Empty State:** Dashed border with centered icon + text

**Contact Drawer:** Slide-in panel from right (33% width on desktop, full on mobile)
- Thread view: Messages with timestamps, delivery status icons
- Quick reply: Fixed bottom bar with Y/N/shift option buttons

### Forms
**Input Fields:**
- Height: `h-11` 
- Border: 1px solid border color (darker on focus)
- Background: Match mode (light surface in light mode, darker surface in dark mode)
- Placeholder text: Text secondary color
- Label: Small text above, medium weight

**Buttons:**
- **Primary:** Primary color bg, white text, `px-4 py-2`, medium weight, `rounded-md`
- **Secondary:** Border style, text color matches primary
- **Destructive:** Destructive color bg for critical actions

### Calendar
**Month View Grid:** 7-column grid for days, minimal borders
- **Day Cell:** Small day number in corner, job bubbles below (max 3 visible, "+2 more" indicator)
- **Job Bubble:** Small rounded pill with color-coded left border, truncated name, time

**Week View:** Timeline grid with hourly slots, jobs as positioned blocks

### Status Indicators
**Badges:**
- **Confirmed:** Success color, `rounded-full px-2 py-1`, small text
- **Maybe:** Warning color
- **Declined:** Destructive color
- **No Reply:** Border style with muted text

**Progress Bar:**
- Height: `h-2`, rounded, background border color
- Fill: Primary color for confirmed percentage

### Data Display
**Message Thread:**
- Outbound: Right-aligned, primary color background (10% opacity), rounded
- Inbound: Left-aligned, surface color, rounded
- Timestamps: Caption size, secondary text, below each message
- Status icons: Delivered/Read indicators (Material Icons: check, done_all)

---

## Animations

**Minimal, Purposeful Only:**
- **Transitions:** 150ms ease for hover states, 200ms for modal/drawer open
- **Progress:** Indeterminate spinner for loading states (primary color)
- **No scroll animations, parallax, or decorative motion**

---

## Images

**Minimal Image Usage:**
- **No hero image** - This is a utility app, lead directly with job dashboard or action buttons
- **Avatars:** Use initials on colored backgrounds (deterministic color from name hash)
- **Empty States:** Simple illustrations (e.g., undraw.co style) for "No jobs yet", "No contacts"
- **Icons:** Material Icons CDN for consistent system icons (calendar, message, person, check_circle, etc.)

---

## Key Screens Structure

**Dashboard:** Job cards grid with status filters at top, "Create Job" prominent button, upcoming jobs section
**Job Detail/Roster:** Split view - left: job info panel, right: 4-column kanban board, floating contact drawer
**Calendar:** Month/week toggle, filter by status, click job opens detail modal
**Compose Send:** Stepped form (1. Template selection, 2. Audience picker, 3. Preview & send)
**Contacts:** Table view with search, filters (tags/skills), bulk actions toolbar, CSV import button
**Billing:** Clean panel showing plan name, credits remaining (large number), usage chart, "Manage Subscription" button (Stripe portal link)