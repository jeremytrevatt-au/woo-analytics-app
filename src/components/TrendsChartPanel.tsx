import { Card, CardContent, CardHeader } from "@mui/material";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendPoint } from "../types/analytics";

type Props = {
  data: TrendPoint[];
  title: string;
};

function TrendsChartPanel({ data, title }: Props) {
  return (
    <Card sx={{ height: 360 }}>
      <CardHeader title={title} />
      <CardContent sx={{ height: 290 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="orders" stroke="#1e5631" strokeWidth={2} />
            <Line type="monotone" dataKey="customers" stroke="#3f8f55" strokeWidth={2} />
            <Line type="monotone" dataKey="stock" stroke="#cc6600" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default TrendsChartPanel;
