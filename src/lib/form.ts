import { z } from "zod";

export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function formOptionalString(formData: FormData, key: string) {
  const value = formString(formData, key);
  return value.length > 0 ? value : null;
}

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const message = result.error.issues
    .map((issue) => issue.message)
    .filter(Boolean)
    .join(" · ");

  throw new Error(message || "Form doğrulaması başarısız.");
}
