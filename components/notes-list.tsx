import { dateTime } from "@/lib/format";
import type { Note } from "@/types";

export function NotesList({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return (
      <div className="rounded-lg border border-warm-gray bg-white p-5 text-[12px] text-stone">
        No notes yet. Press cmd+K to add one.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <article
          key={note.id}
          className={`rounded-lg border bg-white p-4 ${
            note.pinned
              ? "border-forest/30 bg-light-sage"
              : "border-warm-gray"
          }`}
        >
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
            {note.body}
          </p>
          <p className="mt-2 text-[11px] text-stone">
            {dateTime(note.created_at)}
            {note.pinned ? " · pinned" : ""}
          </p>
        </article>
      ))}
    </div>
  );
}
