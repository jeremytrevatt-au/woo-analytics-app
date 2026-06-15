import { Card, CardContent, CardHeader, ToggleButton, ToggleButtonGroup, Box } from "@mui/material";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { ForecastPoint } from "../types/analytics";
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BarChartIcon from '@mui/icons-material/BarChart';

type Props = {
  forecast: ForecastPoint[];
};

function ForecastPanel({ forecast }: Props) {
  const [chartType, setChartType] = useState<"area" | "bar">("area");

  return (
    <Card sx={{ height: 400 }}>
      <CardHeader 
        title="Revenue Forecast" 
        action={
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={(_, newValue) => {
              if (newValue) setChartType(newValue);
            }}
            size="small"
          >
            <ToggleButton value="area" aria-label="area chart">
              <ShowChartIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="bar" aria-label="bar chart">
              <BarChartIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        }
      />
        <CardContent sx={{ height: 330 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "area" ? (
            <AreaChart data={forecast}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="actual" name="Actual Revenue" stroke="#1e5631" fill="#9fceb0" />
              <Area type="monotone" dataKey="predicted" name="Forecast" stroke="#2d6cdf" fill="#b8ccff" strokeDasharray="5 5" />
              {forecast.some(f => f.compareActual !== null || f.comparePredicted !== null) && (
                <>
                  <Area type="monotone" dataKey="compareActual" name="Compare Actual" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="comparePredicted" name="Compare Forecast" stroke="#82ca9d" strokeDasharray="5 5" fill="none" />
                </>
              )}
            </AreaChart>
          ) : (
            <BarChart data={forecast}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="actual" name="Actual Revenue" fill="#9fceb0" />
              <Bar dataKey="predicted" name="Forecast" fill="#b8ccff" />
              {forecast.some(f => f.compareActual !== null || f.comparePredicted !== null) && (
                <>
                  <Bar dataKey="compareActual" name="Compare Actual" fill="#82ca9d" />
                  <Bar dataKey="comparePredicted" name="Compare Forecast" fill="#a8e6cf" />
                </>
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default ForecastPanel;
