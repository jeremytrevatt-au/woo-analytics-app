import React, { createContext, useMemo, useState } from "react";
import { AppFilterState } from "../types/analytics";

type FiltersContextValue = {
  filters: AppFilterState;
  updateFilter: <K extends keyof AppFilterState>(key: K, value: AppFilterState[K]) => void;
};

function isoDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function isoDateToday(): string {
  return new Date().toISOString().slice(0, 10);
}

const defaultFilters: AppFilterState = {
  dateRange: "custom",
  compareEnabled: false,
  granularity: "day",
  startDate: isoDateDaysAgo(30),
  endDate: isoDateToday(),
  compareStartDate: null,
  compareEndDate: null,
  orderStatus: "all",
  searchText: ""
};

export const FiltersContext = createContext<FiltersContextValue>({
  filters: defaultFilters,
  updateFilter: () => undefined
});

type Props = {
  children: React.ReactNode;
};

function FiltersProvider({ children }: Props) {
  const [filters, setFilters] = useState<AppFilterState>(defaultFilters);

  const value = useMemo(
    () => ({
      filters,
      updateFilter: <K extends keyof AppFilterState>(key: K, filterValue: AppFilterState[K]) => {
        setFilters((previous) => ({
          ...previous,
          [key]: filterValue
        }));
      }
    }),
    [filters]
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export default FiltersProvider;
