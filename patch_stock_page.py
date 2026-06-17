with open('src/pages/StockPage.tsx', 'r') as f:
    content = f.read()

import_str = """import { useFilters } from "../hooks/useFilters";
import { fetchStockList, fetchStockShortages, fetchStockForecast, fetchStockLedger } from "../api/analyticsApi";"""
content = content.replace('import { fetchStockList, fetchStockShortages, fetchStockForecast } from "../api/analyticsApi";', import_str)

ledger_state = """  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const [ledgerData, setLedgerData] = useState<any>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerReason, setLedgerReason] = useState<string>("all");"""
content = content.replace("""  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);""", ledger_state)

load_ledger = """  const loadForecast = async () => {
    setForecastLoading(true);
    setForecastError(null);
    try {
      const data = await fetchStockForecast(filters, 1, 100, leadTimeDays, method, lookbackDays);
      setForecastData(data);
    } catch (err: any) {
      setForecastError(err.message);
    } finally {
      setForecastLoading(false);
    }
  };

  const loadLedger = async () => {
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      const data = await fetchStockLedger(filters, ledgerPage, 50, ledgerReason === "all" ? null : ledgerReason);
      setLedgerData(data);
    } catch (err: any) {
      setLedgerError(err.message);
    } finally {
      setLedgerLoading(false);
    }
  };"""
content = content.replace("""  const loadForecast = async () => {
    setForecastLoading(true);
    setForecastError(null);
    try {
      const data = await fetchStockForecast(filters, 1, 100, leadTimeDays, method, lookbackDays);
      setForecastData(data);
    } catch (err: any) {
      setForecastError(err.message);
    } finally {
      setForecastLoading(false);
    }
  };""", load_ledger)

effect_str = """  useEffect(() => {
    loadShortages();
    loadForecast();
    loadLedger();
  }, [filters, leadTimeDays, method, lookbackDays, ledgerPage, ledgerReason]);"""
content = content.replace("""  useEffect(() => {
    loadShortages();
    loadForecast();
  }, [filters, leadTimeDays, method, lookbackDays]);""", effect_str)

ledger_ui = """      <LoadStateBlock
        loading={forecastLoading}
        error={forecastError}
        onRetry={loadForecast}
      >
        {forecastData && (
          <DataTablePanel
            title="Stock Reorder Forecast"
            columns={forecastColumns}
            data={forecastData.items}
            total={forecastData.total}
            page={1}
            pageSize={100}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
            expandable
            renderExpandedRow={renderExpandedRow}
          />
        )}
      </LoadStateBlock>

      <Box sx={{ mt: 4, mb: 2, display: "flex", gap: 2, alignItems: "center" }}>
        <Typography variant="h6">Stock Movement Ledger</Typography>
        <TextField
          select
          label="Reason"
          value={ledgerReason}
          onChange={(e) => {
            setLedgerReason(e.target.value);
            setLedgerPage(1);
          }}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="all">All Movements</MenuItem>
          <MenuItem value="manual_edit">Manual Edit</MenuItem>
          <MenuItem value="order_placed">Order Placed</MenuItem>
          <MenuItem value="order_restocked">Order Restocked</MenuItem>
          <MenuItem value="order_refunded">Order Refunded</MenuItem>
        </TextField>
      </Box>

      <LoadStateBlock
        loading={ledgerLoading}
        error={ledgerError}
        onRetry={loadLedger}
      >
        {ledgerData && (
          <DataTablePanel
            title="Stock Movement History"
            columns={[
              { field: "timestamp", headerName: "Date/Time" },
              { field: "sku", headerName: "SKU" },
              { field: "product_name", headerName: "Product Name" },
              { field: "reason", headerName: "Reason" },
              { field: "change_amount", headerName: "Change" },
              { field: "new_stock_level", headerName: "New Level" },
              { field: "reference_id", headerName: "Ref ID (Order)" },
            ]}
            data={ledgerData.items.map((i: any) => ({
              ...i,
              timestamp: new Date(i.timestamp).toLocaleString("en-AU"),
              change_amount: i.change_amount > 0 ? + : i.change_amount,
              reference_id: i.reference_id > 0 ? i.reference_id : "-",
            }))}
            total={ledgerData.total}
            page={ledgerPage}
            pageSize={50}
            onPageChange={setLedgerPage}
            onPageSizeChange={() => {}}
          />
        )}
      </LoadStateBlock>"""
content = content.replace("""      <LoadStateBlock
        loading={forecastLoading}
        error={forecastError}
        onRetry={loadForecast}
      >
        {forecastData && (
          <DataTablePanel
            title="Stock Reorder Forecast"
            columns={forecastColumns}
            data={forecastData.items}
            total={forecastData.total}
            page={1}
            pageSize={100}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
            expandable
            renderExpandedRow={renderExpandedRow}
          />
        )}
      </LoadStateBlock>""", ledger_ui)

with open('src/pages/StockPage.tsx', 'w') as f:
    f.write(content)
