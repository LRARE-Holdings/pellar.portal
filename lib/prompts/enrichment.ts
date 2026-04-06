export function frustrationHypothesisPrompt(vars: {
  company: string;
  industry: string;
  location: string;
  website_info: string | null;
  officers: string | null;
  filing_category: string | null;
  company_age_years: number | null;
}) {
  return `You are analysing a professional services firm to find an operational problem that custom software could solve.

Company: ${vars.company}
Sector: ${vars.industry}
Location: ${vars.location}
Website info: ${vars.website_info || "No website found"}
Key people: ${vars.officers || "Unknown"}
Accounts category: ${vars.filing_category || "Unknown"}
Firm age: ${vars.company_age_years ? `${vars.company_age_years} years` : "Unknown"}

IMPORTANT CONTEXT:
These firms already have practice management software (Clio, Leap, IRIS, Xero Practice Manager, etc.) that handles time tracking, billing, and case management. Do NOT suggest problems in those areas.

Instead, focus on the operational blind spots that most professional services firms have NO tooling for:

- Business development / sales pipeline: no CRM, prospects tracked in heads or spreadsheets, no visibility on conversion rates or where work comes from
- Cost and supplier analysis: nobody reviews subscription spend, supplier costs, utility bills, or identifies savings opportunities
- Lead intelligence: no data on which enquiry sources convert best, which practice areas are growing, seasonal patterns in new work
- Meeting and client intelligence: going into prospect meetings or reviews with no structured briefing, no pre-meeting research automation
- Client onboarding automation: still emailing Word docs, chasing ID checks manually, no self-serve portal for new clients
- Referral and introducer tracking: no system to measure which accountants, agents, or contacts refer the best work
- Pipeline and capacity dashboards: partners cannot see at a glance what work is coming in, who is overloaded, what the revenue forecast looks like
- Marketing ROI: spending on directories, sponsorships, networking events with no way to attribute new clients back to the spend
- Internal knowledge management: no way to quickly find past precedents, templates, or who in the firm has handled similar work before

Pick the ONE problem that is most likely for this specific firm given its size, age, sector, and what you can see from the website. Be precise and reference their actual business context.

Return ONLY valid JSON:
{
  "frustration": "<One specific sentence about the operational blind spot this firm most likely has. Reference their sector, size, and context. Do not be generic.>",
  "score": <Integer 0-15. 15 = clearly solvable with software and the firm is the right size to buy. 0 = not a good fit.>
}

No text outside the JSON.`;
}
