import { Card, CardContent, Grid, MenuItem, Stack, TextField, FormControlLabel, Switch, Checkbox, ListItemText, Select, InputLabel, FormControl, OutlinedInput } from "@mui/material";
import { useFilters } from "../hooks/useFilters";

const ORDER_STATUS_OPTIONS = [
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "on-hold", label: "On Hold" },
  { value: "pending", label: "Pending Payment" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
  { value: "failed", label: "Failed" },
];

const STOCK_STATUS_OPTIONS = [
  { value: "instock", label: "In Stock" },
  { value: "outofstock", label: "Out of Stock" },
  { value: "onbackorder", label: "On Backorder" },
];

function FilterBar() {
  const { filters, updateFilter } = useFilters();

  const handleDateRangeChange = (range: "custom" | "mtd" | "qtd" | "ytd") => {
    updateFilter("dateRange", range);
    
    const today = new Date();
    const endDate = today.toISOString().slice(0, 10);
    let startDate = filters.startDate;

    if (range === "mtd") {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    } else if (range === "qtd") {
      const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
      startDate = new Date(today.getFullYear(), quarterStartMonth, 1).toISOString().slice(0, 10);
    } else if (range === "ytd") {
      startDate = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
    }

    updateFilter("startDate", startDate);
    updateFilter("endDate", endDate);
    
    if (filters.compareEnabled) {
      updateCompareDates(startDate, endDate);
    }
  };

  const updateCompareDates = (start: string, end: string) => {
    const sDate = new Date(start);
    const eDate = new Date(end);
    const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const cEndDate = new Date(sDate);
    cEndDate.setDate(cEndDate.getDate() - 1);
    
    const cStartDate = new Date(cEndDate);
    cStartDate.setDate(cStartDate.getDate() - diffDays);
    
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
              <MenuItem value="custom">Custom</MenuItem>
              <MenuItem value="mtd">Month to Date</MenuItem>
              <MenuItem value="qtd">Quarter to Date</MenuItem>
              <MenuItem value="ytd">Year to Date</MenuItem>
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
          <Grid item xs={12} md={2}>
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
          <Grid item xs={12} md={2}>
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
                label="Category"
                value={filters.category}
                onChange={(event) => updateFilter("category", event.target.value)}
                placeholder="e.g. Trays"
              />
              <TextField
                select
                label="SKU Filter Type"
                value={filters.skuPatternType}
                onChange={(event) => updateFilter("skuPatternType", event.target.value as any)}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="starts_with">Starts With</MenuItem>
                <MenuItem value="ends_with">Ends With</MenuItem>
                <MenuItem value="contains">Contains</MenuItem>
              </TextField>
              <TextField
                fullWidth
                label="SKU Pattern"
                value={filters.skuPattern}
                onChange={(event) => updateFilter("skuPattern", event.target.value)}
                placeholder="e.g. BSF-TRA"
              />
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

export default FilterBar;
