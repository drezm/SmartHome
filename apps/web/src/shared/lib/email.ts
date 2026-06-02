export const EMAIL_ERROR_MESSAGE = "Введите корректный email";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function maskEmail(value: string) {
  const [local, domain] = normalizeEmail(value).split("@");
  if (!local || !domain) {
    return value;
  }

  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}
