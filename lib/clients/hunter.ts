const BASE_URL = "https://api.hunter.io/v2";

interface HunterEmailFinderResponse {
  data: {
    first_name: string;
    last_name: string;
    email: string;
    score: number;
    domain: string;
    position: string | null;
    company: string | null;
    verification: {
      date: string | null;
      status: string | null;
    } | null;
  } | null;
  errors?: Array<{ id: string; code: number; details: string }>;
}

interface HunterEmailVerifierResponse {
  data: {
    email: string;
    score: number;
    status: string;
    result: string;
  } | null;
  errors?: Array<{ id: string; code: number; details: string }>;
}

export interface HunterEmailResult {
  email: string;
  score: number;
  verified: boolean;
}

function getApiKey(): string | null {
  return process.env.HUNTER_API_KEY || null;
}

/**
 * Find an email address for a person at a company domain.
 * Uses 1 credit per successful call.
 */
export async function findEmail(params: {
  domain: string;
  firstName: string;
  lastName: string;
}): Promise<HunterEmailResult | null> {
  const key = getApiKey();
  if (!key) return null;

  const url = `${BASE_URL}/email-finder?domain=${encodeURIComponent(params.domain)}&first_name=${encodeURIComponent(params.firstName)}&last_name=${encodeURIComponent(params.lastName)}&api_key=${key}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as HunterEmailFinderResponse;
    if (!data.data?.email) return null;

    return {
      email: data.data.email,
      score: data.data.score,
      verified: data.data.verification?.status === "valid",
    };
  } catch {
    return null;
  }
}

/**
 * Verify an existing email address.
 * Uses 0.5 credits per call.
 */
export async function verifyEmail(
  email: string,
): Promise<HunterEmailResult | null> {
  const key = getApiKey();
  if (!key) return null;

  const url = `${BASE_URL}/email-verifier?email=${encodeURIComponent(email)}&api_key=${key}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as HunterEmailVerifierResponse;
    if (!data.data) return null;

    return {
      email: data.data.email,
      score: data.data.score,
      verified: data.data.result === "deliverable",
    };
  } catch {
    return null;
  }
}
