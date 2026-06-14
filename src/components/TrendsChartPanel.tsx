import { Card, CardContent, CardHeader, FormControlLabel, Switch, Box } from "@mui/material";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendPoint } from "../types/analytics";
import { useFilters } from "../hooks/useFilters";
import { useState, useMemo } from "react";

type Props = {
  data: TrendPoint[];
  title: string;
  domain?: "orders" | "customers" | "stock";
};

function TrendsChartPanel({ data, title, domain }: Props) {
  const { filters } = useFilters();
  const [showCumulative, setShowCumulative] = useState(false);

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

  // If domain is provided, only show relevant lines. Otherwise, guess based on title or show all.
  const showOrders = domain === "orders" || (!domain && title.toLowerCase().includes("order"));
  const showCustomers = domain === "customers" || (!domain && title.toLowerCase().includes("customer"));
  const showStock = domain === "stock" || (!domain && title.toLowerCase().includes("stock"));

  return (
    <Card sx={{ height: 400 }}>
      <CardHeader 
        title={title} 
        action={
          <FormControlLabel
            control={<Switch checked={showCumulative} onChange={(e) => setShowCumulative(e.target.checked)} />}
            label="Cumulative"
          />
        }
      />
      <CardContent sx={{ height: 330 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            
            {showOrders && <Line type="monotone" dataKey="orders" name="Orders" stroke="#1e5631" strokeWidth={2} />}
            {showOrders && <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#2e7d32" strokeWidth={2} />}
            {showCustomers && <Line type="monotone" dataKey="customers" name={domain === "customers" ? "Customers" : "Tracked SKUs"} stroke="#3f8f55" strokeWidth={2} />}
            {showCustomers && domain === "customers" && <Line type="monotone" dataKey="stock" name="Active Customers" stroke="#cc6600" strokeWidth={2} />}
            {showStock && domain === "stock" && <Line type="monotone" dataKey="stock" name="Out of Stock" stroke="#cc6600" strokeWidth={2} />}
            
            {filters.compareEnabled && showOrders && <Line type="monotone" dataKey="compareOrders" name="Compare Orders" stroke="#1e5631" strokeDasharray="5 5" strokeWidth={2} />}
            {filters.compareEnabled && showOrders && <Line type="monotone" dataKey="compareRevenue" name="Compare Revenue" stroke="#2e7d32" strokeDasharray="5 5" strokeWidth={2} />}
            {filters.compareEnabled && showCustomers && <Line type="monotone" dataKey="compareCustomers" name={domain === "customers" ? "Compare Customers" : "Compare Tracked SKUs"} stroke="#3f8f55" strokeDasharray="5 5" strokeWidth={2} />}
            {filters.compareEnabled && showStock && domain === "stock" && <Line type="monotone" dataKey="compareStock" name="Compare Out of Stock" stroke="#cc6600" strokeDasharray="5 5" strokeWidth={2} />}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default TrendsChartPanel;
