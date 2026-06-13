import { Card, CardContent, Grid, MenuItem, Stack, TextField } from "@mui/material";
import { useFilters } from "../hooks/useFilters";

function FilterBar() {
  const { filters, updateFilter } = useFilters();

  return (
    <Card>
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Date range"
              select
              value={filters.dateRange}
              onChange={(event) => updateFilter("dateRange", event.target.value as "7d" | "30d" | "90d")}
            >
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 90 days</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Order status"
              select
              value={filters.orderStatus}
              onChange={(event) =>
                updateFilter(
                  "orderStatus",
                  event.target.value as
                    | "all"
                    | "processing"
                    | "completed"
                    | "on-hold"
                    | "active"
                    | "inactive"
                    | "instock"
                    | "outofstock"
                )
              }
            >
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="processing">Processing</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="on-hold">On hold</MenuItem>
              <MenuItem value="active">Active customers</MenuItem>
              <MenuItem value="inactive">Inactive customers</MenuItem>
              <MenuItem value="instock">In stock</MenuItem>
              <MenuItem value="outofstock">Out of stock</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                label="Search product, customer, SKU"
                value={filters.searchText}
                onChange={(event) => updateFilter("searchText", event.target.value)}
              />
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

export default FilterBar;
