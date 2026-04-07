"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EmailDraft } from "@/types";

/**
 * Sliding right-side drawer for reviewing and approving an email draft.
 *
 * Mounts globally inside the (portal) layout. Activates when the URL has
 * a `?draft=<id>` search param. The Inbox uses this — clicking a draft
 * adds the param to the URL, which makes the drawer slide in.
 */
export function DraftDrawer() {
  const router = useRouter();
  const params = useSearchParams();
  const draftId = params.get("draft");
  const replyTo = params.get("reply");

  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Local edit buffers
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const subjectRef = useRef<HTMLInputElement>(null);

  const isOpen = !!(draftId || replyTo);

  // Load existing draft
  useEffect(() => {
    if (!draftId) {
      setDraft(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/drafts/${draftId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data: { draft: EmailDraft }) => {
        setDraft(data.draft);
        setSubject(data.draft.subject);
        setBodyText(data.draft.body_text);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [draftId]);

  // Generate a reply draft when ?reply=<email_id> is set
  useEffect(() => {
    if (!replyTo || draftId) return;
    setGenerating(true);
    setError(null);
    fetch("/api/drafts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "reply", in_reply_to_email_id: replyTo }),
    })
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j))))
      .then((data: { draft: EmailDraft }) => {
        // Re-route to the same page with ?draft=<new id> instead of ?reply
        const next = new URLSearchParams(params.toString());
        next.delete("reply");
        next.set("draft", data.draft.id);
        router.replace(`?${next.toString()}`);
      })
      .catch((e) => setError(e?.error ?? String(e)))
      .finally(() => setGenerating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyTo]);

  function close() {
    const next = new URLSearchParams(params.toString());
    next.delete("draft");
    next.delete("reply");
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname);
  }

  async function approve() {
    if (!draft) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body_text: bodyText,
          body_html: bodyText
            .split(/\n\n+/)
            .map((p) => `<p>${escapeHtml(p)}</p>`)
            .join(""),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to send");
      }
      close();
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function discard() {
    if (!draft) return;
    if (!confirm("Discard this draft?")) return;
    setSending(true);
    try {
      await fetch(`/api/drafts/${draft.id}/discard`, { method: "POST" });
      close();
      startTransition(() => router.refresh());
    } finally {
      setSending(false);
    }
  }

  // Focus subject when draft loads
  useEffect(() => {
    if (draft && subjectRef.current) {
      subjectRef.current.focus();
    }
  }, [draft]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={close} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-warm-gray px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
              {generating ? "Generating draft" : "Review & send"}
            </p>
            {draft && (
              <p className="mt-0.5 text-[12px] text-stone">
                to {draft.to_address}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {draft && (
              <Badge variant="forest">AI · {draft.generated_by}</Badge>
            )}
            <button
              onClick={close}
              className="flex h-8 w-8 items-center justify-center rounded text-stone hover:bg-cream hover:text-ink"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading || generating ? (
            <div className="space-y-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-warm-gray" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-warm-gray" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-warm-gray" />
              <div className="mt-6 h-32 animate-pulse rounded bg-warm-gray" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
              {error}
            </div>
          ) : draft ? (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Subject
                </label>
                <input
                  ref={subjectRef}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full rounded-md border border-warm-gray bg-white px-3 py-2 text-[14px] text-ink focus:border-forest focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Body
                </label>
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={16}
                  className="mt-1 w-full resize-y rounded-md border border-warm-gray bg-white px-3 py-2 font-mono text-[13px] leading-relaxed text-ink focus:border-forest focus:outline-none"
                />
                <p className="mt-1.5 text-[11px] text-stone">
                  Plain text. Pellar branding wraps automatically on send.
                  Paragraph breaks become &lt;p&gt; tags.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {draft && (
          <div className="flex items-center justify-between gap-2 border-t border-warm-gray px-6 py-4">
            <Button variant="ghost" size="sm" onClick={discard} disabled={sending}>
              Discard
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={close}>
                Close
              </Button>
              <Button onClick={approve} disabled={sending}>
                {sending ? "Sending…" : "Approve & send"}
              </Button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
