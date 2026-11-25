import { describe, expect, test } from "vitest";

import { normalizeEmail, parseOwnerEmail } from "./email";

describe("Email addresses", () => {
  test("Войти с разным написанием адреса", () => {
    expect(normalizeEmail("  ANNA@EXAMPLE.COM ")).toBe("anna@example.com");
  });

  test("Отправить неверный адрес в обход формы", () => {
    expect(normalizeEmail("anna@example")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  test("The owner email uses the same normalization as sign-in", () => {
    expect(parseOwnerEmail("  OWNER@EXAMPLE.COM ")).toBe("owner@example.com");
    expect(parseOwnerEmail(undefined)).toBeNull();
    expect(() => parseOwnerEmail("invalid")).toThrow("CRM_OWNER_EMAIL");
  });
});
