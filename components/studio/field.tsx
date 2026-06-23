import { Label } from "@/components/ui/label";

/** Labeled field wrapper with optional hint + inline error. */
export function Field({
  label,
  htmlFor,
  hint,
  errors,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {errors?.length ? <p className="text-sm text-danger">{errors[0]}</p> : null}
    </div>
  );
}
