# Lead Discovery and Outreach Pipeline

All pipeline logic is in `lib/services/` and `lib/clients/`. Triggered by Vercel cron jobs and user actions.

## Lead Discovery

### Target Profile

- **Geography**: North East England (Tyne and Wear, County Durham, Northumberland, Teesside, North Yorkshire border)
- **Company size**: 5-100 employees (SME sweet spot)
- **Sectors**: Manufacturing, legal, financial services, healthcare, property, construction, hospitality, logistics, professional services, education, retail, technology
- **Signal**: Operational frustration — manual processes, spreadsheet dependency, disconnected tools, outdated systems, visible growth without infrastructure to match

### Discovery Sources

1. **Companies House API** (`https://api.company-information.service.gov.uk`)
   - Client: `lib/clients/companies-house.ts`
   - Search by registered address postcode areas: NE, DH, SR, TS, DL
   - Filter: active companies, incorporated > 1 year, SIC codes matching target sectors
   - Extract: company name, registered address, SIC code, incorporation date, officer names
   - Rate limit: 600 requests per 5 minutes
   - Auth: API key in `COMPANIES_HOUSE_API_KEY`

2. **Google Places API** (`https://maps.googleapis.com/maps/api/place`)
   - Client: `lib/clients/google-places.ts`
   - Search by category + location (e.g. "manufacturing companies Newcastle")
   - Extract: business name, address, website, phone, rating, review count
   - Auth: API key in `GOOGLE_PLACES_API_KEY`

### Sector Rotation

Rotate through industry groups across the week to avoid clustering:

```typescript
// lib/services/discovery.ts

const SECTOR_SCHEDULE: Record<number, string[]> = {
  1: ["Manufacturing", "Construction"],          // Monday
  2: ["Legal", "Financial Services"],             // Tuesday
  3: ["Healthcare", "Professional Services"],     // Wednesday
  4: ["Property", "Hospitality"],                 // Thursday
  5: ["Logistics", "Retail", "Technology"],       // Friday
  // 0, 6 = weekend, no discovery
};

function getTodaysSectors(): string[] {
  const day = new Date().getDay();
  return SECTOR_SCHEDULE[day] || [];
}
```

### SIC Code Mapping

```typescript
const SECTOR_SIC_CODES: Record<string, string[]> = {
  Manufacturing: ["10", "11", "13", "14", "15", "16", "17", "18", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33"],
  Legal: ["69"],
  "Financial Services": ["64", "65", "66"],
  Healthcare: ["86", "87", "88"],
  Property: ["68"],
  Construction: ["41", "42", "43"],
  Hospitality: ["55", "56"],
  Logistics: ["49", "50", "51", "52", "53"],
  "Professional Services": ["70", "71", "73", "74"],
  Education: ["85"],
  Retail: ["47"],
  Technology: ["62", "63"],
};
```

### Discovery Flow (lib/services/discovery.ts)

```typescript
export async function runDiscovery(): Promise<DiscoveryResult> {
  const sectors = getTodaysSectors();
  if (sectors.length === 0) {
    return { discovered: 0, leads: [], skipped: 0, errors: [] };
  }

  // 1. Query Companies House for each sector
  const candidates: CompanyCandidate[] = [];
  for (const sector of sectors) {
    const sicCodes = SECTOR_SIC_CODES[sector];
    for (const postcodeArea of ["NE", "DH", "SR", "TS", "DL"]) {
      const results = await companiesHouse.search({
        sicCodes,
        postcodeArea,
        status: "active",
        incorporatedAfter: "2015-01-01",
      });
      candidates.push(...results.map(r => ({ ...r, industry: sector })));
    }
  }

  // 2. Dedup against existing leads
  const { data: existing } = await supabaseAdmin
    .from("leads")
    .select("company, location");
  const existingSet = new Set(
    (existing || []).map(l => `${l.company.toLowerCase()}|${l.location.toLowerCase()}`)
  );
  const fresh = candidates.filter(
    c => !existingSet.has(`${c.name.toLowerCase()}|${c.location.toLowerCase()}`)
  );

  // 3. Enrich candidates (process more than 10 to allow filtering)
  const enriched: EnrichedLead[] = [];
  for (const candidate of fresh.slice(0, 30)) {
    const lead = await enrichLead(candidate);
    if (lead) enriched.push(lead);
  }

  // 4. Score and rank
  const scored = enriched.map(scoreLead).sort((a, b) => b.score - a.score);

  // 5. Take top 10
  const topLeads = scored.slice(0, 10);

  // 6. Insert into Supabase
  const inserted: Lead[] = [];
  for (const lead of topLeads) {
    const { data } = await supabaseAdmin
      .from("leads")
      .insert({
        company: lead.company,
        contact_name: lead.contactName,
        contact_email: lead.contactEmail,
        industry: lead.industry,
        location: lead.location,
        website: lead.website,
        stage: "identified",
        score: lead.score,
        offering: lead.offering,
        frustration: lead.frustration,
        notes: lead.notes,
        source: lead.source,
      })
      .select()
      .single();

    if (data) {
      await supabaseAdmin.from("activity_log").insert({
        lead_id: data.id,
        type: "lead_created",
        description: `Discovered ${data.company} via ${lead.source}`,
      });
      inserted.push(data);
    }
  }

  return {
    discovered: inserted.length,
    leads: inserted,
    skipped: fresh.length - enriched.length,
    errors: [],
  };
}
```

