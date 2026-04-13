import { resend } from "@/lib/resend";
import { wrapInBrandedTemplate } from "@/lib/email-template";
import type { Booking } from "@/types";

const FROM_ADDRESS = "Alex at Pellar <alex@pellar.co.uk>";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

export async function sendBookingConfirmationToVisitor(
  booking: Booking,
): Promise<void> {
  const isVirtual = booking.meeting_type === "google_meet";
  const date = formatDate(booking.slot_start);
  const time = formatTime(booking.slot_start);

  const locationLine = isVirtual
    ? booking.google_meet_link
      ? `<p style="margin: 0 0 14px; padding: 0;">Join via Google Meet: <a href="${booking.google_meet_link}" style="color: #2D5A3D;">${booking.google_meet_link}</a></p>`
      : `<p style="margin: 0 0 14px; padding: 0;">A Google Meet link will be in your calendar invite.</p>`
    : `<p style="margin: 0 0 14px; padding: 0;">We will meet at The Stamp Exchange, Westgate Road, Newcastle upon Tyne, NE1 1SA.</p>`;

  const bodyHtml = `
    <p style="margin: 0 0 14px; padding: 0;">Hi ${booking.visitor_name.split(" ")[0]},</p>
    <p style="margin: 0 0 14px; padding: 0;">Your call is confirmed for <strong>${date}</strong> at <strong>${time}</strong> (${booking.duration_minutes} minutes).</p>
    ${locationLine}
    <p style="margin: 0 0 14px; padding: 0;">If you need to reschedule, reply to this email and we will sort it out.</p>
  `;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: booking.visitor_email,
    subject: `Confirmed: call on ${date} at ${time}`,
    html: wrapInBrandedTemplate({ bodyHtml }),
  });
}

export async function sendBookingNotificationToAdmin(
  booking: Booking,
): Promise<void> {
  const isVirtual = booking.meeting_type === "google_meet";
  const date = formatDate(booking.slot_start);
  const time = formatTime(booking.slot_start);

  const bodyHtml = `
    <p style="margin: 0 0 14px; padding: 0;">New booking received.</p>
    <table style="border-collapse: collapse; font-size: 14px; line-height: 1.7;">
      <tr><td style="padding: 2px 12px 2px 0; color: #B8B0A8;">Name</td><td>${booking.visitor_name}</td></tr>
      <tr><td style="padding: 2px 12px 2px 0; color: #B8B0A8;">Email</td><td>${booking.visitor_email}</td></tr>
      ${booking.visitor_company ? `<tr><td style="padding: 2px 12px 2px 0; color: #B8B0A8;">Company</td><td>${booking.visitor_company}</td></tr>` : ""}
      <tr><td style="padding: 2px 12px 2px 0; color: #B8B0A8;">When</td><td>${date} at ${time}</td></tr>
      <tr><td style="padding: 2px 12px 2px 0; color: #B8B0A8;">Type</td><td>${isVirtual ? "Google Meet" : "In person"}</td></tr>
      ${booking.service_interest ? `<tr><td style="padding: 2px 12px 2px 0; color: #B8B0A8;">Interest</td><td>${booking.service_interest}</td></tr>` : ""}
    </table>
    ${booking.visitor_message ? `<p style="margin: 14px 0 0; padding: 12px; background: #F5F0EB; border-radius: 4px; font-size: 13px;">${booking.visitor_message}</p>` : ""}
  `;

  await resend.emails.send({
    from: "Pellar Portal <portal@pellar.co.uk>",
    to: "alex@pellar.co.uk",
    subject: `New booking: ${booking.visitor_name}${booking.visitor_company ? ` — ${booking.visitor_company}` : ""} (${date})`,
    html: wrapInBrandedTemplate({ bodyHtml }),
  });
}
