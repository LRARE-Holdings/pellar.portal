"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface InlineEditContactProps {
  contactId: string;
  initialValues: {
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
  };
}

const fields: { key: keyof InlineEditContactProps["initialValues"]; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "title", label: "Job title" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "linkedin_url", label: "LinkedIn URL" },
];

export function InlineEditContact({
  contactId,
  initialValues,
}: InlineEditContactProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);

  function handleChange(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setValues(initialValues);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded-md border border-warm-gray px-3 py-1.5 text-[12px] font-medium text-stone transition-colors hover:border-forest hover:text-forest"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {fields.map(({ key, label }) => (
        <div key={key}>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
            {label}
          </label>
          <input
            type="text"
            value={values[key] ?? ""}
            onChange={(e) => handleChange(key, e.target.value)}
            className="mt-1 w-full rounded-md border border-warm-gray bg-white px-3 py-1.5 text-[13px] text-ink focus:border-forest focus:outline-none"
          />
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-forest px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-forest/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="rounded-md border border-warm-gray px-3 py-1.5 text-[12px] font-medium text-stone transition-colors hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
