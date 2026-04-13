import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { anthropic } from "@/lib/anthropic";
import { bookingBriefingPrompt } from "@/lib/prompts/booking-briefing";
import type { Company } from "@/types";

/**
 * Run post-booking enrichment and briefing generation.
 * Designed to run inside waitUntil() so it doesn't block the booking response.
 */
export async function runBookingIntelligence(params: {
  booking_id: string;
  company_id: string;
  contact_id: string;
  deal_id: string;
  visitor_name: string;
  visitor_email: string;
  visitor_company: string | null;
  visitor_message: string | null;
  service_interest: string | null;
}): Promise<void> {
  const sb = getSupabaseAdmin();

  try {
    // Mark enrichment as running
    await sb
      .from("bookings")
      .update({ enrichment_status: "running" })
      .eq("id", params.booking_id);

    // Fetch current company data
    const { data: company } = await sb
      .from("companies")
      .select("*")
      .eq("id", params.company_id)
      .single();

    if (!company) {
      await sb
        .from("bookings")
        .update({ enrichment_status: "failed" })
        .eq("id", params.booking_id);
      return;
    }

    const typedCompany = company as Company;

    // Generate a pre-meeting briefing via Claude
    const prompt = bookingBriefingPrompt({
      visitorName: params.visitor_name,
      visitorEmail: params.visitor_email,
      companyName: params.visitor_company ?? typedCompany.name,
      website: typedCompany.website,
      industry: typedCompany.industry,
      location: typedCompany.location,
      serviceInterest: params.service_interest,
      message: params.visitor_message,
      frustrationHypothesis: typedCompany.frustration_hypothesis,
      googleRating: typedCompany.google_rating,
      estimatedEmployees: typedCompany.estimated_employees,
      estimatedRevenue: typedCompany.estimated_revenue,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse the structured response
    const summary = extractSection(text, "SUMMARY") || text.slice(0, 500);
    const talkingPoints = extractListSection(text, "TALKING POINTS");
    const companyIntel = extractListSection(text, "COMPANY INTEL");

    // Insert briefing
    const { data: briefing } = await sb
      .from("briefings")
      .insert({
        deal_id: params.deal_id,
        company_id: params.company_id,
        summary,
        talking_points: talkingPoints,
        company_intel: companyIntel,
        response_context: params.visitor_message,
        generated_by: "booking_intelligence",
      })
      .select()
      .single();

    // Update booking with briefing reference and mark complete
    await sb
      .from("bookings")
      .update({
        enrichment_status: "complete",
        briefing_id: briefing?.id ?? null,
      })
      .eq("id", params.booking_id);

    // Log timeline event for briefing
    if (briefing) {
      await sb.from("timeline_events").insert({
        type: "briefing_generated",
        company_id: params.company_id,
        contact_id: params.contact_id,
        deal_id: params.deal_id,
        description: `Pre-meeting briefing generated for booking with ${params.visitor_name}`,
        metadata: { briefing_id: briefing.id, source: "booking_intelligence" },
      });
    }
  } catch (err) {
    console.error("Booking intelligence failed:", err);
    await sb
      .from("bookings")
      .update({ enrichment_status: "failed" })
      .eq("id", params.booking_id);
  }
}

function extractSection(text: string, heading: string): string | null {
  const regex = new RegExp(
    `##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`,
    "i",
  );
  const match = text.match(regex);
  return match?.[1]?.trim() ?? null;
}

function extractListSection(text: string, heading: string): string[] {
  const section = extractSection(text, heading);
  if (!section) return [];
  return section
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}
