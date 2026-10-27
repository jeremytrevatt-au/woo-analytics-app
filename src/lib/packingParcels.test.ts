import { describe, expect, it } from "vitest";
import {
  buildParcelsFromRecommendations,
  hasInvalidParcel,
  parseParcels,
  parcelsAreValid,
} from "./packingParcels";

describe("packingParcels", () => {
  it("converts recommended kilogram parcels into gram drafts and back to a packages array", () => {
    const drafts = buildParcelsFromRecommendations([
      { qty: 1, weight_kg: 3, length_cm: 20, width_cm: 10, height_cm: 5 },
      { qty: 1, weight_kg: 0.4, length_cm: 15, width_cm: 12, height_cm: 8 },
    ]);

    expect(drafts).toHaveLength(2);
    expect(drafts[0].weightGrams).toBe("3000");
    expect(parseParcels(drafts)).toEqual([
      { qty: 1, weight_kg: 3, length_cm: 20, width_cm: 10, height_cm: 5 },
      { qty: 1, weight_kg: 0.4, length_cm: 15, width_cm: 12, height_cm: 8 },
    ]);
    expect(hasInvalidParcel(parseParcels(drafts))).toBe(false);
    expect(parcelsAreValid(drafts)).toBe(true);
  });

  it("treats an extra blank parcel as invalid until measured values are entered", () => {
    const drafts = buildParcelsFromRecommendations([
      { qty: 1, weight_kg: 1, length_cm: 10, width_cm: 10, height_cm: 10 },
    ]);
    drafts.push({
      id: "blank",
      qty: "1",
      weightGrams: "",
      lengthCm: "",
      widthCm: "",
      heightCm: "",
    });

    expect(parcelsAreValid(drafts)).toBe(false);
  });
});
