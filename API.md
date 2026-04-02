# API Routes

All routes are Next.js App Router route handlers under `app/api/`. Logic lives in `lib/services/` and `lib/prompts/`.

Cron routes authenticate via `CRON_SECRET` bearer token. The Resend webhook route verifies the Resend signature. All other API routes check for an authenticated Supabase session via the server client.

---

## Webhook

### POST /api/webhook/resend

Receives Resend inbound email webhooks and delivery event webhooks.

```typescript
// app/api/webhook/resend/route.ts

export async function POST(req: Request) {
  // 1. Verify Resend webhook signature
  const signature = req.headers.get("resend-signature");
  const body = await req.text();
  if (!verifyResendSignature(body, signature, process.env.RESEND_WEBHOOK_SECRET!)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);

  // 2. Route by event type
  if (payload.type === "email.received") {
    // Inbound reply — process it
    const result = await processInbound(payload);
    return Response.json(result);
  } else {
    // Delivery event (delivered, opened, bounced)
    await handleDeliveryEvent(payload);
    return Response.json({ ok: true });
  }
}
```

---

## Cron Triggers

### GET /api/cron/discover

Vercel cron fires at 06:00 UTC daily.

```typescript
// app/api/cron/discover/route.ts

export async function GET(req: Request) {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDiscovery();
  return Response.json(result);
}
```

### GET /api/cron/followup

Vercel cron fires at 10:00 UTC daily.

```typescript
// app/api/cron/followup/route.ts

export async function GET(req: Request) {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runFollowups();
  return Response.json(result);
}
```

### Vercel cron config

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/discover", "schedule": "0 6 * * *" },
    { "path": "/api/cron/followup", "schedule": "0 10 * * *" }
  ]
}
```

---

## Discovery

### POST /api/discover

Run the lead discovery pipeline manually. Authenticated session required.

Request: No body required.

Response:
```json
{
  "discovered": 10,
  "leads": [
    {
      "id": "uuid",
      "company": "Hadrian Engineering",
      "score": 82,
      "offering": "software",
      "source": "companies_house"
    }
  ],
  "skipped": 3,
  "errors": []
}
```

Implementation: calls `runDiscovery()` from `lib/services/discovery.ts`. See PIPELINE.md for the full flow.

---

## Outreach

### POST /api/outreach/send

Draft and send an outreach email to a single lead. Authenticated session required.

Request:
```json
{
  "lead_id": "uuid",
  "custom_subject": null,
  "custom_body": null
}
```

Response:
```json
{
  "email_id": "uuid",
  "resend_id": "abc123",
  "subject": "Quoting shouldn't take two weeks",
  "status": "sent"
}
```

Flow (in `lib/services/email-sender.ts` + `lib/services/email-drafter.ts`):
1. Fetch lead from Supabase via admin client
2. If `contact_email` is null: return error
3. If no `custom_subject`/`custom_body`: call Claude API to draft email
   - Uses prompt from `lib/prompts/outreach.ts`
   - Context: company, contact, industry, location, frustration, offering
4. Insert email record in Supabase with status `queued`
5. Send via Resend:
   ```typescript
   await resend.emails.send({
     from: "Alex at Pellar <hello@pellar.co.uk>",
     to: lead.contact_email,
     subject,
     html: bodyHtml,
     text: bodyText,
     replyTo: "hello@pellar.co.uk",
     tags: [
       { name: "lead_id", value: lead.id },
       { name: "offering", value: lead.offering },
     ],
   });
   ```
6. Update email status to `sent` (or `failed`)
7. Update lead stage to `contacted` if currently `identified`
8. Insert `email_sent` activity log entry
9. Return email summary

### POST /api/outreach/followup

Run the follow-up pass. Called by cron or manually.

Request: No body required.

Response:
```json
{
  "followups_sent": 3,
  "leads_marked_stale": 1,
  "details": [
    { "lead_id": "uuid", "company": "Riverside Lettings", "sequence": 2 }
  ]
}
```

Flow (in `lib/services/followup.ts`):
1. Query leads where:
   - `stage = 'contacted'`
   - `stale = false`
   - `followup_count < 2`
   - Most recent outbound email > 3 days old
   - No inbound email exists
2. For each qualifying lead:
   a. Fetch previous emails for context
   b. Draft follow-up via Claude API (prompt from `lib/prompts/followup.ts`)
   c. Send via Resend
   d. Insert email record with `is_followup = true`
   e. Increment `followup_count`
   f. Log `followup_sent` activity
3. For leads where `followup_count >= 2` and last email > 3 days old with no response:
   - Set `stale = true`
4. Return summary

---

## Inbound

### POST /api/inbound

Process an inbound email. Called internally from the webhook handler.

Request: Resend inbound email payload.

Response:
```json
{
  "lead_id": "uuid",
  "intent": "meeting",
  "intent_summary": "Wants to schedule a call next Tuesday or Wednesday afternoon",
  "briefing_generated": true
}
```

Flow (in `lib/services/intent-parser.ts`):
1. Parse sender email from payload
2. Match to lead by `contact_email` in Supabase
3. If no match: log and return `{ matched: false }`
4. Insert inbound email record
5. Call Claude API to classify intent (prompt from `lib/prompts/intent.ts`)
6. Update email record with `intent` and `intent_summary`
7. Based on intent:
   - `meeting` or `more_info`: update stage to `responded`, generate briefing
   - `not_interested`: update stage to `lost`
   - `out_of_office`: log, no stage change
   - `unclear`: update stage to `responded` (manual review flag)
8. Log `email_received` activity
9. Return result

---

## Briefings

### POST /api/briefings/generate

Generate an AI briefing for a lead. Authenticated session required.

Request:
```json
{
  "lead_id": "uuid"
}
```

Response:
```json
{
  "briefing_id": "uuid",
  "summary": "Sarah Bell at Northern Law Associates responded...",
  "talking_points": ["...", "...", "...", "...", "...", "..."],
  "company_intel": ["Sector: Legal", "Location: Durham", "..."]
}
```

Flow (in `lib/services/briefing-gen.ts`):
1. Fetch lead + all emails from Supabase
2. Find most recent inbound email for context
3. Call Claude API (prompt from `lib/prompts/briefing.ts`):
   - Input: company, contact, industry, location, frustration, offering, email history, response content, notes
   - Output: JSON with `summary`, `talking_points` (6 items), `company_intel` (array)
4. Insert into Supabase `briefings` table
5. Log `briefing_generated` activity
6. Return briefing

---

## Server Actions

For user-triggered operations from the UI, use Next.js server actions rather than client-side fetch to API routes:

```typescript
// app/(portal)/leads/[id]/actions.ts
"use server";

