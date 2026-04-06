import Anthropic from "@anthropic-ai/sdk";

// Use PELLAR_ANTHROPIC_KEY as the primary key to avoid Claude Code's
// shell environment setting ANTHROPIC_API_KEY="" which overrides .env.local.
// Falls back to ANTHROPIC_API_KEY for Vercel production deployment.
function getApiKey(): string {
  const key =
    process.env.PELLAR_ANTHROPIC_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    "";
  return key;
}

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: getApiKey() });
  }
  return _client;
}

// Proxy that lazily initialises the Anthropic client on first use.
export const anthropic: Anthropic = new Proxy({} as Anthropic, {
  get(_target, prop) {
    const client = getClient();
    return (client as unknown as Record<string | symbol, unknown>)[prop];
  },
});
