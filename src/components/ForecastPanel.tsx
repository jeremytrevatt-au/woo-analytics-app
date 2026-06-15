import { Card, CardContent, CardHeader, ToggleButton, ToggleButtonGroup, Box, FormControlLabel, Switch } from "@mui/material";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState, useMemo } from "react";
import { ForecastPoint } from "../types/analytics";
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BarChartIcon from '@mui/icons-material/BarChart';

type Props = {
  forecast: ForecastPoint[];
};

function ForecastPanel({ forecast }: Props) {
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  const [showCumulative, setShowCumulative] = useState(false);

  const chartData = useMemo(() => {
    if (!showCumulative) return forecast;
    
    let runningActual = 0;
    let runningPredicted = 0;
    let runningCompareActual = 0;
    let runningComparePredicted = 0;

    return forecast.map((point) => {
      if (point.actual !== null) {
        runningActual += point.actual;
      }
      
      if (point.predicted !== null) {
        if (point.actual !== null) {
          // This is the connection point
          runningPredicted = runningActual;
        } else {
          runningPredicted += point.predicted;
        }
      }

      if (point.compareActual !== null) {
        runningCompareActual += point.compareActual;
      }

      if (point.comparePredicted !== null) {
        if (point.compareActual !== null) {
          runningComparePredicted = runningCompareActual;
        } else {
          runningComparePredicted += point.comparePredicted;
        }
      }
      
      return {
        ...point,
        actual: point.actual !== null ? runningActual : null,
        predicted: point.predicted !== null ? runningPredicted : null,
        compareActual: point.compareActual !== null ? runningCompareActual : null,
        comparePredicted: point.comparePredicted !== null ? runningComparePredicted : null,
      };
    });
  }, [forecast, showCumulative]);

  return (
    <Card sx={{ height: 400 }}>
      <CardHeader 
        title="Revenue Forecast" 
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControlLabel
              control={<Switch size="small" checked={showCumulative} onChange={(e) => setShowCumulative(e.target.checked)} />}
              label="Cumulative"
            />
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
          </Box>
        }
      />
      <CardContent sx={{ height: 330 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "area" ? (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="actual" name="Actual Revenue" stroke="#1e5631" fill="#9fceb0" />
              <Area type="monotone" dataKey="predicted" name="Forecast" stroke="#2d6cdf" fill="#b8ccff" strokeDasharray="5 5" />
              {chartData.some(f => f.compareActual !== null || f.comparePredicted !== null) && (
                <>
                  <Area type="monotone" dataKey="compareActual" name="Compare Actual" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="comparePredicted" name="Compare Forecast" stroke="#82ca9d" strokeDasharray="5 5" fill="none" />
                </>
              )}
            </AreaChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="actual" name="Actual Revenue" fill="#9fceb0" />
              <Bar dataKey="predicted" name="Forecast" fill="#b8ccff" />
              {chartData.some(f => f.compareActual !== null || f.comparePredicted !== null) && (
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
