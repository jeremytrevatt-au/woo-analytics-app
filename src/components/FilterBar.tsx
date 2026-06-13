import { Card, CardContent, Grid, MenuItem, Stack, TextField } from "@mui/material";
import { useFilters } from "../hooks/useFilters";

function FilterBar() {
  const { filters, updateFilter } = useFilters();

  return (
    <Card>
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="Start date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filters.startDate}
              onChange={(event) => updateFilter("startDate", event.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="End date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filters.endDate}
              onChange={(event) => updateFilter("endDate", event.target.value)}
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
