import { describe, expect, it } from "vitest";

import { resolveTheme } from "@/lib/theme";

describe("theme preference", () => {
  it("follows the device when set to system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("honors an explicit preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
