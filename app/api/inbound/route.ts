import { createClient } from "@/lib/supabase/server";
import { processInbound } from "@/lib/services/intent-parser";
import type { ResendInboundPayload } from "@/types";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json()) as ResendInboundPayload;

  if (!payload.from) {
    return Response.json(
      { error: "from address is required" },
      { status: 400 },
    );
  }

  const result = await processInbound(payload);
  return Response.json(result);
}
