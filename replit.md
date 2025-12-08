# HeyTeam - Workforce Coordination Application

## Overview
HeyTeam is a lightweight, subscription-based workforce coordination application designed to streamline communication, availability collection, and job scheduling for managers and their crew members. It offers bi-directional SMS/Email messaging, real-time availability tracking, calendar visualization, and advanced contact management. The platform aims to provide a robust, multi-tenant solution with secure authentication to enhance team collaboration and operational efficiency.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (October 24, 2025)

**Navigation Restructuring & User Profile Management (October 24, 2025):**
- Restructured header navigation with Setup dropdown menu grouping administrative functions (Team, Billing, Messages)
- Added user profile dropdown menu displaying user name with Edit Profile and Logout options
- Created profile edit page at `/profile` with PATCH `/api/auth/profile` backend endpoint
- Profile form allows editing: First Name, Last Name, Email, Mobile Number, and Country Code
- User name (firstName lastName) displayed in profile dropdown updates in real-time after profile save
- Moved Admin dashboard to `/admin/admin.aspx` for security isolation from user instances
- Main navigation items remain: Jobs, Calendar, Contacts, Templates
- Setup dropdown visible to all authenticated users; Admin link only visible to users with `isAdmin = true`
- E2E tests confirm navigation structure, profile editing, and dropdown menus work correctly
- Backend `/api/auth/me` endpoint expanded to include firstName, lastName, mobileNumber, countryCode

**Message History/Journal Feature (October 24, 2025):**
- Added comprehensive message history page at `/messages` accessible from header navigation
- Displays all sent and received messages in a searchable table format
- Backend endpoint GET `/api/messages/history` returns enriched message data with contact names and job names
- Real-time client-side filtering by contact name, message content, and date
- Table columns: Date & Time, Contact, Direction (Sent/Received), Job, Message, Status
- Direction badges: "Sent" for outbound, "Received" for inbound messages
- Status badges: color-coded (sent=default, failed=destructive, received=secondary)
- Filter panel with three search fields: Contact Name, Message Content, Date
- Clear Filters button appears when filters are active, shows filtered count
- Navigation link "Messages" in header (desktop and mobile) with MessageSquare icon
- Empty state displays "No messages yet" when no messages exist
- Messages sorted by creation date (newest first) for easy tracking
- Route configured at /messages with authentication required
- Fully responsive design with proper test IDs for e2e testing

**Roster Link Feature (October 24, 2025):**
- Added roster link generation feature allowing SMS recipients to view their weekly job schedule via secure links
- Added `rosterToken` field to contacts table (varchar, unique, nullable) for secure roster access
- Added `includeRosterLink` field to templates table (boolean, default false)
- Template creation form now includes "Include Roster Link" toggle switch
- When enabled, messages automatically append roster link: "View your weekly roster: [baseUrl]/roster/[token]"
- Roster tokens are 32-character unique IDs generated using nanoid, created lazily on first message send
- Created public roster viewing page at `/roster/:token` accessible without authentication
- Public roster displays contact name, upcoming jobs, and past jobs with full details (name, location, time, notes)
- Backend endpoints: GET `/api/contacts/:id/roster-token` (auth required) and GET `/api/roster/:token` (public)
- Roster shows ALL jobs where contact has availability records (not just confirmed status)
- Security: Tokens are unique per contact, ownership checks on token generation, public page intentionally unauthenticated
- E2E tests confirm end-to-end flow: token generation during messaging, public roster consumption without auth
- Database migration applied manually using execute_sql_tool to add roster_token and include_roster_link columns

## Recent Changes (October 23, 2025)

**Job Deletion Feature (October 23, 2025):**
- Added job deletion functionality with DELETE endpoint at `/api/jobs/:id`
- Delete button (trash icon) appears on each job card in the Jobs page
- Confirmation dialog requires typing "heyteam" to prevent accidental deletions
- Authorization check ensures only job owner can delete
- Cascade delete removes associated availability records automatically
- Success toast and automatic list refresh after deletion
- Placeholder `syncJobToCalendars` function added (calendar integration uses .ics downloads)

