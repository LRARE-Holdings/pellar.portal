"use server";

import { sendOutreachEmail } from "@/lib/services/email-sender";
import { generateBriefing } from "@/lib/services/briefing-gen";
import {
  scheduleMeeting,
  cancelMeeting,
} from "@/lib/services/meetings";

export async function triggerOutreach(leadId: string) {
  return sendOutreachEmail(leadId);
}

export async function triggerBriefing(leadId: string) {
  return generateBriefing(leadId);
}

export async function scheduleMeetingAction(
  leadId: string,
  scheduledAt: string,
  durationMinutes: number,
  notes: string,
) {
  return scheduleMeeting({
    leadId,
    title: "Scoping call",
    scheduledAt,
    durationMinutes,
    notes: notes || undefined,
  });
}

export async function cancelMeetingAction(meetingId: string) {
  return cancelMeeting(meetingId);
}
