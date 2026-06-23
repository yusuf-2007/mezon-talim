import { Alert, AlertDescription } from "@/components/ui/alert";

/** Inline field-level validation error. */
export function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-sm text-danger">{errors[0]}</p>;
}

/** Form-level error banner. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** Form-level success banner. */
export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
