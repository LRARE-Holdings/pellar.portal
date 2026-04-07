/**
 * Feature flags for the relationship-first CRM rebuild.
 *
 * These are read at runtime from environment variables. The `newCrm` flag
 * gates the new Inbox / Companies / Contacts / Deals UI. While it's off the
 * legacy /leads, /pipeline, /outreach routes remain in place. Flip it to "1"
 * in Vercel after the Phase 6 cutover.
 */

function flag(name: string): boolean {
  const value = process.env[name];
  return value === "1" || value === "true";
}

export const flags = {
  /** Use the new relationship-first CRM UI (Inbox, Companies, Contacts, Deals). */
  newCrm: flag("NEXT_PUBLIC_NEW_CRM"),
};
