import { Card, CardContent, CardHeader, FormControlLabel, Switch, Box } from "@mui/material";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendPoint } from "../types/analytics";
import { useFilters } from "../hooks/useFilters";
import { useState } from "react";

type Props = {
  data: TrendPoint[];
  title: string;
};

function TrendsChartPanel({ data, title }: Props) {
  const { filters } = useFilters();
  const [showCumulative, setShowCumulative] = useState(false);

  const chartData = data.map((point, index) => {
    if (!showCumulative) return point;
    
    const prev = index > 0 ? data[index - 1] : null;
    let cumulativePoint = { ...point };
    
    if (prev && (prev as any)._cumulative) {
      const prevCum = (prev as any)._cumulative;
      cumulativePoint.orders += prevCum.orders;
      cumulativePoint.revenue += prevCum.revenue;
      cumulativePoint.customers += prevCum.customers;
      cumulativePoint.stock += prevCum.stock;
      if (cumulativePoint.compareOrders !== undefined) cumulativePoint.compareOrders += prevCum.compareOrders || 0;
      if (cumulativePoint.compareRevenue !== undefined) cumulativePoint.compareRevenue += prevCum.compareRevenue || 0;
      if (cumulativePoint.compareCustomers !== undefined) cumulativePoint.compareCustomers += prevCum.compareCustomers || 0;
      if (cumulativePoint.compareStock !== undefined) cumulativePoint.compareStock += prevCum.compareStock || 0;
    }
    
    (cumulativePoint as any)._cumulative = { ...cumulativePoint };
    return cumulativePoint;
  });

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
            <Line type="monotone" dataKey="orders" stroke="#1e5631" strokeWidth={2} />
            <Line type="monotone" dataKey="customers" stroke="#3f8f55" strokeWidth={2} />
            <Line type="monotone" dataKey="stock" stroke="#cc6600" strokeWidth={2} />
            
            {filters.compareEnabled && <Line type="monotone" dataKey="compareOrders" name="Compare Orders" stroke="#1e5631" strokeDasharray="5 5" strokeWidth={2} />}
            {filters.compareEnabled && <Line type="monotone" dataKey="compareCustomers" name="Compare Customers" stroke="#3f8f55" strokeDasharray="5 5" strokeWidth={2} />}
            {filters.compareEnabled && <Line type="monotone" dataKey="compareStock" name="Compare Stock" stroke="#cc6600" strokeDasharray="5 5" strokeWidth={2} />}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default TrendsChartPanel;
