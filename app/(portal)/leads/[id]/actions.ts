"use server";

import { sendOutreachEmail } from "@/lib/services/email-sender";
import { generateBriefing } from "@/lib/services/briefing-gen";

export async function triggerOutreach(leadId: string) {
  return sendOutreachEmail(leadId);
}

export async function triggerBriefing(leadId: string) {
  return generateBriefing(leadId);
}
