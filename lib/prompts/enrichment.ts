export function frustrationHypothesisPrompt(vars: {
  company: string;
  industry: string;
  location: string;
  website_info: string | null;
  officers: string | null;
  filing_category: string | null;
  company_age_years: number | null;
}) {
  return `Analyse this company and return a JSON object with two fields.

Company: ${vars.company}
Industry: ${vars.industry}
Location: ${vars.location}
Website info: ${vars.website_info || "No website found"}
Key people: ${vars.officers || "Unknown"}
Accounts category: ${vars.filing_category || "Unknown"}
Company age: ${vars.company_age_years ? `${vars.company_age_years} years` : "Unknown"}

Return ONLY valid JSON with these two fields:
{
  "frustration": "<A single specific sentence describing the most likely operational frustration this business faces. Reference specific tools, processes, or workflows common in ${vars.industry}. Focus on problems that software, integration, AI, or automation could solve. Do not be generic.>",
  "score": <An integer from 0 to 15 rating how severe and software-solvable this frustration is. 15 = severe, specific problem with a clear software solution. 0 = no discernible frustration or too vague to act on.>
}

Do not include any text outside the JSON object.`;
}
