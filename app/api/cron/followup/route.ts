// Followups are disabled as part of the relationship-first CRM rebuild.
// Stale deals are now surfaced in the Inbox for manual handling. Nothing is
// sent without explicit approval. Endpoint preserved as a no-op.

export async function GET(req: Request) {
  if (
    req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    disabled: true,
    reason: "followup_retired",
    message:
      "Auto-followup has been retired. Stale deals appear in the Inbox for manual triage.",
  });
}
