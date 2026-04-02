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