**Login Page Updates (October 23, 2025):**
- Replaced static illustration with animated GIF showing hand holding phone with messaging interface
- Changed left panel gradient from blue to teal (from-[#14b8a6] to-[#0d9488]) to match primary button color
- Maintains modern split-screen layout with logo and "Stop calling around. Just HeyTeam it." headline

**Navigation Simplification (October 23, 2025):**
- Removed Dashboard tab from main navigation as it served the same purpose as Jobs
- Jobs is now the primary landing page for authenticated users
- Root route (/) redirects to /jobs for cleaner user experience
- Navigation items: Jobs, Calendar, Contacts, Templates

## Recent Changes (October 21, 2025)

**Admin User Management & Instance Control (October 21, 2025):**
- Implemented separate admin user management system with dedicated `adminUsers` table for platform administrators
- Added user instance management with soft delete using `isActive` flag (preserves all user data)
- Redesigned admin dashboard with tabbed interface:
  - **User Instances Tab:** Displays all customer accounts with disable/enable actions and status indicators
  - **Platform Admins Tab:** Manages platform administrators with create/delete functionality
- Disable/enable functionality allows administrators to deactivate user accounts without data loss
- Add Admin User dialog with secure password hashing (bcrypt, 10 rounds) before storage
- Summary cards updated to show Total Instances (with active count), Active Subscriptions, Monthly Revenue, Total SMS Credits
- All admin routes protected with `requireAdmin` middleware verifying both authentication and `isAdmin = true`
- E2E tests confirm user disable/enable, admin user creation/deletion, and authorization work correctly

**Admin Monitoring Dashboard (October 21, 2025):**
- Created comprehensive admin dashboard at /admin/dashboard for monitoring all registered users
- Added referralCode field to users schema to track referral sources
- Added createdAt timestamp to users schema to track registration dates
- Dashboard displays summary cards: Total Users, Active Subscriptions, Monthly Revenue (mixed currencies), Total SMS Credits
- User table shows: Company name, Email, Subscription plan, Status, SMS credits, Monthly payment amount, Referral code, Registration date
- Monthly payment calculated based on user's subscription plan and preferred currency (GBP/USD/EUR)
- Frontend authorization redirects non-admin users attempting to access admin routes
- Backend authorization via requireAdmin middleware ensures API security
- Admin navigation link (Shield icon) only visible to users with isAdmin = true
- E2E tests confirm authorization, data display, and registration date tracking work correctly

**Jobs Search Function (October 21, 2025):**
- Added real-time search functionality to the Jobs/Dashboard page
- Search filters jobs by name, location, and description (case-insensitive)
- Search bar appears automatically when jobs exist in the system
- Dynamic empty state: Shows "No jobs found" with clear search button when no matches
- Filters both upcoming and past jobs independently
- E2E tests confirm search, filtering, and clear functionality work correctly

**Modern Login Page Redesign (October 21, 2025):**
- Redesigned login page with modern split-screen layout
- Left panel: Blue gradient background with logo and "Stop calling around. Just HeyTeam it." headline
- Right panel: Clean white form area with Sign in/Sign up states
- Removed tabs in favor of state-based switching for cleaner UX
- Larger input fields (h-11) for better usability
- Terms of Service mention on registration
- Responsive design: Single column on mobile, split-screen on desktop
- E2E tests confirm registration, login, and form switching work correctly

**Password Reminder for Team Members (October 21, 2025):**
- Added password reminder feature allowing owners and admins to reset team member passwords
- Backend endpoint `/api/organization/members/:userId/password-reminder` generates temporary 8-character password
- Password reminder button visible in Team Members tab on Contacts page (owners/admins only)
- Cannot send password reminder to yourself
- Dialog displays generated temporary password with copy-to-clipboard functionality
- Security: All plaintext password logging removed from server logs (invite and password reminder endpoints)
- Temporary passwords securely hashed with bcrypt (10 rounds) before storage
- E2E tests confirm authorization, password generation, and login with new password work correctly

## System Architecture

### Frontend Architecture
**Framework:** React with TypeScript using Vite.
**UI Component System:** shadcn/ui components with Radix UI primitives, styled using Tailwind CSS.
**Styling:** Tailwind CSS with custom design tokens, Linear-inspired aesthetic, light/dark mode support, and Inter font family.
**State Management:** TanStack Query for data fetching, React Hook Form with Zod for forms, and Wouter for routing.
**Key Design Principles:** High information density, consistent visual hierarchy, purposeful minimalism, and a professional blue primary color.
**UI/UX Decisions:** Modern split-screen login/registration with clear forms, responsive design for mobile and desktop, dynamic empty states, clickable status badges for navigation, and improved mobile optimization for headers and forms.

### Backend Architecture
**Server Framework:** Express.js with TypeScript.
**API Design:** RESTful endpoints (`/api/*`), JSON request/response, session-based authentication with bcrypt, and centralized error handling.
**Core Modules:** Interface-based storage abstraction, PostgreSQL implementation using Drizzle ORM, and API route definitions.
**Key Backend Services:** Message Pipeline, Availability Tracking, Calendar Invite Generation, and Subscription Management.

### Database Architecture
**ORM:** Drizzle ORM with PostgreSQL dialect, using Neon serverless PostgreSQL.
**Schema Design:** Includes core entities like `users`, `contacts`, `jobs`, `organizations`, `subscriptions`, and messaging entities (`campaigns`, `messages`, `availability`). Extensive use of foreign key constraints and UUID primary keys for scalability.
**Admin Tables:** Separate `adminUsers` table for platform administrators, independent from regular portal users.
**Soft Delete:** Users table includes `isActive` boolean field for soft delete pattern - disabled users retain all data.

### Authentication & Authorization
**Implementation:** Full session-based authentication with bcrypt hashing (10 rounds).
**Authentication Features:** User registration, login/logout (using email), password reset with time-limited tokens, and automatic basic subscription creation. Email persistence across logins.
**Authorization:** Role-based access control (`isAdmin`, `teamRole`) with middleware for protected routes and organization-scoped data access.
**Security Measures:** httpOnly cookies, password reset tokens with expiration, user ID isolation, and password hashes never returned in API responses.

### Feature Specifications
**Jobs Search:** Real-time search functionality on the Dashboard by name, location, and description.
**Calendar Integration:** Generation and download of RFC 5545-compliant `.ics` calendar invites for job events, eliminating OAuth complexity.
**Reporting:** Downloadable PDF resource allocation reports showing contact assignments, availability, and off-shift status.
**Contact Management:** Visual status indicators for contacts (Free, On Job, Off Shift), status filtering, and clickable status badges to navigate to jobs.
**Multi-Currency Subscriptions:** Support for GBP, USD, EUR across subscription plans and SMS bundles, with a dedicated pricing page and Stripe integration.
**Team Messaging:** Ability to send 1:1 messages to team members from a dedicated tab on the Contacts page, with role badges and organization-scoped security.

## External Dependencies

**Communication Services:**
- **Twilio:** For bi-directional SMS messaging via Programmable Messaging API.

**Payment Processing:**
- **Stripe:** For subscription billing, customer management, and webhook handling.

**Infrastructure Services:**
- **Neon Database:** Serverless PostgreSQL.

**Third-Party UI Libraries:**
- **Radix UI:** Accessible component primitives.
- **date-fns:** Date manipulation.
- **cmdk:** Command palette interface.
- **react-day-picker:** Calendar date selection.
- **PDFKit:** For server-side PDF generation.