export type StockAnalysisDateRange = {
  startDate: string;
  endDate: string;
};

export function resolveStockAnalysisDateRange(
  lookbackDays: number,
  explicitStartDate?: string | null,
  explicitEndDate?: string | null,
  today = new Date(),
): StockAnalysisDateRange {
  const endDate = explicitEndDate || today.toISOString().slice(0, 10);
  if (explicitStartDate) {
    return { startDate: explicitStartDate, endDate };
  }

  const start = new Date(`${endDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - lookbackDays);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate,
  };
}
