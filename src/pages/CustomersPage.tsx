import { useState } from "react";
import { Stack, Typography } from "@mui/material";
import DataTablePanel from "../components/DataTablePanel";
import KpiGrid from "../components/KpiGrid";
import LoadStateBlock from "../components/LoadStateBlock";
import TrendsChartPanel from "../components/TrendsChartPanel";
import { useDashboardData } from "../hooks/useDashboardData";

function CustomersPage() {
  const [page, setPage] = useState(1);
  const { kpis, trends, rows, columns, isLoading, error, totalCount, pageSize } = useDashboardData("customers", page, 50);
  const customerKpi = kpis.find((item) => item.id === "customers");

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        Customers
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Review customer activity, repeat purchase behavior, and order value.
      </Typography>
      <LoadStateBlock isLoading={isLoading} error={error} empty={!isLoading && !error && rows.length === 0} />
      {!isLoading && !error ? (
        <>
          <KpiGrid cards={customerKpi ? [customerKpi] : []} />
          <TrendsChartPanel title="Customer Trend" data={trends} domain="customers" />
          <DataTablePanel
            title="Customer Records"
            rows={rows as any}
            columns={columns}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </Stack>
  );
}

export default CustomersPage;
