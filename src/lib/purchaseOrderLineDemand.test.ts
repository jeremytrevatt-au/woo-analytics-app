import { describe, expect, it } from "vitest";
import {
  formatOutstandingDemandQty,
  outstandingDemandSortValue,
} from "./purchaseOrderLineDemand";

describe("purchaseOrderLineDemand", () => {
  it("sorts missing demand below known zeros", () => {
    expect(outstandingDemandSortValue(null)).toBe(Number.NEGATIVE_INFINITY);
    expect(outstandingDemandSortValue(undefined)).toBe(Number.NEGATIVE_INFINITY);
    expect(outstandingDemandSortValue(0)).toBe(0);
    expect(outstandingDemandSortValue(12)).toBe(12);
  });

  it("formats fixture demand the same way as Stock Qty", () => {
    expect(formatOutstandingDemandQty(null)).toBe("—");
    expect(formatOutstandingDemandQty(3)).toBe("3");
    expect(formatOutstandingDemandQty(12)).toBe("12");
    expect(formatOutstandingDemandQty(0)).toBe("0");
  });
});
