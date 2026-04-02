"use server";

import {
  completeMeeting,
  cancelMeeting,
} from "@/lib/services/meetings";

export async function completeMeetingAction(meetingId: string) {
  return completeMeeting(meetingId);
}

export async function cancelMeetingAction(meetingId: string) {
  return cancelMeeting(meetingId);
}
