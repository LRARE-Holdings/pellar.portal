import { supabaseAdmin } from "@/lib/supabase/admin";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

function getClientId(): string {
  return process.env.GOOGLE_CLIENT_ID || "";
}

function getClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET || "";
}

function getRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    "http://localhost:3000/api/auth/google/callback"
  );
}

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  return response.json();
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh access token");
  }

  return response.json();
}

async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data: token } = await supabaseAdmin
    .from("oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .single();

  if (!token) return null;

  const expiresAt = new Date(token.expires_at);
  const now = new Date();

  // Refresh if expiring within 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken(token.refresh_token);

      const newExpiresAt = new Date(
        Date.now() + refreshed.expires_in * 1000,
      );

      await supabaseAdmin
        .from("oauth_tokens")
        .update({
          access_token: refreshed.access_token,
          expires_at: newExpiresAt.toISOString(),
        })
        .eq("id", token.id);

      return refreshed.access_token;
    } catch {
      return null;
    }
  }

  return token.access_token;
}

export async function createEvent(
  userId: string,
  params: {
    summary: string;
    description: string;
    start: string;
    durationMinutes: number;
    attendeeEmail?: string;
    location?: string;
  },
): Promise<string | null> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

  const startDate = new Date(params.start);
  const endDate = new Date(
    startDate.getTime() + params.durationMinutes * 60 * 1000,
  );

  const event: Record<string, unknown> = {
    summary: params.summary,
    description: params.description,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: "Europe/London",
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: "Europe/London",
    },
  };

  if (params.attendeeEmail) {
    event.attendees = [{ email: params.attendeeEmail }];
  }

  if (params.location) {
    event.location = params.location;
  }

  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events?sendUpdates=all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  if (!response.ok) return null;

  const data = (await response.json()) as { id: string };
  return data.id;
}

export async function deleteEvent(
  userId: string,
  eventId: string,
): Promise<boolean> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return false;

  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return response.ok || response.status === 404;
}

export async function listEvents(
  userId: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleCalendarEvent[]> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return [];

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) return [];

  const data = (await response.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      description?: string;
      location?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      status?: string;
      attendees?: Array<{ email: string; responseStatus?: string }>;
      htmlLink?: string;
    }>;
  };

  return (data.items || [])
    .filter((item) => item.status !== "cancelled")
    .map((item) => ({
      id: item.id,
      summary: item.summary || "(No title)",
      description: item.description || null,
      location: item.location || null,
      start: item.start?.dateTime || item.start?.date || "",
      end: item.end?.dateTime || item.end?.date || "",
      isAllDay: !item.start?.dateTime,
      attendees: (item.attendees || []).map((a) => a.email),
      htmlLink: item.htmlLink || null,
    }));
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
  attendees: string[];
  htmlLink: string | null;
}

export async function hasValidTokens(userId: string): Promise<boolean> {
  const token = await getValidAccessToken(userId);
  return token !== null;
}
