import React, { createContext, useMemo, useState } from "react";
import { AppFilterState } from "../types/analytics";

type FiltersContextValue = {
  filters: AppFilterState;
  updateFilter: <K extends keyof AppFilterState>(key: K, value: AppFilterState[K]) => void;
};

const defaultFilters: AppFilterState = {
  dateRange: "30d",
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
