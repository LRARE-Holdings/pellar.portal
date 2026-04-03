/**
 * One-time script: regenerate body_html for all outbound emails
 * to use the branded Pellar template with Woodpecker signature.
 *
 * Run with: npx tsx scripts/regenerate-email-html.ts
 */

import { wrapInBrandedTemplate, styleParagraphs } from "../lib/email-template";

// Inline Supabase client (avoids needing the full app context)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local manually (no dotenv dependency)
function loadEnv(): Record<string, string> {
  const envPath = resolve(process.cwd(), ".env.local");
  const contents = readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Strip the old sign-off paragraph from the HTML body.
 * Matches variations like:
 *   <p>Best regards,<br>Alex<br>Pellar</p>
 *   <p>Best,<br>Alex<br>Pellar</p>
 */
function stripSignoff(html: string): string {
  // Remove <p> tags containing sign-off patterns
  return html.replace(
    /<p[^>]*>\s*(Best regards|Best|Regards|Kind regards|Thanks|Cheers),?\s*(<br\s*\/?>)\s*Alex\s*(<br\s*\/?>)\s*Pellar\s*<\/p>/gi,
    ""
  );
}

/**
 * Strip the old sign-off from plain text body.
 */
function stripSignoffText(text: string): string {
  return text.replace(
    /\n*(Best regards|Best|Regards|Kind regards|Thanks|Cheers),?\nAlex\nPellar\s*$/i,
    ""
  ).trimEnd();
}

async function main() {
  const { data: emails, error } = await supabase
    .from("emails")
    .select("id, subject, body_html, body_text")
    .eq("direction", "outbound");

  if (error) {
    console.error("Failed to fetch emails:", error.message);
    process.exit(1);
  }

  if (!emails || emails.length === 0) {
    console.log("No outbound emails found.");
    return;
  }

  console.log(`Found ${emails.length} outbound emails to regenerate.\n`);

  for (const email of emails) {
    // 1. Strip old sign-off from the raw HTML paragraphs
    const cleanedHtml = stripSignoff(email.body_html);

    // 2. Style paragraphs and wrap in branded template
    const newHtml = wrapInBrandedTemplate({
      bodyHtml: styleParagraphs(cleanedHtml),
    });

    // 3. Strip sign-off from plain text too
    const newText = stripSignoffText(email.body_text || "");

    // 4. Update the row
    const { error: updateError } = await supabase
      .from("emails")
      .update({ body_html: newHtml, body_text: newText })
      .eq("id", email.id);

    if (updateError) {
      console.error(`  FAILED ${email.id} ("${email.subject}"): ${updateError.message}`);
    } else {
      console.log(`  Updated ${email.id} — "${email.subject}"`);
    }
  }

  console.log("\nDone.");
}

main();
