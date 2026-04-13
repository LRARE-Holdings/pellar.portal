export function bookingBriefingPrompt(params: {
  visitorName: string;
  visitorEmail: string;
  companyName: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  serviceInterest: string | null;
  message: string | null;
  frustrationHypothesis: string | null;
  googleRating: number | null;
  estimatedEmployees: number | null;
  estimatedRevenue: string | null;
}): string {
  const lines = [
    `A prospect has booked a scoping call with Pellar Technologies. Generate a concise pre-meeting briefing.`,
    ``,
    `## Visitor details`,
    `- Name: ${params.visitorName}`,
    `- Email: ${params.visitorEmail}`,
    `- Company: ${params.companyName}`,
    params.website ? `- Website: ${params.website}` : null,
    params.industry ? `- Industry: ${params.industry}` : null,
    params.location ? `- Location: ${params.location}` : null,
    params.serviceInterest
      ? `- Service interest: ${params.serviceInterest}`
      : null,
    params.estimatedEmployees
      ? `- Estimated employees: ${params.estimatedEmployees}`
      : null,
    params.estimatedRevenue
      ? `- Estimated revenue: ${params.estimatedRevenue}`
      : null,
    params.googleRating
      ? `- Google rating: ${params.googleRating}`
      : null,
    params.frustrationHypothesis
      ? `- Existing hypothesis: ${params.frustrationHypothesis}`
      : null,
    ``,
    params.message
      ? `## Message from visitor\n${params.message}\n`
      : null,
    `## What Pellar offers`,
    `Custom software builds, systems integration, AI implementation, and process automation for UK SMEs.`,
    ``,
    `## Instructions`,
    `Produce a briefing with exactly these sections:`,
    ``,
    `## SUMMARY`,
    `2-3 sentences about the company and what they likely need. Be direct and specific.`,
    ``,
    `## TALKING POINTS`,
    `6 discussion topics as bullet points. Focus on understanding their operational pain before pitching. Include at least one question about their current process and one about what "good" looks like for them.`,
    ``,
    `## COMPANY INTEL`,
    `4-6 bullet points of relevant business context: what the company does, market position, likely tech stack, regulatory considerations, or competitive landscape. Only include what's useful for the call.`,
    ``,
    `Be concise. No filler. No pleasantries. Write for someone preparing for a 30-minute call.`,
  ];

  return lines.filter((l) => l !== null).join("\n");
}