import { sendOutreachEmail } from "@/lib/services/email-sender";
import { generateBriefing } from "@/lib/services/briefing-gen";

export async function triggerOutreach(leadId: string) {
  return sendOutreachEmail(leadId);
}

export async function triggerBriefing(leadId: string) {
  return generateBriefing(leadId);
}
```

---

## Claude API Prompts

All prompts live in `lib/prompts/` as exported template literal functions.

### Initial Outreach (lib/prompts/outreach.ts)

```typescript
export function initialOutreachPrompt(vars: {
  contact_name: string;
  company: string;
  industry: string;
  location: string;
  frustration: string;
  offering_description: string;
}) {
  return `
Write a cold outreach email from Alex at Pellar to ${vars.contact_name} at ${vars.company}.

Context:
- They are a ${vars.industry} business in ${vars.location}
- Their likely pain point: ${vars.frustration}
- We want to offer: ${vars.offering_description}

Rules:
- Subject line must reference their specific problem, not Pellar
- 3-5 short paragraphs maximum
- Open by naming their problem directly. Show you understand it.
- Briefly mention that Pellar builds software/integrations/AI for businesses like theirs
- Do not mention pricing
- Do not use buzzwords (digital transformation, leverage, synergy, cutting-edge, empower, unlock, seamless)
- Do not use em dashes
- CTA: suggest a 20-minute call to explore whether there is a fit
- Sign off as Alex, Pellar
- Tone: direct, warm, human. Like a knowledgeable peer, not a salesperson.

Return a JSON object with "subject", "body_html", and "body_text" fields.
body_html should use simple HTML (p tags, no inline styles, no images).
body_text should be the plain text version.
`;
}
```

### Follow-ups (lib/prompts/followup.ts)

```typescript
export function followup1Prompt(vars: {
  previous_subject: string;
  previous_body: string;
  contact_name: string;
  company: string;
  industry: string;
  location: string;
  frustration: string;
}) {
  return `
Write a follow-up email. First follow-up after no response to initial outreach.

Previous email subject: ${vars.previous_subject}
Previous email body: ${vars.previous_body}
Lead: ${vars.contact_name} at ${vars.company} (${vars.industry}, ${vars.location})
Their pain point: ${vars.frustration}

Rules:
- Keep it very short (2-3 sentences)
- Take a different angle from the first email
- Acknowledge they are busy
- Reference one specific thing from the original email
- End with a soft question, not a hard CTA
- Do not use buzzwords or em dashes

Return a JSON object with "subject", "body_html", and "body_text" fields.
`;
}

