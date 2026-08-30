import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useFilters } from "../hooks/useFilters";
import { getCategories } from "../api/analyticsApi";
import type { AppFilterState } from "../types/analytics";

const ORDER_STATUS_OPTIONS = [
  { value: "wc-processing", label: "Processing" },
  { value: "wc-pre-ordered", label: "Pre Ordered" },
  { value: "wc-completed", label: "Completed" },
  { value: "wc-on-hold", label: "On Hold" },
  { value: "wc-pending", label: "Pending Payment" },
  { value: "wc-cancelled", label: "Cancelled" },
  { value: "wc-refunded", label: "Refunded" },
  { value: "wc-failed", label: "Failed" },
];

const STOCK_STATUS_OPTIONS = [
  { value: "instock", label: "In Stock" },
  { value: "outofstock", label: "Out of Stock" },
  { value: "onbackorder", label: "On Backorder" },
];

const OPEN_ORDER_STATUS_VALUES = ["wc-processing", "wc-pre-ordered", "wc-on-hold", "wc-pending"];

type DateRangeValue = AppFilterState["dateRange"];

type FilterBarContext = {
  hidden?: boolean;
  title: string;
  showDateRange?: boolean;
  showGranularity?: boolean;
  showCompare?: boolean;
  showOrderStatus?: boolean;
  showStockStatus?: boolean;
  showSearch?: boolean;
  showCategory?: boolean;
  showSkuFilters?: boolean;
  searchLabel?: string;
};

function getStockTab(search: string): "items" | "shortages" | "stocktake" {
  const tab = new URLSearchParams(search).get("tab");
  if (tab === "shortages" || tab === "stocktake") return tab;
  return "items";
}

function getFilterBarContext(path: string, stockTab: "items" | "shortages" | "stocktake"): FilterBarContext {
  if (path === "/purchase-orders" || path === "/returns" || path === "/document-templates" || path === "/suppliers" || path === "/admin" || path === "/preorders" || path === "/drill-down") {
    return { title: "Filters", hidden: true };
  }

  if (path === "/") {
    return {
      title: "Dashboard Filters",
      showDateRange: true,
      showGranularity: true,
      showCompare: true,
    };
  }

  if (path === "/orders") {
    return {
      title: "Order Filters",
      showDateRange: true,
      showGranularity: true,
      showCompare: true,
      showOrderStatus: true,
      showSearch: true,
      showCategory: true,
      showSkuFilters: true,
      searchLabel: "Search order, customer, SKU",
    };
  }

  if (path === "/customers") {
    return {
      title: "Customer Filters",
      showDateRange: true,
      showGranularity: true,
      showCompare: true,
      showSearch: true,
      searchLabel: "Search customer",
    };
  }

  if (path === "/revenue") {
    return {
      title: "Revenue Filters",
      showDateRange: true,
      showGranularity: true,
      showOrderStatus: true,
      showSearch: true,
      showCategory: true,
      showSkuFilters: true,
      searchLabel: "Search order, product, SKU",
    };
  }

  if (path === "/backorders") {
    return {
      title: "Backorder Filters",
      showDateRange: true,
      showGranularity: true,
      showCompare: true,
      showOrderStatus: true,
      showStockStatus: true,
      showSearch: true,
      searchLabel: "Search order, product, SKU",
    };
  }

  if (path === "/packing") {
    return {
      title: "Packing Filters",
      showOrderStatus: true,
      showSearch: true,
      searchLabel: "Search order, customer, SKU",
    };
  }

  if (path === "/stock" && stockTab === "stocktake") {
    return {
      title: "Stocktake Filters",
      showStockStatus: true,
      showSearch: true,
      showCategory: true,
      showSkuFilters: true,
      searchLabel: "Search product or SKU",
    };
  }

  if (path === "/stock" && stockTab === "shortages") {
    return {
      title: "Stock Shortage Filters",
      showDateRange: true,
      showOrderStatus: true,
      showStockStatus: true,
      showSearch: true,
      showCategory: true,
      showSkuFilters: true,
      searchLabel: "Search order, product, SKU",
    };
  }

  if (path === "/stock") {
    return {
      title: "Stock Item Filters",
      showDateRange: true,
      showGranularity: true,
      showCompare: true,
      showStockStatus: true,
      showSearch: true,
      showCategory: true,
      showSkuFilters: true,
      searchLabel: "Search product or SKU",
    };
  }

  return { title: "Filters", hidden: true };
}

