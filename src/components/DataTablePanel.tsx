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
  Typography,
  Link
} from "@mui/material";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import { formatCurrency, formatNumber } from "../lib/format";
import { DynamicTableRecord, TableColumn } from "../types/analytics";

type Props = {
  title?: string;
  rows: DynamicTableRecord[];
  columns: TableColumn[];
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  getLinkUrl?: (row: any, col: TableColumn) => string | null;
};

function DataTablePanel({ title, rows, columns, page, pageSize, totalCount, onPageChange, getLinkUrl }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  
  const renderCellContent = (value: any, type: TableColumn["type"], row: any, col: TableColumn) => {
    if (value === null || value === undefined) return "-";
    
    let formattedValue: string;
    switch (type) {
      case "currency":
        formattedValue = formatCurrency(Number(value));
        break;
      case "number":
        formattedValue = formatNumber(Number(value));
        break;
      case "boolean":
        formattedValue = value ? "Yes" : "No";
        break;
      case "date":
        formattedValue = new Date(value).toLocaleDateString();
        break;
      default:
        formattedValue = String(value);
    }

    const linkUrl = getLinkUrl ? getLinkUrl(row, col) : null;
    if (linkUrl) {
      return <Link href={linkUrl} target="_blank" rel="noopener noreferrer" underline="hover">{formattedValue}</Link>;
    }
    return formattedValue;
  };

  return (
    <Card>
      {title && <CardHeader title={title} />}
      <CardContent>
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No records match the selected filters.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell key={col.key} align={col.type === "number" || col.type === "currency" ? "right" : "left"}>
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  {columns.map((col) => (
                    <TableCell key={col.key} align={col.type === "number" || col.type === "currency" ? "right" : "left"}>
                      {col.key.includes("status") ? (
                        <Chip
                          size="small"
                          color={row[col.key] === "completed" || row[col.key] === "instock" ? "success" : row[col.key] === "processing" ? "warning" : "default"}
                          label={String(row[col.key])}
                        />
                      ) : (
                        renderCellContent(row[col.key], col.type, row, col)
                      )}
                    </TableCell>
                  ))}
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