export function followup2Prompt(vars: {
  contact_name: string;
  company: string;
  frustration: string;
}) {
  return `
Write a final follow-up email. Second and last follow-up.

Lead: ${vars.contact_name} at ${vars.company}
Original topic: ${vars.frustration}

Rules:
- Maximum 2 sentences
- Be gracious, not pushy
- Leave the door open
- Do not use buzzwords or em dashes

Return a JSON object with "subject", "body_html", and "body_text" fields.
`;
}
```

### Intent Parsing (lib/prompts/intent.ts)

```typescript
export function intentParsePrompt(vars: {
  frustration: string;
  offering_description: string;
  previous_subject: string;
  inbound_body: string;
}) {
  return `
Analyse this email response from a sales prospect.

Our original outreach was about: ${vars.frustration}
Our offering: ${vars.offering_description}
Our previous email subject: ${vars.previous_subject}

Their response:
---
${vars.inbound_body}
---

Return a JSON object with:
- intent: one of "meeting", "more_info", "not_interested", "out_of_office", "unclear"
- summary: one sentence describing what they want
- meeting_preference: if intent is "meeting", extract any time/date preferences. null otherwise.
- questions: array of any specific questions they asked. Empty array if none.
`;
}
```

### Briefing Generation (lib/prompts/briefing.ts)

```typescript
export function briefingPrompt(vars: {
  company: string;
  industry: string;
  location: string;
  contact_name: string;
  frustration: string;
  offering_description: string;
  response_text: string;
  email_history: string;
  notes: string;
}) {
  return `
You are preparing a scoping call briefing for Pellar, a software company in Newcastle.

Lead: ${vars.company} (${vars.industry}, ${vars.location})
Contact: ${vars.contact_name}
Their problem: ${vars.frustration}
Our recommended offering: ${vars.offering_description}
Their response to our outreach: ${vars.response_text}
Email history:
${vars.email_history}
Internal notes: ${vars.notes}

Generate a JSON object with:
- summary: 2-3 sentence situation overview. Be specific. Reference their industry and problem.
- talking_points: Array of exactly 6 strings. Each is a discussion area for the scoping call. Start with their pain, move to discovery questions, end with next steps. Be commercially practical.
- company_intel: Array of key facts about this lead. Include sector, location, size if known, any red flags or opportunities.

Do not use buzzwords. Do not be generic. Every point should reference something specific to this lead.
Do not use em dashes.
`;
}
```

### Enrichment (lib/prompts/enrichment.ts)

```typescript
export function frustrationHypothesisPrompt(vars: {
  company: string;
  industry: string;
  location: string;
  website_info: string | null;
}) {
  return `
Based on the following, write a single sentence describing the most likely operational
frustration this business faces. Be specific to their industry and size.

Company: ${vars.company}
Industry: ${vars.industry}
Location: ${vars.location}
Website info: ${vars.website_info || "No website found"}

Rules:
- One sentence only
- Reference specific tools, processes, or workflows common in ${vars.industry}
- Focus on problems that software/automation could solve
- Do not be generic. "Inefficient processes" is useless. Be specific.
`;
}
```

---

## Delivery Event Handling

```typescript
// lib/services/email-sender.ts

export async function handleDeliveryEvent(payload: ResendEvent) {
  const resendId = payload.data?.email_id;
  if (!resendId) return;

  const statusMap: Record<string, string> = {
    "email.delivered": "delivered",
    "email.opened": "opened",
    "email.bounced": "bounced",
  };

  const newStatus = statusMap[payload.type];
  if (!newStatus) return;

  await supabaseAdmin
    .from("emails")
    .update({ status: newStatus })
    .eq("resend_id", resendId);
}
```
