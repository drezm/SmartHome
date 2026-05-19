export const PASSWORD_POLICY_MESSAGE = "Минимум 8 символов и любые 3 группы: строчные, заглавные, цифры, спецсимволы.";

export const PASSWORD_REQUIREMENTS = [
  { label: "8 или больше символов", test: (value: string) => value.length >= 8 },
  { label: "строчные буквы", test: (value: string) => /[a-z]/.test(value) },
  { label: "заглавные буквы", test: (value: string) => /[A-Z]/.test(value) },
  { label: "цифры", test: (value: string) => /\d/.test(value) },
  { label: "спецсимволы", test: (value: string) => /[^A-Za-z0-9]/.test(value) }
];

export function isStrongPassword(value: string) {
  const fulfilledGroups = PASSWORD_REQUIREMENTS.slice(1).filter((requirement) => requirement.test(value)).length;
  return PASSWORD_REQUIREMENTS[0].test(value) && fulfilledGroups >= 3;
}
