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
  Link,
  Collapse
} from "@mui/material";
import { ChevronLeft, ChevronRight, KeyboardArrowDown, KeyboardArrowUp } from "@mui/icons-material";
import { formatCurrency, formatNumber } from "../lib/format";
import { DynamicTableRecord, TableColumn } from "../types/analytics";
import { useState, Fragment } from "react";

type Props = {
  title?: string;
  rows: DynamicTableRecord[];
  columns: TableColumn[];
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  getLinkUrl?: (row: any, col: TableColumn) => string | null;
  renderExpandedRow?: (row: any) => React.ReactNode;
};

function DataTablePanel({ title, rows, columns: initialColumns, page, pageSize, totalCount, onPageChange, getLinkUrl, renderExpandedRow }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  
  let columns = initialColumns;
  
  const toggleRow = (index: number) => {
    setExpandedRows(prev => ({ ...prev, [index]: !prev[index] }));
  };
  
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

    if (!columns || columns.length === 0) {
      if (rows.length > 0) {
        columns = Object.keys(rows[0]).map(key => ({
          key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          type: "string"
        }));
      } else {
        columns = [];
      }
    }
    
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
                {renderExpandedRow && <TableCell width={40} />}
                {columns.map((col) => (
                  <TableCell key={col.key} align={col.type === "number" || col.type === "currency" ? "right" : "left"}>
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <Fragment key={index}>
                  <TableRow sx={{ '& > *': { borderBottom: renderExpandedRow ? 'unset' : undefined } }}>
                    {renderExpandedRow && (
                      <TableCell>
                        <IconButton
                          aria-label="expand row"
                          size="small"
                          onClick={() => toggleRow(index)}
                        >
                          {expandedRows[index] ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                        </IconButton>
                      </TableCell>
                    )}
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
                  {renderExpandedRow && (
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={columns.length + 1}>
                        <Collapse in={expandedRows[index]} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1 }}>
                            {renderExpandedRow(row)}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
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