### Enrichment (lib/services/enrichment.ts)

```typescript
export async function enrichLead(candidate: CompanyCandidate): Promise<EnrichedLead | null> {
  // 1. Google Places lookup for website + contact info
  const place = await googlePlaces.findBusiness({
    query: `${candidate.name} ${candidate.location}`,
    region: "uk",
  });

  const website = place?.website || null;

  // 2. Website info extraction (simple fetch + text extract, no JS rendering)
  let websiteInfo: string | null = null;
  if (website) {
    websiteInfo = await extractWebsiteInfo(website);
  }

  // 3. Contact person from Companies House officers
  const officers = await companiesHouse.getOfficers(candidate.companyNumber);
  const contact = pickBestContact(officers); // Prefer MD, ops director, practice manager

  // 4. Email construction
  let email: string | null = null;
  const domain = website ? extractDomain(website) : null;
  if (domain && contact) {
    const candidates = generateEmailCandidates(contact.firstName, contact.lastName, domain);
    email = await verifyBestEmail(candidates);
  }

  // 5. Frustration hypothesis via Claude
  const frustration = await generateFrustration({
    company: candidate.name,
    industry: candidate.industry,
    location: candidate.location,
    websiteInfo,
  });

  // 6. Match offering
  const offering = matchOffering(frustration, candidate.industry);

  return {
    company: candidate.name,
    contactName: contact?.fullName || "Unknown",
    contactEmail: email,
    industry: candidate.industry,
    location: candidate.location,
    website,
    frustration,
    offering,
    source: candidate.source,
    notes: buildNotes(candidate, websiteInfo, officers),
  };
}
```

### Email Discovery

```typescript
function generateEmailCandidates(firstName: string, lastName: string, domain: string): string[] {
  const f = firstName.toLowerCase().trim();
  const l = lastName.toLowerCase().trim();
  return [
    `${f}@${domain}`,
    `${f}.${l}@${domain}`,
    `${f[0]}.${l}@${domain}`,
    `${f[0]}${l}@${domain}`,
    `hello@${domain}`,
    `info@${domain}`,
  ];
}

async function verifyBestEmail(candidates: string[]): Promise<string | null> {
  const domain = candidates[0].split("@")[1];
  const hasMx = await checkMxRecord(domain);
  if (hasMx) {
    return candidates[0]; // Return first personal pattern
  }
  return null;
}
```

If no reliable email: lead created with `contact_email = null`, stays in `identified` for manual research.

## Lead Scoring (lib/services/scoring.ts)

```typescript
export function scoreLead(lead: EnrichedLead): ScoredLead {
  let score = 0;

  // Email found (20 points)
  if (lead.contactEmail && lead.contactName !== "Unknown") {
    score += 20;
  } else if (lead.contactEmail) {
    score += 10;
  }

  // Website quality (15 points) — worse website = more pain = better lead
  if (!lead.website) {
    score += 12;
  } else if (lead.websiteLooksOutdated) {
    score += 15;
  } else {
    score += 3;
  }

  // Industry fit (15 points)
  const HIGH_FIT = ["Manufacturing", "Legal", "Healthcare", "Construction"];
  const MED_FIT = ["Financial Services", "Property", "Logistics", "Professional Services"];
  if (HIGH_FIT.includes(lead.industry)) {
    score += 15;
  } else if (MED_FIT.includes(lead.industry)) {
    score += 10;
  } else {
    score += 5;
  }

  // Location proximity (10 points)
  const CORE = ["Newcastle", "Gateshead"];
  const TYNE_WEAR = ["Sunderland", "North Shields", "South Shields", "Wallsend", "Whitley Bay"];
  if (CORE.some(loc => lead.location.includes(loc))) {
    score += 10;
  } else if (TYNE_WEAR.some(loc => lead.location.includes(loc))) {
    score += 8;
  } else {
    score += 5;
  }

  // Company size signals (15 points)
  if (lead.estimatedEmployees) {
    if (lead.estimatedEmployees >= 10 && lead.estimatedEmployees <= 50) {
      score += 15;
    } else if (lead.estimatedEmployees >= 5 || lead.estimatedEmployees <= 100) {
      score += 10;
    } else {
      score += 3;
    }
  }

  // Frustration signals (15 points)
  score += lead.frustrationScore || 0;

  // Recency (10 points)
  score += lead.recencyScore || 0;

  return { ...lead, score: Math.min(score, 100) };
}
```

### Offering Matching

```typescript
export function matchOffering(frustration: string, industry: string): OfferingType {
  const lower = frustration.toLowerCase();

  if (["disconnect", "multiple systems", "integrate", "connect", "different tools"].some(w => lower.includes(w))) {
    return "integration";
  }
  if (["manual", "repetitive", "spreadsheet", "chasing", "phone", "paper"].some(w => lower.includes(w))) {
    return "automation";
  }
  if (["data", "predict", "document", "extract", "classify", "analysis"].some(w => lower.includes(w))) {
    return "ai";
  }

  return "software";
}
```

