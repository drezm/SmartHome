import { describe, expect, it } from "vitest";
import { isValidEmail, maskEmail, normalizeEmail } from "./email";

describe("email helpers", () => {
  it("normalizes and validates email addresses", () => {
    expect(normalizeEmail("  Valery@Example.COM ")).toBe("valery@example.com");
    expect(isValidEmail(" Valery@Example.COM ")).toBe(true);
    expect(isValidEmail("invalid-address")).toBe(false);
  });

  it("masks the email local part", () => {
    expect(maskEmail("valery@example.com")).toBe("va***@example.com");
  });
});
