import { describe, expect, it } from "vitest";
import { dirFor, isNastaliq, type Locale } from "./i18n";

describe("locale direction", () => {
  // @req I18N-01
  it("puts Urdu right to left", () => {
    expect(dirFor("ur")).toBe("rtl");
  });

  // @req I18N-01
  it("keeps English left to right", () => {
    expect(dirFor("en")).toBe("ltr");
  });

  // @req I18N-01
  it("keeps Roman Urdu left to right, because it is Latin script", () => {
    expect(dirFor("ur-Latn")).toBe("ltr");
  });
});

describe("Nastaliq selection", () => {
  // @req I18N-02
  it("selects Nastaliq for Urdu", () => {
    expect(isNastaliq("ur")).toBe(true);
  });

  // @req I18N-02
  it("does not select Nastaliq for Roman Urdu", () => {
    expect(isNastaliq("ur-Latn")).toBe(false);
  });

  // @req I18N-02
  it("does not select Nastaliq for English", () => {
    expect(isNastaliq("en")).toBe(false);
  });
});

describe("locale coverage", () => {
  // @req I18N-01
  it("handles every supported locale", () => {
    const all: Locale[] = ["en", "ur", "ur-Latn"];
    for (const locale of all) {
      expect(["ltr", "rtl"]).toContain(dirFor(locale));
    }
  });
});
