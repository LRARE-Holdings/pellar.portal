import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/services/booking";

const ALLOWED_ORIGINS = new Set([
  "https://www.pellar.co.uk",
  "https://pellar.co.uk",
  "http://localhost:3000",
  "http://localhost:3001",
]);

function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  const date = req.nextUrl.searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date parameter required (YYYY-MM-DD)" },
      { status: 400, headers },
    );
  }

  try {
    const slots = await getAvailableSlots(date);
    return NextResponse.json({ slots }, { status: 200, headers });
  } catch (err) {
    console.error("Failed to get slots:", err);
    return NextResponse.json(
      { error: "Could not retrieve available slots" },
      { status: 500, headers },
    );
  }
}
