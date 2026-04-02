import { createClient } from "@/lib/supabase/server";
import { runDiscovery } from "@/lib/services/discovery";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDiscovery();
  return Response.json(result);
}
