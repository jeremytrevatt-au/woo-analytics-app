import { Card, CardContent, CardHeader, FormControlLabel, Switch, Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { CartesianGrid, Legend, Line, LineChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendPoint } from "../types/analytics";
import { useFilters } from "../hooks/useFilters";
import { useState, useMemo } from "react";
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BarChartIcon from '@mui/icons-material/BarChart';

type Props = {
  data: TrendPoint[];
  title: string;
  domain?: "orders" | "customers" | "stock";
};

function TrendsChartPanel({ data, title, domain }: Props) {
  const { filters } = useFilters();
  const [showCumulative, setShowCumulative] = useState(false);
  const [chartType, setChartType] = useState<"line" | "bar">("line");

  const chartData = useMemo(() => {
    if (!showCumulative) return data;
    
    let runningOrders = 0;
    let runningRevenue = 0;
    let runningCustomers = 0;
    let runningStock = 0;
    let runningCompareOrders = 0;
    let runningCompareRevenue = 0;
    let runningCompareCustomers = 0;
    let runningCompareStock = 0;

    return data.map((point) => {
      runningOrders += point.orders || 0;
      runningRevenue += point.revenue || 0;
      runningCustomers += point.customers || 0;
      runningStock += point.stock || 0;
      runningCompareOrders += point.compareOrders || 0;
      runningCompareRevenue += point.compareRevenue || 0;
      runningCompareCustomers += point.compareCustomers || 0;
      runningCompareStock += point.compareStock || 0;

      return {
        ...point,
        orders: runningOrders,
        revenue: runningRevenue,
        customers: runningCustomers,
        stock: runningStock,
        compareOrders: runningCompareOrders,
        compareRevenue: runningCompareRevenue,
        compareCustomers: runningCompareCustomers,
        compareStock: runningCompareStock,
      };
    });
  }, [data, showCumulative]);

  const showOrders = domain === "orders" || (!domain && title.toLowerCase().includes("order"));
  const showCustomers = domain === "customers" || (!domain && title.toLowerCase().includes("customer"));
  const showStock = domain === "stock" || (!domain && title.toLowerCase().includes("stock"));

  const ChartComponent = chartType === "line" ? LineChart : BarChart;
  const DataComponent = chartType === "line" ? Line : Bar;

  return (
    <Card sx={{ height: 400 }}>
      <CardHeader 
        title={title} 
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControlLabel
              control={<Switch checked={showCumulative} onChange={(e) => setShowCumulative(e.target.checked)} />}
              label="Cumulative"
            />
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(e, val) => val && setChartType(val)}
              size="small"
            >
              <ToggleButton value="line"><ShowChartIcon fontSize="small" /></ToggleButton>
              <ToggleButton value="bar"><BarChartIcon fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
          </Box>
        }
      />
      <CardContent sx={{ height: 330 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            
            {showOrders && <DataComponent type="monotone" dataKey="orders" name="Orders" fill="#1e5631" stroke="#1e5631" strokeWidth={2} />}
            {showOrders && <DataComponent type="monotone" dataKey="revenue" name="Revenue" fill="#2e7d32" stroke="#2e7d32" strokeWidth={2} />}
            {showCustomers && <DataComponent type="monotone" dataKey="customers" name={domain === "customers" ? "Customers" : "Total Stock Units"} fill="#3f8f55" stroke="#3f8f55" strokeWidth={2} />}
            {showCustomers && domain === "customers" && <DataComponent type="monotone" dataKey="stock" name="Active Customers" fill="#cc6600" stroke="#cc6600" strokeWidth={2} />}
            {showStock && domain === "stock" && <DataComponent type="monotone" dataKey="stock" name="Out of Stock SKUs" fill="#cc6600" stroke="#cc6600" strokeWidth={2} />}
            
            {filters.compareEnabled && showOrders && <DataComponent type="monotone" dataKey="compareOrders" name="Compare Orders" fill="#1e5631" stroke="#1e5631" strokeDasharray="5 5" strokeWidth={2} fillOpacity={0.3} />}
            {filters.compareEnabled && showOrders && <DataComponent type="monotone" dataKey="compareRevenue" name="Compare Revenue" fill="#2e7d32" stroke="#2e7d32" strokeDasharray="5 5" strokeWidth={2} fillOpacity={0.3} />}
            {filters.compareEnabled && showCustomers && <DataComponent type="monotone" dataKey="compareCustomers" name={domain === "customers" ? "Compare Customers" : "Compare Total Stock"} fill="#3f8f55" stroke="#3f8f55" strokeDasharray="5 5" strokeWidth={2} fillOpacity={0.3} />}
            {filters.compareEnabled && showStock && domain === "stock" && <DataComponent type="monotone" dataKey="compareStock" name="Compare Out of Stock" fill="#cc6600" stroke="#cc6600" strokeDasharray="5 5" strokeWidth={2} fillOpacity={0.3} />}
          </ChartComponent>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default TrendsChartPanel;
