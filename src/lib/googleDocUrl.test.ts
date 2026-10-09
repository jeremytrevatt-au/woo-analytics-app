import { describe, expect, it } from "vitest";
import { normalizeGoogleDocUrl } from "./googleDocUrl";

const INSERT_LETTER_ID = "1f27s0u8QmanvhnxbByOUsgDHs6zDz-hadTGomOd64k0";

describe("normalizeGoogleDocUrl", () => {
  it("keeps a Google Doc URL and its tab", () => {
    expect(
      normalizeGoogleDocUrl(
        `https://docs.google.com/document/d/${INSERT_LETTER_ID}/edit?tab=t.0`
      )
    ).toBe(`https://docs.google.com/document/d/${INSERT_LETTER_ID}/edit?tab=t.0`);
  });

  it("accepts a bare Doc ID", () => {
    expect(normalizeGoogleDocUrl(INSERT_LETTER_ID)).toBe(
      `https://docs.google.com/document/d/${INSERT_LETTER_ID}/edit`
    );
  });

  it("rejects text that is not a Doc", () => {
    expect(() => normalizeGoogleDocUrl("not a document")).toThrow(/Google Doc URL or Doc ID/);
  });
});
