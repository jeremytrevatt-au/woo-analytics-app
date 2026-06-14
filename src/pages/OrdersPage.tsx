import { useState } from "react";
import { Stack, Typography } from "@mui/material";
import DataTablePanel from "../components/DataTablePanel";
import KpiGrid from "../components/KpiGrid";
import LoadStateBlock from "../components/LoadStateBlock";
import TrendsChartPanel from "../components/TrendsChartPanel";
import { useDashboardData } from "../hooks/useDashboardData";

function OrdersPage() {
  const [page, setPage] = useState(1);
  const { kpis, trends, rows, columns, isLoading, error, totalCount, pageSize } = useDashboardData("orders", page, 50);

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        Orders
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Monitor order flow by status, units sold, and revenue concentration.
      </Typography>
      <LoadStateBlock isLoading={isLoading} error={error} empty={!isLoading && !error && rows.length === 0} />
      {!isLoading && !error ? (
        <>
          <KpiGrid cards={kpis.slice(0, 2)} />
          <TrendsChartPanel title="Orders Trend" data={trends} />
          <DataTablePanel
            title="Orders Records"
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

export default OrdersPage;
