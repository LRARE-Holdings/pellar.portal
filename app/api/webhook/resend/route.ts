import { processInbound } from "@/lib/services/inbound";
import { handleDeliveryEvent } from "@/lib/services/email-sender";
import type { ResendInboundPayload, ResendEvent } from "@/types";
import { createHmac, timingSafeEqual } from "crypto";

function verifyResendSignature(
  body: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;

  // Resend signature format: t=timestamp,v1=hash
  const parts = signature.split(",");
  const timestampPart = parts.find((p) => p.startsWith("t="));
  const hashPart = parts.find((p) => p.startsWith("v1="));

  if (!timestampPart || !hashPart) return false;

  const timestamp = timestampPart.slice(2);
  const expectedHash = hashPart.slice(3);

  const payload = `${timestamp}.${body}`;
  const computedHash = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(computedHash),
      Buffer.from(expectedHash),
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  // 1. Verify Resend webhook signature
  const signature = req.headers.get("resend-signature");
  const body = await req.text();

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (webhookSecret) {
    if (!verifyResendSignature(body, signature, webhookSecret)) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const payload = JSON.parse(body) as ResendEvent;

  // 2. Route by event type
  if (payload.type === "email.received") {
    const inboundPayload: ResendInboundPayload = {
      from: payload.data.from || "",
      to: Array.isArray(payload.data.to) ? payload.data.to[0] : "",
      subject: payload.data.subject || "",
      html: payload.data.html || "",
      text: payload.data.text || "",
    };
    const result = await processInbound(inboundPayload);
    return Response.json(result);
  } else {
    // Delivery event (delivered, opened, bounced)
    await handleDeliveryEvent(payload);
    return Response.json({ ok: true });
  }
}
