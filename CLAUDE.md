# Pellar Portal

Internal CRM and outreach platform for Pellar. Hosted at `portal.pellar.co.uk`.

## Project Overview

A relationship-first CRM for Pellar. Captures leads from four channels — inbound contact form, referrals, content/LinkedIn, and curated outbound — and turns them into deals with full pipeline tracking, weighted forecasting, AI-drafted emails (always approved by user before sending), real Google Calendar sync, and AI briefings before meetings.

Pellar offers: custom software builds, systems integration, AI implementation, and process automation — targeted at high-frustration operational problems in UK SMEs (£10k–£100k+ deals, 3–6 month sales cycles).

## Core principle

The CRM is built around relationships and judgement, not volume. Nothing auto-sends. Discovery is throttled to a weekly review queue. The Inbox surfaces only what genuinely needs Alex's attention. Every cold email is AI-drafted but approved by hand.

## Architecture

Single Next.js application. All logic — UI, API routes, cron jobs, AI calls, email sending — lives in one codebase deployed to Vercel.

```
┌───────────────────────────────────────────────┐
│           Next.js (Vercel)                    │
│         portal.pellar.co.uk                   │
│                                               │
│  app/(portal)/     UI pages + components      │
│  app/api/          Route handlers:            │
│    - discovery, outreach, inbound, briefings  │
│    - Resend webhook receiver                  │
│    - Vercel cron endpoints                    │
│  lib/              Service logic:             │
│    - scoring, enrichment, email drafting      │
│    - Claude API calls, Resend sending         │
│    - Companies House + Google Places clients  │
│                                               │
└──────────────────┬────────────────────────────┘
                   │
           ┌───────┴───────┐
           │   Supabase    │
           │  (Postgres)   │
           └───────────────┘
```

## Tech Stack

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Database**: Supabase (Postgres + Auth)
- **Email**: Resend (sending + inbound webhooks)
- **AI**: Anthropic Claude API (email drafting, briefings, intent parsing, enrichment)
- **External APIs**: Companies House API, Google Places API
- **Hosting**: Vercel
- **Styling**: Tailwind CSS with Pellar brand tokens

## Project Structure

```
pellar-portal/
├── app/
│   ├── layout.tsx                     # Root layout, fonts, global styles
│   ├── page.tsx                       # Redirect to /dashboard
│   ├── (auth)/
│   │   ├── login/page.tsx             # Supabase Auth login
│   │   └── callback/route.ts          # OAuth callback
│   ├── (portal)/
│   │   ├── layout.tsx                 # Sidebar + shell layout
│   │   ├── dashboard/page.tsx
│   │   ├── leads/
│   │   │   ├── page.tsx               # Filterable leads table
│   │   │   └── [id]/page.tsx          # Lead detail view
│   │   ├── pipeline/page.tsx          # Kanban-style stage view
│   │   ├── outreach/page.tsx          # Email stats, feed
│   │   └── briefings/
│   │       ├── page.tsx               # Briefing list
│   │       └── [id]/page.tsx          # Full briefing view
│   └── api/
│       ├── discover/
│       │   └── route.ts               # POST — run discovery pipeline
│       ├── outreach/
│       │   ├── send/route.ts          # POST — draft + send email to a lead
│       │   └── followup/route.ts      # POST — run follow-up pass
│       ├── inbound/
│       │   └── route.ts               # POST — process inbound email
│       ├── briefings/
│       │   └── generate/route.ts      # POST — generate AI briefing
│       ├── webhook/
│       │   └── resend/route.ts        # POST — Resend webhook receiver
│       └── cron/
│           ├── discover/route.ts      # GET — Vercel cron trigger
│           └── followup/route.ts      # GET — Vercel cron trigger
├── components/
│   ├── sidebar.tsx
│   ├── lead-table.tsx
│   ├── lead-detail-panel.tsx
│   ├── pipeline-board.tsx
│   ├── email-feed.tsx
│   ├── briefing-card.tsx
│   ├── stage-badge.tsx
│   ├── score-dot.tsx
│   └── ui/                            # Shared primitives (button, input, badge)
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  # Browser Supabase client
│   │   ├── server.ts                  # Server Supabase client (cookies)
│   │   └── admin.ts                   # Service role client (for crons, writes)
│   ├── anthropic.ts                   # Claude API client
│   ├── resend.ts                      # Resend client + send helpers
│   ├── clients/
│   │   ├── companies-house.ts         # Companies House API client
│   │   └── google-places.ts           # Google Places API client
│   ├── services/
│   │   ├── discovery.ts               # Lead discovery pipeline
│   │   ├── scoring.ts                 # Lead scoring algorithm
│   │   ├── enrichment.ts              # Company enrichment + email finding
│   │   ├── email-drafter.ts           # Claude API email generation
│   │   ├── email-sender.ts            # Resend sending with guards
│   │   ├── intent-parser.ts           # Claude API inbound analysis
│   │   ├── briefing-gen.ts            # Claude API briefing generation
│   │   └── followup.ts               # Follow-up selection + sending
│   └── prompts/
│       ├── outreach.ts                # Prompt templates for cold emails
│       ├── followup.ts                # Prompt templates for follow-ups
│       ├── intent.ts                  # Prompt template for response parsing
│       ├── briefing.ts                # Prompt template for briefing generation
│       └── enrichment.ts              # Prompt template for frustration hypothesis
├── types/
│   └── index.ts                       # Shared TypeScript types + Supabase generated types
├── middleware.ts                       # Auth check on (portal) routes
├── tailwind.config.ts
├── vercel.json
├── package.json
├── CLAUDE.md
├── SCHEMA.md
├── API.md
└── PIPELINE.md
```

