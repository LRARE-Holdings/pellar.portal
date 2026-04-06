import { supabaseAdmin } from "@/lib/supabase/admin";
import * as companiesHouse from "@/lib/clients/companies-house";
import * as googlePlaces from "@/lib/clients/google-places";
import Anthropic from "@anthropic-ai/sdk";
import { frustrationHypothesisPrompt } from "@/lib/prompts/enrichment";
import { scoreLead, matchOffering } from "@/lib/services/scoring";
import { estimateDealValue } from "@/lib/services/deal-value";
import type { Lead, EnrichedLead } from "@/types";
import { resolve } from "dns/promises";

function getAnthropicClient(): Anthropic {
  const key =
    process.env.PELLAR_ANTHROPIC_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    "";
  if (!key) {
    throw new Error("No Anthropic API key found");
  }
  return new Anthropic({ apiKey: key });
}

/**
 * POST /api/enrich
 * Re-enriches all leads that have incomplete data (missing frustration,
 * bad emails, missing phone, etc). Protected by CRON_SECRET.
 */
export async function POST(req: Request) {
  if (
    req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: leads } = await supabaseAdmin
    .from("leads")
    .select("*")
    .or(
      "frustration.is.null,frustration.eq.Unable to determine specific frustration for this business.",
    )
    .order("score", { ascending: false });

  if (!leads || leads.length === 0) {
    return Response.json({ message: "No leads need re-enrichment", updated: 0 });
  }

  const results: Array<{ company: string; score: number; frustration: string; error?: string }> = [];

  for (const row of leads) {
    const lead = row as Lead;
    try {
      // 1. Google Places for phone/website/rating if missing
      let phone = lead.phone;
      let website = lead.website;
      let googleRating = lead.google_rating;
      let googleReviews = lead.google_reviews;

      if (!phone || !website) {
        const place = await googlePlaces.findBusiness({
          query: `${lead.company} ${lead.location}`,
          region: "gb",
        });
        if (place) {
          phone = phone || place.phone;
          website = website || place.website;
          googleRating = googleRating || place.rating;
          googleReviews = googleReviews || place.reviewCount;
        }
      }

      // 2. Website scraping for social links
      let socialLinks = lead.social_links || {};
      let linkedinUrl = lead.linkedin_url;
      let websiteLooksOutdated = false;

      if (website) {
        try {
          const url = website.startsWith("http") ? website : `https://${website}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { "User-Agent": "PellarBot/1.0" },
          });
          clearTimeout(timeout);
          if (res.ok) {
            const html = (await res.text()).slice(0, 50000);

            // Social links
            const liMatch = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/company\/[a-zA-Z0-9_-]+\/?/i);
            if (liMatch) linkedinUrl = liMatch[0];
            const twMatch = html.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?/gi);
            if (twMatch) socialLinks = { ...socialLinks, twitter: twMatch[0] };
            const fbMatch = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+\/?/gi);
            if (fbMatch) socialLinks = { ...socialLinks, facebook: fbMatch[0] };

            // Outdated detection
            const lower = html.toLowerCase();
            const copyMatch = lower.match(/(?:©|\bcopyright\b)\s*(\d{4})/i);
            if (copyMatch && parseInt(copyMatch[1], 10) < new Date().getFullYear() - 2) {
              websiteLooksOutdated = true;
            }

            // Phone from website if still missing
            if (!phone) {
              const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
              const phoneMatch = text.match(/(?:(?:\+44|0044)\s?|0)(?:\d[\s.-]?){9,10}\d/g);
              if (phoneMatch) phone = phoneMatch[0].replace(/[\s.-]/g, "");
            }
          }
        } catch {
          // Website fetch failed, continue
        }
      }

      // 3. Filing history for employee/revenue if missing
      let estimatedEmployees = lead.estimated_employees || 10;
      let estimatedRevenue = lead.estimated_revenue;
      let filingCategory: string | null = null;

      if (lead.company_number && (!lead.estimated_revenue || !lead.estimated_employees)) {
        const filing = await companiesHouse.getFilingHistory(lead.company_number);
        filingCategory = filing.accountsCategory;
        estimatedEmployees = filing.estimatedEmployees || estimatedEmployees;
        estimatedRevenue = filing.estimatedRevenue || estimatedRevenue;
      }

      // 4. Get officers for contact name fix
      let contactName = lead.contact_name;
      let contactEmail = lead.contact_email;

      if (lead.company_number && (contactName === "Unknown" || !contactEmail)) {
        const officers = await companiesHouse.getOfficers(lead.company_number);
        if (officers.length > 0) {
          const best = officers[0];
          if (contactName === "Unknown") contactName = best.fullName;

          // Fix email if has spaces or is missing
          if (website && (!contactEmail || contactEmail.includes(" "))) {
            try {
              const urlObj = new URL(website.startsWith("http") ? website : `https://${website}`);
              const domain = urlObj.hostname.replace(/^www\./, "");
              const firstName = best.firstName.toLowerCase().trim().split(/\s+/)[0] || "";
              const lastName = best.lastName.toLowerCase().trim().replace(/\s+/g, "");
              if (firstName && lastName) {
                try {
                  const mx = await resolve(domain, "MX");
                  if (mx.length > 0) {
                    contactEmail = `${firstName}@${domain}`;
                  }
                } catch {
                  // No MX
                }
              }
            } catch {
              // URL parse failed
            }
          }
        }
      }

      // 5. Recency score
      let recencyScore = 2;
      if (lead.company_number) {
        const filing = await companiesHouse.getFilingHistory(lead.company_number);
        if (filing.latestFilingDate) {
          const months = (Date.now() - new Date(filing.latestFilingDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
          if (months <= 6) recencyScore = 10;
          else if (months <= 12) recencyScore = 7;
          else if (months <= 24) recencyScore = 4;
          else recencyScore = 1;
        }
      }

      // 6. Frustration via Claude
      const officersSummary = contactName !== "Unknown" ? contactName : null;
      let frustration = lead.frustration || "";
      let frustrationScore = 0;

      try {
        const claudePrompt = frustrationHypothesisPrompt({
          company: lead.company,
          industry: lead.industry,
          location: lead.location,
          website_info: null,
          officers: officersSummary,
          filing_category: filingCategory,
          company_age_years: lead.company_age_years,
        });

        const claude = getAnthropicClient();
        const message = await claude.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          messages: [{ role: "user", content: claudePrompt }],
        });

        const block = message.content[0];
        if (block.type === "text") {
          try {
            const parsed = JSON.parse(block.text.trim()) as {
              frustration?: string;
              score?: number;
            };
            frustration = parsed.frustration || frustration;
            frustrationScore = Math.min(15, Math.max(0, parsed.score || 0));
          } catch {
            frustration = block.text.trim();
            frustrationScore = 5;
          }
        }
      } catch (claudeErr) {
        console.error(
          `[re-enrich] Claude failed for ${lead.company}:`,
          claudeErr instanceof Error ? claudeErr.message : String(claudeErr),
        );
      }

      // 7. Offering
      const offering = matchOffering(frustration, lead.industry);

      // 8. Score
      const enrichedLead: EnrichedLead = {
        company: lead.company,
        contactName,
        contactEmail,
        industry: lead.industry,
        location: lead.location,
        website,
        frustration,
        offering,
        source: lead.source || "companies_house",
        notes: lead.notes,
        websiteLooksOutdated,
        estimatedEmployees,
        frustrationScore,
        recencyScore,
        phone,
        linkedinUrl,
        socialLinks: socialLinks as Record<string, string>,
        googleRating,
        googleReviews,
        estimatedRevenue,
        companyAgeYears: lead.company_age_years,
        companyNumber: lead.company_number || "",
      };

      const scored = scoreLead(enrichedLead);

      // 9. Update DB
      await supabaseAdmin
        .from("leads")
        .update({
          frustration,
          score: scored.score,
          offering,
          contact_name: contactName,
          contact_email: contactEmail,
          phone,
          website,
          linkedin_url: linkedinUrl,
          social_links: socialLinks,
          google_rating: googleRating,
          google_reviews: googleReviews,
          estimated_employees: estimatedEmployees,
          estimated_revenue: estimatedRevenue,
          deal_value: estimateDealValue(
            offering,
            lead.industry,
            scored.score,
            lead.notes,
            frustration,
            website,
          ),
        })
        .eq("id", lead.id);

      results.push({
        company: lead.company,
        score: scored.score,
        frustration: frustration.slice(0, 100),
      });

      // Delay between leads to respect Claude rate limits
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      results.push({
        company: lead.company,
        score: lead.score,
        frustration: "FAILED",
        error: err instanceof Error ? err.message : "Unknown",
      });
    }
  }

  return Response.json({
    updated: results.filter((r) => !r.error).length,
    failed: results.filter((r) => r.error).length,
    results,
  });
}
