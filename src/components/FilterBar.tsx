import { Card, CardContent, Grid, MenuItem, Stack, TextField, FormControlLabel, Switch, Checkbox, ListItemText, Select, InputLabel, FormControl, OutlinedInput } from "@mui/material";
import { useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useFilters } from "../hooks/useFilters";
import { getCategories } from "../api/analyticsApi";

const ORDER_STATUS_OPTIONS = [
  { value: "wc-processing", label: "Processing" },
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

function FilterBar() {
  const { filters, updateFilter } = useFilters();
  const location = useLocation();
  const path = location.pathname;
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  const showOrderStatus = path === "/orders" || path === "/backorders";
  const showStockStatus = path === "/stock" || path === "/backorders";

  const handleDateRangeChange = (range: "custom" | "today" | "this_week" | "last_week" | "mtd" | "last_month" | "qtd" | "ytd" | "last_year") => {
    updateFilter("dateRange", range);
    
    const today = new Date();
    let endDate = today.toISOString().slice(0, 10);
    let startDate = filters.startDate;

    if (range === "today") {
      startDate = today.toISOString().slice(0, 10);
    } else if (range === "this_week") {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      startDate = new Date(today.setDate(diff)).toISOString().slice(0, 10);
      endDate = new Date().toISOString().slice(0, 10); // reset to today
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
    
    if (filters.compareEnabled) {
      updateCompareDates(startDate, endDate, range);
    }
  };

  const updateCompareDates = (start: string, end: string, range: string = filters.dateRange) => {
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

  const handleCompareToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    updateFilter("compareEnabled", enabled);
    if (enabled) {
      updateCompareDates(filters.startDate, filters.endDate);
    } else {
      updateFilter("compareStartDate", null);
      updateFilter("compareEndDate", null);
    }
  };

  return (
    <Card>
      <CardContent>
        <Grid container spacing={2}>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Date Range"
                select
                value={filters.dateRange}
                onChange={(event) => handleDateRangeChange(event.target.value as any)}
              >
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="this_week">This Week</MenuItem>
                <MenuItem value="last_week">Last Week</MenuItem>
                <MenuItem value="mtd">Month to Date</MenuItem>
                <MenuItem value="last_month">Last Month</MenuItem>
                <MenuItem value="qtd">Quarter to Date</MenuItem>
                <MenuItem value="ytd">Year to Date</MenuItem>
                <MenuItem value="last_year">Last Year</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </TextField>
            </Grid>
          <Grid item xs={12} md={2}>
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
          <Grid item xs={12} md={2}>
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
          <Grid item xs={12} md={2}>
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
          <Grid item xs={12} md={2}>
            <FormControlLabel
              control={<Switch checked={filters.compareEnabled} onChange={handleCompareToggle} />}
              label="Compare to previous"
            />
          </Grid>
          {showOrderStatus && (
            <Grid item xs={12} md={2}>
              <FormControl fullWidth sx={{ minWidth: 150 }}>
                <InputLabel id="order-status-label">Order status</InputLabel>
                <Select
                  labelId="order-status-label"
                  multiple
                  value={filters.orderStatus}
                  onChange={(event) => {
                    const {
                      target: { value },
                    } = event;
                    updateFilter(
                      "orderStatus",
                      typeof value === 'string' ? value.split(',') : value
                    );
                  }}
                  input={<OutlinedInput label="Order status" />}
                  renderValue={(selected) => {
                    if (selected.length === 0) {
                      return <em>All statuses</em>;
                    }
                    return selected
                      .map((val) => ORDER_STATUS_OPTIONS.find((opt) => opt.value === val)?.label || val)
                      .join(", ");
                  }}
                >
                  {ORDER_STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Checkbox checked={filters.orderStatus.indexOf(option.value) > -1} />
                      <ListItemText primary={option.label} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          {showStockStatus && (
            <Grid item xs={12} md={2}>
              <FormControl fullWidth sx={{ minWidth: 150 }}>
                <InputLabel id="stock-status-label">Stock status</InputLabel>
                <Select
                  labelId="stock-status-label"
                  multiple
                  value={filters.stockStatus}
                  onChange={(event) => {
                    const {
                      target: { value },
                    } = event;
                    updateFilter(
                      "stockStatus",
                      typeof value === 'string' ? value.split(',') : value
                    );
                  }}
                  input={<OutlinedInput label="Stock status" />}
                  renderValue={(selected) => {
                    if (selected.length === 0) {
                      return <em>All statuses</em>;
                    }
                    return selected
                      .map((val) => STOCK_STATUS_OPTIONS.find((opt) => opt.value === val)?.label || val)
                      .join(", ");
                  }}
                >
                  {STOCK_STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Checkbox checked={filters.stockStatus.indexOf(option.value) > -1} />
                      <ListItemText primary={option.label} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          <Grid item xs={12} md={12}>
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label="Search product, customer, SKU"
                value={filters.searchText}
                onChange={(event) => updateFilter("searchText", event.target.value)}
              />
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
              <TextField
                fullWidth
                label="SKU Starts With"
                value={filters.skuStartsWith || ""}
                onChange={(event) => updateFilter("skuStartsWith", event.target.value)}
                placeholder="e.g. BSF"
              />
              <TextField
                fullWidth
                label="SKU Contains"
                value={filters.skuContains || ""}
                onChange={(event) => updateFilter("skuContains", event.target.value)}
                placeholder="e.g. TRA"
              />
              <TextField
                fullWidth
                label="SKU Ends With"
                value={filters.skuEndsWith || ""}
                onChange={(event) => updateFilter("skuEndsWith", event.target.value)}
                placeholder="e.g. 20"
              />
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

export default FilterBar;
