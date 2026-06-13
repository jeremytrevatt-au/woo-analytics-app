import { useContext } from "react";
import { FiltersContext } from "../components/FiltersProvider";

export function useFilters() {
  return useContext(FiltersContext);
}
