// Auto-outreach is disabled as part of the relationship-first CRM rebuild.
// The portal no longer sends emails autonomously. Drafts are created via the
// drafts service and require explicit user approval before sending.
// Endpoint preserved as a no-op in case Vercel is still scheduled to hit it.

export async function GET(req: Request) {
  if (
    req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    disabled: true,
    reason: "auto_outreach_retired",
    message:
      "Auto-outreach has been retired. Use the drafts queue and approve manually.",
  });
}
