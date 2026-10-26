import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_ORDER_LOG_EVENT,
  GREENSTALK_DEFAULT_LEAD_TIME_DAYS,
  computeAutoOrderForLine,
  getSessionDaysOfCoverRequired,
  isGreenStalkSupplier,
  logAutoOrderRecommendation,
  parseDaysOfCoverRequired,
  recommendedAutoOrderQty,
  resolveDailyDemand,
  resolveLeadTimeDays,
  setSessionDaysOfCoverRequired,
} from "./purchaseOrderAutoOrder";

describe("purchaseOrderAutoOrder formula", () => {
  it("sets qty 0 and not auto-ordered when D>0 and stock covers L+C", () => {
    const result = computeAutoOrderForLine(
      {
        id: 1,
        sku: "ENOUGH",
        avg_daily_usage: 2,
        stock_qty: 80,
        backordered_qty: 0,
        preordered_qty: 0,
        effective_lead_time_days: 10,
      },
      0,
      20,
      {},
    );

    expect(result.D).toBe(2);
    expect(result.L).toBe(10);
    expect(result.C).toBe(20);
    expect(result.recommended).toBe(0);
    expect(result.isAutoOrdered).toBe(false);
  });

  it("sets recommended qty and auto-ordered when D>0 and stock is short", () => {
    const result = computeAutoOrderForLine(
      {
        id: 2,
        sku: "SHORT",
        avg_daily_usage: 2,
        stock_qty: 10,
        backordered_qty: 0,
        preordered_qty: 0,
        effective_lead_time_days: 10,
      },
      1,
      20,
      {},
    );

    expect(result.recommended).toBe(50);
    expect(result.isAutoOrdered).toBe(true);
  });

  it("covers backorders only when D=0 and backorders are 5", () => {
    const result = computeAutoOrderForLine(
      {
        id: 3,
        sku: "BACKORDER",
        avg_daily_usage: 0,
        stock_qty: 40,
        days_of_cover: 0,
        backordered_qty: 5,
        preordered_qty: 0,
      },
      2,
      20,
      { poLeadTimeDays: 14 },
    );

    expect(result.D).toBe(0);
    expect(result.recommended).toBe(5);
    expect(result.isAutoOrdered).toBe(true);
  });

  it("uses GreenStalk L=71 when lead time is missing", () => {
    const result = computeAutoOrderForLine(
      {
        id: 4,
        sku: "GS-MISSING-LEAD",
        avg_daily_usage: 1,
        stock_qty: 0,
        backordered_qty: 0,
        preordered_qty: 0,
      },
      3,
      10,
      {
        poLeadTimeDays: 0,
        supplierLeadTimeDays: 0,
        supplierName: "GreenStalk",
      },
    );

    expect(result.L).toBe(GREENSTALK_DEFAULT_LEAD_TIME_DAYS);
    expect(result.recommended).toBe(81);
    expect(result.isAutoOrdered).toBe(true);
  });

  it("does not invent 71 for other suppliers with missing lead time", () => {
    expect(resolveLeadTimeDays({
      poLeadTimeDays: 0,
      supplierLeadTimeDays: 0,
      supplierName: "Other Supplier",
    })).toBe(0);
  });

  it("uses supplier stored lead time before GreenStalk fallback", () => {
    expect(resolveLeadTimeDays({
      supplierLeadTimeDays: 21,
      supplierName: "GreenStalk",
    })).toBe(21);
  });

  it("prefers forecast avg_daily_usage over derived stock/days", () => {
    expect(resolveDailyDemand({
      avg_daily_usage: 1.5,
      stock_qty: 48,
      days_of_cover: 24,
    })).toBe(1.5);
  });

  it("derives D from stock_qty / days_of_cover when forecast is missing", () => {
    expect(resolveDailyDemand({
      stock_qty: 48,
      days_of_cover: 24,
    })).toBe(2);
  });

  it("does not invent demand when days_of_cover and forecast are missing", () => {
    expect(resolveDailyDemand({
      stock_qty: 10,
      days_of_cover: null,
    })).toBe(0);
  });

  it("uses forecast when days_of_cover is 0 and stock is 0", () => {
    expect(resolveDailyDemand({
      avg_daily_usage: 1.25,
      stock_qty: 0,
      days_of_cover: 0,
    })).toBe(1.25);
  });

  it("adds outstanding orders into the D>0 formula", () => {
    expect(recommendedAutoOrderQty({
      dailyDemand: 1,
      leadTimeDays: 10,
      daysOfCoverRequired: 10,
      stockQty: 5,
      backorderedQty: 2,
      preorderedQty: 3,
    })).toBe(20);
  });

  it("identifies GreenStalk by name", () => {
    expect(isGreenStalkSupplier("GreenStalk")).toBe(true);
    expect(isGreenStalkSupplier("greenstalk australia")).toBe(true);
    expect(isGreenStalkSupplier("Other")).toBe(false);
  });

  it("requires a positive integer for days of cover", () => {
    expect(parseDaysOfCoverRequired("")).toBeNull();
    expect(parseDaysOfCoverRequired("0")).toBeNull();
    expect(parseDaysOfCoverRequired("1.5")).toBeNull();
    expect(parseDaysOfCoverRequired("-3")).toBeNull();
    expect(parseDaysOfCoverRequired("30")).toBe(30);
  });
});

describe("purchaseOrderAutoOrder session and log", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("remembers the last days of cover for the session", () => {
    expect(getSessionDaysOfCoverRequired()).toBeNull();
    setSessionDaysOfCoverRequired(45);
    expect(getSessionDaysOfCoverRequired()).toBe(45);
  });

  it("logs sku and formula terms without extra fields", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logAutoOrderRecommendation({
      index: 0,
      key: "id:1",
      sku: "SHORT",
      D: 2,
      L: 10,
      C: 20,
      S: 10,
      B: 0,
      P: 0,
      recommended: 50,
      isAutoOrdered: true,
    });

    expect(info).toHaveBeenCalledWith(AUTO_ORDER_LOG_EVENT, {
      sku: "SHORT",
      D: 2,
      L: 10,
      C: 20,
      S: 10,
      B: 0,
      P: 0,
      recommended: 50,
    });
  });
});