function FilterBar() {
  const { filters, updateFilter } = useFilters();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const stockTab = getStockTab(location.search);
  const filterContext = useMemo(
    () => getFilterBarContext(location.pathname, stockTab),
    [location.pathname, stockTab]
  );
  const isStockShortagesTab = location.pathname === "/stock" && stockTab === "shortages";
  const orderStatusOptions = isStockShortagesTab
    ? ORDER_STATUS_OPTIONS.filter((option) => OPEN_ORDER_STATUS_VALUES.includes(option.value))
    : ORDER_STATUS_OPTIONS;
  const stockStatusOptions = isStockShortagesTab
    ? STOCK_STATUS_OPTIONS.filter((option) => option.value !== "instock")
    : STOCK_STATUS_OPTIONS;
  const [categories, setCategories] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    setExpanded(!isMobile);
  }, [isMobile, location.pathname, stockTab]);

  useEffect(() => {
    if (!isStockShortagesTab) return;

    const shortageStatuses = filters.stockStatus.filter((status) => status === "outofstock" || status === "onbackorder");
    const nextStatuses = shortageStatuses.length > 0 ? shortageStatuses : ["outofstock", "onbackorder"];
    if (nextStatuses.length !== filters.stockStatus.length || nextStatuses.some((status, index) => status !== filters.stockStatus[index])) {
      updateFilter("stockStatus", nextStatuses);
    }

    const nextOrderStatuses = filters.orderStatus.filter((status) => OPEN_ORDER_STATUS_VALUES.includes(status));
    if (nextOrderStatuses.length !== filters.orderStatus.length) {
      updateFilter("orderStatus", nextOrderStatuses);
    }
  }, [filters.orderStatus, filters.stockStatus, isStockShortagesTab, updateFilter]);

  if (filterContext.hidden) {
    return null;
  }

  const handleDateRangeChange = (range: DateRangeValue) => {
    updateFilter("dateRange", range);

    const today = new Date();
    let endDate = today.toISOString().slice(0, 10);
    let startDate = filters.startDate;

    if (range === "all_time") {
      startDate = "";
      endDate = "";
    } else if (range === "today") {
      startDate = today.toISOString().slice(0, 10);
    } else if (range === "this_week") {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(today.setDate(diff)).toISOString().slice(0, 10);
      endDate = new Date().toISOString().slice(0, 10);
    } else if (range === "last_3_months") {
      const start = new Date();
      start.setMonth(start.getMonth() - 3);
      startDate = start.toISOString().slice(0, 10);
    } else if (range === "last_6_months") {
      const start = new Date();
      start.setMonth(start.getMonth() - 6);
      startDate = start.toISOString().slice(0, 10);
    } else if (range === "last_12_months") {
      const start = new Date();
      start.setMonth(start.getMonth() - 12);
      startDate = start.toISOString().slice(0, 10);
    } else if (range === "last_week") {
      const lastWeekEnd = new Date(today);
      lastWeekEnd.setDate(today.getDate() - today.getDay());
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
      startDate = lastWeekStart.toISOString().slice(0, 10);
      endDate = lastWeekEnd.toISOString().slice(0, 10);
    } else if (range === "mtd") {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    } else if (range === "last_month") {
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10);
      endDate = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);
    } else if (range === "qtd") {
      const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
      startDate = new Date(today.getFullYear(), quarterStartMonth, 1).toISOString().slice(0, 10);
    } else if (range === "ytd") {
      startDate = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
    } else if (range === "last_year") {
      startDate = new Date(today.getFullYear() - 1, 0, 1).toISOString().slice(0, 10);
      endDate = new Date(today.getFullYear() - 1, 11, 31).toISOString().slice(0, 10);
    }

    updateFilter("startDate", startDate);
    updateFilter("endDate", endDate);

    if (filters.compareEnabled && startDate && endDate) {
      updateCompareDates(startDate, endDate, range);
    }
  };

  const updateCompareDates = (start: string, end: string, range: string = filters.dateRange) => {
    if (!start || !end) return;
    const sDate = new Date(start);
    const eDate = new Date(end);

    let cStartDate = new Date(sDate);
    let cEndDate = new Date(eDate);

    if (range === "today") {
      cStartDate.setDate(cStartDate.getDate() - 1);
      cEndDate.setDate(cEndDate.getDate() - 1);
    } else if (range === "this_week" || range === "last_week") {
      cStartDate.setDate(cStartDate.getDate() - 7);
      cEndDate.setDate(cEndDate.getDate() - 7);
    } else if (range === "mtd" || range === "last_month") {
      cStartDate.setMonth(cStartDate.getMonth() - 1);
      cEndDate.setMonth(cEndDate.getMonth() - 1);
    } else if (range === "qtd") {
      cStartDate.setMonth(cStartDate.getMonth() - 3);
      cEndDate.setMonth(cEndDate.getMonth() - 3);
    } else if (range === "ytd" || range === "last_year") {
      cStartDate.setFullYear(cStartDate.getFullYear() - 1);
      cEndDate.setFullYear(cEndDate.getFullYear() - 1);
    } else {
      const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      cEndDate = new Date(sDate);
      cEndDate.setDate(cEndDate.getDate() - 1);

      cStartDate = new Date(cEndDate);
      cStartDate.setDate(cStartDate.getDate() - diffDays);
    }

    updateFilter("compareStartDate", cStartDate.toISOString().slice(0, 10));
    updateFilter("compareEndDate", cEndDate.toISOString().slice(0, 10));
  };

  const handleCompareToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    updateFilter("compareEnabled", enabled);
    if (enabled) {
      updateCompareDates(filters.startDate, filters.endDate);
    } else {
      updateFilter("compareStartDate", null);
      updateFilter("compareEndDate", null);
    }
  };

  const activeFilterCount = [
    filterContext.showSearch && Boolean(filters.searchText),
    filterContext.showCategory && Boolean(filters.category),
    filterContext.showSkuFilters && Boolean(filters.skuStartsWith),
    filterContext.showSkuFilters && Boolean(filters.skuContains),
    filterContext.showSkuFilters && Boolean(filters.skuEndsWith),
    filterContext.showOrderStatus && filters.orderStatus.length > 0,
    filterContext.showStockStatus && filters.stockStatus.length > 0,
    filterContext.showCompare && filters.compareEnabled,
  ].filter(Boolean).length;

  return (
    <Accordion
      expanded={expanded}
      onChange={(_event, nextExpanded) => setExpanded(nextExpanded)}
      disableGutters
      sx={{ "&::before": { display: "none" } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="filter-panel-content" id="filter-panel-header">
        <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
          {filterContext.title}
        </Typography>
        {activeFilterCount > 0 ? <Chip size="small" label={`${activeFilterCount} active`} /> : null}
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={2} alignItems="center">
          {filterContext.showDateRange && (
            <>
              <Grid item xs={12} sm={6} md={3} lg={2}>
                <TextField
                  fullWidth
                  label="Date Range"
                  select
                  value={filters.dateRange}
                  onChange={(event) => handleDateRangeChange(event.target.value as DateRangeValue)}
                >
                  <MenuItem value="today">Today</MenuItem>
                  <MenuItem value="this_week">This Week</MenuItem>
                  <MenuItem value="last_week">Last Week</MenuItem>
                  <MenuItem value="last_3_months">Last 3 Months</MenuItem>
                  <MenuItem value="last_6_months">Last 6 Months</MenuItem>
                  <MenuItem value="last_12_months">Last 12 Months</MenuItem>
                  <MenuItem value="mtd">Month to Date</MenuItem>
                  <MenuItem value="last_month">Last Month</MenuItem>
                  <MenuItem value="qtd">Quarter to Date</MenuItem>
                  <MenuItem value="ytd">Year to Date</MenuItem>
                  <MenuItem value="last_year">Last Year</MenuItem>
                  <MenuItem value="all_time">All Time</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={3} lg={2}>
                <TextField
                  fullWidth
                  label="Start date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={filters.startDate}
                  onChange={(event) => {
                    updateFilter("startDate", event.target.value);
                    updateFilter("dateRange", "custom");
                    if (filters.compareEnabled) updateCompareDates(event.target.value, filters.endDate);
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3} lg={2}>
                <TextField
                  fullWidth
                  label="End date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={filters.endDate}
                  onChange={(event) => {
                    updateFilter("endDate", event.target.value);
                    updateFilter("dateRange", "custom");
                    if (filters.compareEnabled) updateCompareDates(filters.startDate, event.target.value);
                  }}
                />
              </Grid>
            </>
          )}
          {filterContext.showGranularity && (
            <Grid item xs={12} sm={6} md={3} lg={2}>
              <TextField
                fullWidth
                label="Granularity"
                select
                value={filters.granularity}
                onChange={(event) =>
                  updateFilter("granularity", event.target.value as "day" | "week" | "month" | "quarter" | "year")
                }
              >
                <MenuItem value="day">Daily</MenuItem>
                <MenuItem value="week">Weekly</MenuItem>
                <MenuItem value="month">Monthly</MenuItem>
                <MenuItem value="quarter">Quarterly</MenuItem>
                <MenuItem value="year">Yearly</MenuItem>
              </TextField>
            </Grid>
          )}
          {filterContext.showCompare && (
            <Grid item xs={12} sm={6} md={3} lg={2}>
              <FormControlLabel
                control={<Switch checked={filters.compareEnabled} onChange={handleCompareToggle} />}
                label="Compare to previous"
              />
            </Grid>
          )}
          {filterContext.showOrderStatus && (
            <Grid item xs={12} sm={6} md={3} lg={2}>
              <FormControl fullWidth>
                <InputLabel id="order-status-label">Order status</InputLabel>
                <Select
                  labelId="order-status-label"
                  multiple
                  value={filters.orderStatus}
                  onChange={(event) => {
                    const {
                      target: { value },
                    } = event;
                    updateFilter("orderStatus", typeof value === "string" ? value.split(",") : value);
                  }}
                  input={<OutlinedInput label="Order status" />}
                  renderValue={(selected) => {
                    if (selected.length === 0) {
                      return <em>All statuses</em>;
                    }
                    return selected
                      .map((val) => orderStatusOptions.find((opt) => opt.value === val)?.label || val)
                      .join(", ");
                  }}
                >
                  {orderStatusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Checkbox checked={filters.orderStatus.indexOf(option.value) > -1} />
                      <ListItemText primary={option.label} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          {filterContext.showStockStatus && (
            <Grid item xs={12} sm={6} md={3} lg={2}>
              <FormControl fullWidth>
                <InputLabel id="stock-status-label">Stock status</InputLabel>
                <Select
                  labelId="stock-status-label"
                  multiple
                  value={filters.stockStatus}
                  onChange={(event) => {
                    const {
                      target: { value },
                    } = event;
                    updateFilter("stockStatus", typeof value === "string" ? value.split(",") : value);
                  }}
                  input={<OutlinedInput label="Stock status" />}
                  renderValue={(selected) => {
                    if (selected.length === 0) {
                      return <em>All statuses</em>;
                    }
                    return selected
                      .map((val) => stockStatusOptions.find((opt) => opt.value === val)?.label || val)
                      .join(", ");
                  }}
                >
                  {stockStatusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Checkbox checked={filters.stockStatus.indexOf(option.value) > -1} />
                      <ListItemText primary={option.label} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          {filterContext.showSearch && (
            <Grid item xs={12} sm={6} md={3} lg={3}>
              <TextField
                fullWidth
                label={filterContext.searchLabel || "Search"}
                value={filters.searchText}
                onChange={(event) => updateFilter("searchText", event.target.value)}
              />
            </Grid>
          )}
          {filterContext.showCategory && (
            <Grid item xs={12} sm={6} md={3} lg={2}>
              <TextField
                fullWidth
                select
                label="Category"
                value={filters.category}
                onChange={(event) => updateFilter("category", event.target.value)}
              >
                <MenuItem value=""><em>All Categories</em></MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
          {filterContext.showSkuFilters && (
            <>
              <Grid item xs={12} sm={6} md={3} lg={2}>
                <TextField
                  fullWidth
                  label="SKU Starts With"
                  value={filters.skuStartsWith || ""}
                  onChange={(event) => updateFilter("skuStartsWith", event.target.value)}
                  placeholder="e.g. BSF"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3} lg={2}>
                <TextField
                  fullWidth
                  label="SKU Contains"
                  value={filters.skuContains || ""}
                  onChange={(event) => updateFilter("skuContains", event.target.value)}
                  placeholder="e.g. TRA"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3} lg={2}>
                <TextField
                  fullWidth
                  label="SKU Ends With"
                  value={filters.skuEndsWith || ""}
                  onChange={(event) => updateFilter("skuEndsWith", event.target.value)}
                  placeholder="e.g. 20"
                />
              </Grid>
            </>
          )}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
}

export default FilterBar;
