import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import { formatCurrency, formatNumber } from "../lib/format";
import { TableRecord } from "../types/analytics";

type Props = {
  title: string;
  rows: TableRecord[];
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
};

function DataTablePanel({ title, rows, page, pageSize, totalCount, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
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
                <TableCell align="right">Metric A</TableCell>
                <TableCell align="right">Metric B</TableCell>
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
        <Box mt={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Page {page} / {totalPages} | {totalCount} total records
            </Typography>
            <Stack direction="row" spacing={1}>
              <IconButton size="small" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                <ChevronLeft fontSize="small" />
              </IconButton>
              <IconButton size="small" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                <ChevronRight fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

export default DataTablePanel;
