import { z } from "zod";

export const EMAIL_ERROR_MESSAGE = "Введите корректный email";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export const emailSchema = z.string().transform(normalizeEmail).pipe(z.string().email(EMAIL_ERROR_MESSAGE));
