import { Card, CardContent, CardHeader } from "@mui/material";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ForecastPoint } from "../types/analytics";

type Props = {
  forecast: ForecastPoint[];
};

function ForecastPanel({ forecast }: Props) {
  return (
    <Card sx={{ height: 360 }}>
      <CardHeader title="Revenue Forecast" />
      <CardContent sx={{ height: 290 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={forecast}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="actual" stroke="#1e5631" fill="#9fceb0" />
            <Area type="monotone" dataKey="predicted" stroke="#2d6cdf" fill="#b8ccff" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default ForecastPanel;
