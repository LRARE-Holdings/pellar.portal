import { NextRequest, NextResponse } from "next/server";
import { reserveSlot } from "@/lib/services/booking";
import {
  sendBookingConfirmationToVisitor,
  sendBookingNotificationToAdmin,
} from "@/lib/services/booking-confirmation";
import { runBookingIntelligence } from "@/lib/services/booking-intelligence";
import { after } from "next/server";

const ALLOWED_ORIGINS = new Set([
  "https://www.pellar.co.uk",
  "https://pellar.co.uk",
  "http://localhost:3000",
  "http://localhost:3001",
]);

function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function clean(v: unknown, max: number): string {
  if (!isString(v)) return "";
  return v.trim().slice(0, max);
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

interface ReserveBody {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  message?: unknown;
  service_interest?: unknown;
  meeting_type?: unknown;
  slot_start?: unknown;
  website?: unknown; // honeypot
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  let body: ReserveBody;
  try {
    body = (await req.json()) as ReserveBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers },
    );
  }

  // Honeypot
  if (isString(body.website) && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true }, { status: 200, headers });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const company = clean(body.company, 200);
  const message = clean(body.message, 4000);
  const serviceInterest = clean(body.service_interest, 60);
  const meetingType = clean(body.meeting_type, 20);
  const slotStart = clean(body.slot_start, 40);

  if (!name) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400, headers },
    );
  }
  if (!email || !isEmail(email)) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400, headers },
    );
  }
  if (meetingType !== "in_person" && meetingType !== "google_meet") {
    return NextResponse.json(
      { error: "meeting_type must be in_person or google_meet" },
      { status: 400, headers },
    );
  }
  if (!slotStart) {
    return NextResponse.json(
      { error: "slot_start is required" },
      { status: 400, headers },
    );
  }

  // Validate slot_start is a valid ISO date
  const slotDate = new Date(slotStart);
  if (isNaN(slotDate.getTime())) {
    return NextResponse.json(
      { error: "slot_start must be a valid ISO datetime" },
      { status: 400, headers },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined;

  try {
    const result = await reserveSlot({
      name,
      email,
      company: company || undefined,
      message: message || undefined,
      service_interest: serviceInterest || undefined,
      meeting_type: meetingType as "in_person" | "google_meet",
      slot_start: slotStart,
      ip_address: ip,
    });

    // Fire-and-forget: emails and intelligence run after response is sent
    after(
      Promise.allSettled([
        sendBookingConfirmationToVisitor(result.booking),
        sendBookingNotificationToAdmin(result.booking),
        runBookingIntelligence({
          booking_id: result.booking.id,
          company_id: result.company_id,
          contact_id: result.contact_id,
          deal_id: result.deal_id,
          visitor_name: name,
          visitor_email: email,
          visitor_company: company || null,
          visitor_message: message || null,
          service_interest: serviceInterest || null,
        }),
      ]),
    );

    return NextResponse.json(
      {
        ok: true,
        booking_id: result.booking.id,
        meet_link: result.booking.google_meet_link,
      },
      { status: 200, headers },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not complete booking";
    const status = message.includes("no longer available")
      ? 409
      : message.includes("Too many")
        ? 429
        : 500;
    return NextResponse.json({ error: message }, { status, headers });
  }
}