## Commands

```bash
npm install
npm run dev          # Local dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint
```

## Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# External APIs
RESEND_API_KEY=
ANTHROPIC_API_KEY=
COMPANIES_HOUSE_API_KEY=
GOOGLE_PLACES_API_KEY=

# Resend webhook verification
RESEND_WEBHOOK_SECRET=

# Vercel cron auth
CRON_SECRET=
```

## Brand

### Typography

One font: **DM Sans**. No serif fonts anywhere in the portal.

Hierarchy is achieved through weight and size, not font switching.

```
Wordmark:    DM Sans 600, uppercase, letter-spacing 0.15em ("PELLAR")
Page titles: DM Sans 400, 28px
Section heads: DM Sans 600, 13px, uppercase, letter-spacing 0.05em
Body:        DM Sans 400, 13-14px
Small/muted: DM Sans 400-500, 11px
Numbers:     DM Sans 300, 28-32px (large stat displays)
Badges:      DM Sans 600, 11px, uppercase, letter-spacing 0.03em
```

Load via Google Fonts with `font-display: swap`. Include weights 300, 400, 500, 600, 700.

### Colours

```
ink:        #1C1C1C    Primary text, sidebar background
forest:     #2D5A3D    Primary accent, CTAs, positive states
sage:       #7A9E7E    Secondary accent
stone:      #B8B0A8    Muted text, borders
cream:      #F5F0EB    Page background
white:      #FFFFFF    Card backgrounds
warm-gray:  #E8E4DF    Subtle borders, hover states
light-sage: #EDF3EE    Success/positive background tints
```

Define these as Tailwind custom colours in `tailwind.config.ts`.

### Layout and Design Direction

Follow the same principles as pellar.co.uk:

- **Left-aligned text everywhere.** No centre-aligned body text. No centre-aligned headings.
- **Generous whitespace.** Cards get 20px+ padding. Sections breathe.
- **No decorative elements.** No stock images, illustrations, gradient blobs, background patterns, or decorative icons. The content is the interface.
- **No bullet points in user-facing UI copy.** Use prose, numbered items, or structured layout instead.
- **No emoji anywhere.**
- **Sidebar:** 220px fixed width, ink background, DM Sans throughout. Wordmark "PELLAR" at top in uppercase with "Portal" label beneath in small muted text.
- **Cards:** White background, 1px warm-gray border, 8px border-radius. No shadows unless hover state.
- **Tables:** Clean, minimal borders. Cream header row. Comfortable row height (12px padding).
- **Badges/pills:** Small, uppercase, tight letter-spacing. Coloured by stage or status.

### Things to Avoid

- No serif fonts of any kind
- No gradient backgrounds or decorative blobs
- No stock images or illustrations
- No centre-aligned body text
- No bullet points in user-facing copy
- No emoji
- No words: "solutions", "bespoke", "leverage", "synergy", "cutting-edge", "digital transformation"
- No em dashes in copy
- No exclamation marks

## Coding Conventions

- TypeScript strict mode. No `any`.
- Server components by default. `"use client"` only when needed.
- Supabase reads via server client in server components. Service role client for writes in API routes and crons.
- Service functions in `lib/services/` are stateless, exported as named functions. No classes.
- Prompts in `lib/prompts/` are exported string constants with `${variable}` template literals.
- All API routes validate input. Return typed JSON responses.
- Error boundaries on each major page section.
- Loading states using Next.js `loading.tsx` convention.

## Auth

Supabase Auth with email/password. No public access. Portal is internal-only.
Initial user: Alex. Future: any Pellar team member invited via Supabase Auth admin.
`middleware.ts` checks auth on all `(portal)` routes and redirects to `/login` if unauthenticated.

API routes under `api/cron/` verify `CRON_SECRET` via `Authorization: Bearer` header.
API route `api/webhook/resend` verifies Resend webhook signature.
All other API routes check for an authenticated Supabase session.

## Key Behaviours

### Lead Discovery (daily cron)
- Vercel cron at 06:00 UTC → `api/cron/discover` → calls `lib/services/discovery.ts`
- Targets 10 leads per day from Companies House + Google Places
- Focus: NE England SMEs with operational pain signals
- Each lead scored (0-100), matched to an offering, inserted into Supabase
- See PIPELINE.md for full discovery logic

### Outreach Email Sending
- Triggered from UI (server action) or auto after discovery for high-score leads
- `lib/services/email-drafter.ts` drafts via Claude API
- `lib/services/email-sender.ts` sends via Resend from `hello@pellar.co.uk`
- Lead stage updated to `contacted`. Email logged.

### Inbound Email Handling
- Resend forwards replies to `api/webhook/resend`
- Webhook verifies signature, calls `lib/services/intent-parser.ts`
- Claude classifies intent, updates lead stage, auto-generates briefing if positive

### Auto Follow-up
- Vercel cron at 10:00 UTC → `api/cron/followup` → calls `lib/services/followup.ts`
- Max 2 follow-ups per lead. Stale after 9 days with no response.

### Briefing Generation
- Triggered on positive inbound response or manually from UI
- Claude generates: situation summary, 6 discussion areas, company intel
- Stored in Supabase, surfaced in Briefings view

## Deployment

### Vercel
- Framework preset: Next.js
- Custom domain: `portal.pellar.co.uk`
- Set all env vars in Vercel dashboard
- Cron config in `vercel.json`

### Supabase
- Database managed via Supabase MCP / dashboard
- Schema in SCHEMA.md
- Resend inbound webhook URL: `https://portal.pellar.co.uk/api/webhook/resend`

## Scope Boundaries

DO build:
- Lead management CRM (full CRUD)
- Automated lead discovery pipeline
- Outreach email drafting and sending
- Inbound email parsing and intent classification
- AI briefing generation
- Auto follow-up with sequence logic
- Dashboard, pipeline, outreach, and briefings views

DO NOT build (deferred):
- Calendar integration (Google Calendar)
- White-label CRM features
- Inbound traffic analytics
- Public-facing pages
- Billing or invoicing
- Client-facing portal

## Related Docs

- `SCHEMA.md` — Full Supabase database schema
- `API.md` — All API route handlers, prompts, service logic
- `PIPELINE.md` — Lead discovery, scoring, outreach automation
