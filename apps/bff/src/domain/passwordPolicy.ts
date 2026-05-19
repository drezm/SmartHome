import { z } from "zod";

export const PASSWORD_POLICY_MESSAGE = "Пароль должен содержать минимум 8 символов и любые 3 группы: строчные буквы, заглавные буквы, цифры, спецсимволы.";

export const passwordSchema = z
  .string()
  .min(8, PASSWORD_POLICY_MESSAGE)
  .max(128)
  .refine(isStrongPassword, PASSWORD_POLICY_MESSAGE);

export function isStrongPassword(value: string) {
  const groups = [/[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)];
  return groups.filter(Boolean).length >= 3;
}
