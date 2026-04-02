import { runDiscovery } from "@/lib/services/discovery";

export async function GET(req: Request) {
  if (
    req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDiscovery();
  return Response.json(result);
}
