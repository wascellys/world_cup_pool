import type { PropsWithChildren } from "react";

export function Field({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-extrabold">{label}</span>
      {children}
    </label>
  );
}

