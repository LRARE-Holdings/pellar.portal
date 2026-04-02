"use client";

import { useState } from "react";
import Link from "next/link";
import { StageBadge } from "@/components/stage-badge";
import { ScoreDot } from "@/components/score-dot";
import type { Lead, LeadStage } from "@/types";

interface LeadTableProps {
  leads: Lead[];
}

export function LeadTable({ leads }: LeadTableProps) {
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const industries = Array.from(new Set(leads.map((l) => l.industry))).sort();

  const filtered = leads.filter((lead) => {
    if (stageFilter !== "all" && lead.stage !== stageFilter) return false;
    if (industryFilter !== "all" && lead.industry !== industryFilter)
      return false;
    if (
      searchQuery &&
      !lead.company.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !lead.contact_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search companies or contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64 rounded-lg border border-warm-gray bg-white px-3 py-2 text-sm text-ink placeholder:text-stone focus:border-forest focus:outline-none"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as LeadStage | "all")}
          className="rounded-lg border border-warm-gray bg-white px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
        >
          <option value="all">All stages</option>
          <option value="identified">Identified</option>
          <option value="contacted">Contacted</option>
          <option value="responded">Responded</option>
          <option value="scoping_call">Scoping Call</option>
          <option value="proposal">Proposal</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="rounded-lg border border-warm-gray bg-white px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
        >
          <option value="all">All industries</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-warm-gray bg-white">
        <table className="w-full">
          <thead>
            <tr className="bg-cream">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                Company
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                Contact
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                Industry
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                Location
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                Score
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                Value
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                Stage
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-stone">
                  No leads match your filters.
                </td>
              </tr>
            )}
            {filtered.map((lead) => (
              <tr
                key={lead.id}
                className="border-t border-warm-gray transition-colors hover:bg-cream/50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="text-sm font-medium text-ink hover:text-forest"
                  >
                    {lead.company}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-ink">
                  {lead.contact_name}
                </td>
                <td className="px-4 py-3 text-sm text-stone">
                  {lead.industry}
                </td>
                <td className="px-4 py-3 text-sm text-stone">
                  {lead.location}
                </td>
                <td className="px-4 py-3">
                  <ScoreDot score={lead.score} />
                </td>
                <td className="px-4 py-3 text-sm text-stone">
                  {lead.deal_value != null && lead.deal_value > 0
                    ? `GBP ${lead.deal_value.toLocaleString("en-GB")}`
                    : "\u2014"}
                </td>
                <td className="px-4 py-3">
                  <StageBadge stage={lead.stage} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-stone">
        {filtered.length} of {leads.length} leads
      </p>
    </div>
  );
}
