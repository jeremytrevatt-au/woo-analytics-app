import {
  Card,
  CardContent,
  CardHeader,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { formatCurrency, formatNumber } from "../lib/format";
import { TableRecord } from "../types/analytics";

type Props = {
  title: string;
  rows: TableRecord[];
};

function DataTablePanel({ title, rows }: Props) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardContent>
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No records match the selected filters.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Units</TableCell>
                <TableCell align="right">Revenue</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={row.status === "completed" ? "success" : row.status === "processing" ? "warning" : "default"}
                      label={row.status}
                    />
                  </TableCell>
                  <TableCell align="right">{formatNumber(row.metricA)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.metricB)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default DataTablePanel;
