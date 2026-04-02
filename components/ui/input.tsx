import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = "", id, ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-ink"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full rounded-lg border border-warm-gray bg-white px-3 py-2 text-sm text-ink placeholder:text-stone focus:border-forest focus:outline-none ${className}`}
        {...props}
      />
    </div>
  );
}