## Outreach Pipeline

### Sequence Timing

```
Day 0:  Lead identified and scored
Day 0:  If score >= 60 and email found → auto-send initial outreach
Day 3:  If no response → follow-up 1 (different angle)
Day 6:  If no response → follow-up 2 (gracious close)
Day 9:  If no response → mark as stale
```

Leads with score < 60 or no email stay in `identified` for manual review.

### Email Sending Guards (lib/services/email-sender.ts)

```typescript
async function canSendToday(): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from("emails")
    .select("id", { count: "exact", head: true })
    .eq("direction", "outbound")
    .gte("created_at", todayStart.toISOString());

  return (count || 0) < 10;
}

function isSendWindow(): boolean {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  return day >= 1 && day <= 5 && hour >= 8 && hour < 10;
}
```

Rules:
- Maximum 10 outreach emails per day (protect pellar.co.uk domain reputation)
- Send window: 08:00-10:00 UTC only (morning inbox in UK)
- No sends on Saturday or Sunday
- One email per lead per day maximum
- All emails include Resend one-click unsubscribe
- Reply-to: `hello@pellar.co.uk`
- From: `Alex at Pellar <hello@pellar.co.uk>`

### Email Content Rules

Enforced in Claude API prompts (see API.md):

- Subject line references the lead's specific problem, never Pellar
- No buzzwords: digital transformation, leverage, synergy, cutting-edge, empower, unlock, seamless
- No em dashes
- Short paragraphs (1-2 sentences each)
- Direct, human tone
- Always invite to a scoping call, never suggest pricing
- Body: hook (their problem) → brief credibility → CTA (call)

### Follow-up Differentiation

- **Initial**: Lead with their specific pain point
- **Follow-up 1**: Different angle. Industry trend or "what we have seen work." Still short (2-3 sentences).
- **Follow-up 2**: Gracious close. No pitch. Leave the door open.

## Inbound Response Handling

Triggered by Resend webhook → `POST /api/webhook/resend` → calls `processInbound()`.

```typescript
// lib/services/intent-parser.ts

export async function processInbound(payload: ResendInboundPayload): Promise<InboundResult> {
  const senderEmail = payload.from;

  // 1. Match to lead
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("contact_email", senderEmail)
    .single();

  if (!lead) return { matched: false };

  // 2. Store inbound email
  const { data: email } = await supabaseAdmin
    .from("emails")
    .insert({
      lead_id: lead.id,
      direction: "inbound",
      status: "received",
      from_address: senderEmail,
      to_address: "hello@pellar.co.uk",
      subject: payload.subject,
      body_html: payload.html,
      body_text: payload.text,
    })
    .select()
    .single();

  // 3. Classify intent via Claude
  const intentResult = await parseIntent({
    frustration: lead.frustration,
    offeringDescription: OFFERING_DESCRIPTIONS[lead.offering],
    previousSubject: await getLastOutboundSubject(lead.id),
    inboundBody: payload.text || payload.html,
  });

  // 4. Update email with intent
  await supabaseAdmin
    .from("emails")
    .update({
      intent: intentResult.intent,
      intent_summary: intentResult.summary,
    })
    .eq("id", email!.id);

  // 5. Act on intent
  let briefingGenerated = false;
  if (["meeting", "more_info"].includes(intentResult.intent)) {
    await supabaseAdmin
      .from("leads")
      .update({ stage: "responded" })
      .eq("id", lead.id);
    await generateBriefing(lead.id);
    briefingGenerated = true;
  } else if (intentResult.intent === "not_interested") {
    await supabaseAdmin
      .from("leads")
      .update({ stage: "lost" })
      .eq("id", lead.id);
  }

  await supabaseAdmin.from("activity_log").insert({
    lead_id: lead.id,
    type: "email_received",
    description: intentResult.summary,
    metadata: { intent: intentResult.intent },
  });

  return {
    matched: true,
    leadId: lead.id,
    intent: intentResult.intent,
    intentSummary: intentResult.summary,
    briefingGenerated,
  };
}
```

## Rate Limits and Costs

| Service | Limit | Cost | Notes |
|---------|-------|------|-------|
| Companies House API | 600/5min | Free | Generous for daily batch |
| Google Places API | Usage-based | ~$17/1000 requests | ~$1-2/day |
| Resend Pro | 50k/day | $20/mo | Need Pro for reliable sending |
| Claude API (Sonnet) | Usage-based | ~$5-10/mo | ~10 enrichments + 10 emails + 2-3 briefings/day |
| Vercel Pro | Crons + functions | $20/mo | Need Pro for 2 daily crons |

Estimated total: ~$45-50/mo.

## Data Retention

- Leads: kept indefinitely (even stale, for future revisit)
- Emails: kept indefinitely (audit trail)
- Briefings: kept indefinitely
- Activity log: kept indefinitely
