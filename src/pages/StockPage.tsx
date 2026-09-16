import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Check } from "@mui/icons-material";
import { Stack, Typography, Grid, TextField, MenuItem, Tabs, Tab, Box, Button, Card, CardContent, IconButton, useMediaQuery, useTheme, Menu, Checkbox, ListItemText } from "@mui/material";
import DataTablePanel from "../components/DataTablePanel";
import LoadStateBlock from "../components/LoadStateBlock";
import { useDashboardData } from "../hooks/useDashboardData";
import { useStockShortages } from "../hooks/useStockShortages";
import { useStockLedger } from "../hooks/useStockLedger";
import StockLedgerChartModal from "../components/StockLedgerChartModal";
import BulkUpdateModal from "../components/BulkUpdateModal";
import AddToPOModal from "../components/AddToPOModal";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { getStocktakeRecords, updateStockProductFields, updateStockQuantity } from "../api/analyticsApi";
import { useFilters } from "../hooks/useFilters";
import type { AppFilterState } from "../types/analytics";
import { getVisibleStockColumns } from "../lib/stockColumns";

type StockRangeFilterDraft = Pick<
  AppFilterState,
  | "stockAvgDailyUsageMin"
  | "stockAvgDailyUsageMax"
  | "stockDaysOfCoverMin"
  | "stockDaysOfCoverMax"
  | "stockProjectedStockoutStart"
  | "stockProjectedStockoutEnd"
>;

const stockRangeFilterKeys: (keyof StockRangeFilterDraft)[] = [
  "stockAvgDailyUsageMin",
  "stockAvgDailyUsageMax",
  "stockDaysOfCoverMin",
  "stockDaysOfCoverMax",
  "stockProjectedStockoutStart",
  "stockProjectedStockoutEnd",
];

function getStockRangeFilterDraft(filters: AppFilterState): StockRangeFilterDraft {
  return {
    stockAvgDailyUsageMin: filters.stockAvgDailyUsageMin,
    stockAvgDailyUsageMax: filters.stockAvgDailyUsageMax,
    stockDaysOfCoverMin: filters.stockDaysOfCoverMin,
    stockDaysOfCoverMax: filters.stockDaysOfCoverMax,
    stockProjectedStockoutStart: filters.stockProjectedStockoutStart,
    stockProjectedStockoutEnd: filters.stockProjectedStockoutEnd,
  };
}

const emptyStockRangeFilterDraft: StockRangeFilterDraft = {
  stockAvgDailyUsageMin: "",
  stockAvgDailyUsageMax: "",
  stockDaysOfCoverMin: "",
  stockDaysOfCoverMax: "",
  stockProjectedStockoutStart: "",
  stockProjectedStockoutEnd: "",
};

const stockColumnStorageKey = "nya.stockItems.visibleColumns.v1";

const defaultStockColumnKeys = [
  "product_id",
  "sku",
  "product_name",
  "category",
  "product_type",
  "stock_qty",
  "stock_status",
  "movement_count",
  "avg_daily_usage",
  "days_of_cover",
  "projected_stockout_date",
  "forecast_source",
  "nya_default_lead_time",
  "nya_stock_lead_time",
  "nya_stock_reorder_qty",
  "nya_stock_eta",
  "reorder_within_lead_time",
  "recent_movement_count",
  "actions",
];

const backorderOptions = [
  { value: "no", label: "Do not allow" },
  { value: "notify", label: "Allow, notify" },
  { value: "yes", label: "Allow" },
];

const yesNoOptions = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const nyPspOptions = [
  { value: "", label: "Inherit" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

function getStoredStockColumnKeys(): string[] {
  if (typeof window === "undefined") {
    return defaultStockColumnKeys;
  }
  try {
    const stored = window.localStorage.getItem(stockColumnStorageKey);
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultStockColumnKeys;
  } catch {
    return defaultStockColumnKeys;
  }
}

function formatInlineSelectValue(value: unknown, options: Array<{ value: string; label: string }>): string {
  const stringValue = value === null || value === undefined ? "" : String(value);
  return options.find((option) => option.value === stringValue)?.label ?? stringValue;
}

const colourSwatches: Record<string, string> = {
  black: "#111111",
  blue: "#1976d2",
  brown: "#795548",
  clear: "#e0f7fa",
  cream: "#fff8e1",
  green: "#2e7d32",
  grey: "#9e9e9e",
  gray: "#9e9e9e",
  orange: "#f57c00",
  pink: "#ec407a",
  purple: "#7b1fa2",
  red: "#d32f2f",
  silver: "#b0bec5",
  white: "#ffffff",
  yellow: "#fbc02d",
};

function cleanStocktakeAttributes(attributes: string): string {
  return attributes
    .replace(/\b(?:Pack Size|Choose Your Size|Colour|Color|Holes or No Holes):\s*/gi, "")
    .replace(/,\s*/g, " | ")
    .trim();
}

function splitStocktakeProductName(productName: string): { productName: string; attributes: string } {
  const parts = productName.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return { productName, attributes: "" };
  }

  const attributes = cleanStocktakeAttributes(parts.slice(1).join(" - "));

  return { productName: parts[0], attributes };
}

function removeWsviSizeAttributes(attributes: string): string {
  const sizePattern = /^(?:\d+(?:\.\d+)?\s*(?:g|gm|gms|gram|grams|kg|kgs|kilogram|kilograms|ml|millilitre|millilitres|l|litre|litres)|\d+\s*(?:pack|pk)|single)$/i;

  return attributes
    .split(/\s*(?:\|| - )\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !sizePattern.test(part))
    .filter((part, index, parts) => parts.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index)
    .join(" | ");
}

function getStocktakeDisplayAttributes(row: any, parsedProduct: { productName: string; attributes: string }): string {
  const explicitAttributes = cleanStocktakeAttributes(String(row.variant_attributes ?? ""));
  const attributes = explicitAttributes || parsedProduct.attributes;

  return row.product_type === "wsvi_group" ? removeWsviSizeAttributes(attributes) : attributes;
}

function findColourSwatch(attributes: string): string | null {
  const lowerAttributes = attributes.toLowerCase();
  const colourKey = Object.keys(colourSwatches).find((key) => new RegExp(`\\b${key}\\b`, "i").test(lowerAttributes));
  return colourKey ? colourSwatches[colourKey] : null;
}

function renderStocktakeItemCell(row: any) {
  const parsedProduct = splitStocktakeProductName(String(row.product_name ?? ""));
  const attributes = getStocktakeDisplayAttributes(row, parsedProduct);
  const productName = parsedProduct.productName;
  const swatchColour = findColourSwatch(attributes);

  return (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography variant="caption" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
        {row.sku}
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
        {productName}
      </Typography>
      {attributes ? (
        <Stack direction="row" spacing={0.75} alignItems="center">
          {swatchColour ? (
            <Box
              aria-hidden="true"
              sx={{
                width: 16,
                height: 16,
                borderRadius: 1,
                bgcolor: swatchColour,
                border: "1px solid",
                borderColor: swatchColour === "#ffffff" ? "grey.400" : "transparent",
                flexShrink: 0,
              }}
            />
          ) : null}
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {attributes}
          </Typography>
        </Stack>
      ) : null}
    </Stack>
  );
}

function renderStocktakeProductCell(row: any) {
  const parsedProduct = splitStocktakeProductName(String(row.product_name ?? ""));
  const attributes = getStocktakeDisplayAttributes(row, parsedProduct);
  const swatchColour = findColourSwatch(attributes);

  return (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
        {parsedProduct.productName}
      </Typography>
      {attributes ? (
        <Stack direction="row" spacing={0.75} alignItems="center">
          {swatchColour ? (
            <Box
              aria-hidden="true"
              sx={{
                width: 16,
                height: 16,
                borderRadius: 1,
                bgcolor: swatchColour,
                border: "1px solid",
                borderColor: swatchColour === "#ffffff" ? "grey.400" : "transparent",
                flexShrink: 0,
              }}
            />
          ) : null}
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {attributes}
          </Typography>
        </Stack>
      ) : null}
    </Stack>
  );
}

function formatStocktakeQuantity(value: any): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? numericValue.toLocaleString("en-AU", { maximumFractionDigits: 2 })
    : String(value);
}

function StockPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "shortages" ? 1 : searchParams.get("tab") === "stocktake" ? 2 : 0;
  const [activeTab, setActiveTab] = useState(initialTab);
  const { filters, updateFilter, updateFilters } = useFilters();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const handleTabChange = (_event: SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    const tabValues = ["items", "shortages", "stocktake"];
    setSearchParams({ tab: tabValues[newValue] });
  };

  const [page, setPage] = useState(1);
  const [lookbackDays, setLookbackDays] = useState<number | "dynamic">(365);
  
  const [shortagesPage, setShortagesPage] = useState(1);
  const [stocktakePage, setStocktakePage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerReason, setLedgerReason] = useState<string>("order_placed");
  const [ledgerSearch, setLedgerSearch] = useState<string>("");
  const [selectedSku, setSelectedSku] = useState<{
    sku: string;
    name: string;
    productId?: number | null;
    wsviGroupId?: string | null;
    canonicalProductKey?: string | null;
  } | null>(null);

  const { rows, columns, isLoading, error, totalCount, pageSize, refetch } = useDashboardData("stock", page, 50);
  const stockShortages = useStockShortages(shortagesPage, 50);
  const stockLedger = useStockLedger(1, 200, ledgerReason === "all" ? null : ledgerReason, ledgerSearch);

  const [selectedStockRecords, setSelectedStockRecords] = useState<any[]>([]);
  const [bulkUpdateModalOpen, setBulkUpdateModalOpen] = useState(false);
  const [addToPoModalOpen, setAddToPoModalOpen] = useState(false);
  const [stocktakeRows, setStocktakeRows] = useState<any[]>([]);
  const [stocktakeColumns, setStocktakeColumns] = useState<any[]>([]);
  const [stocktakeTotalCount, setStocktakeTotalCount] = useState(0);
  const [stocktakeLoading, setStocktakeLoading] = useState(false);
  const [stocktakeError, setStocktakeError] = useState<string | null>(null);
  const [stocktakeInputs, setStocktakeInputs] = useState<Record<string, string>>({});
  const [stocktakeSaving, setStocktakeSaving] = useState<Record<string, boolean>>({});
  const [stocktakeMessages, setStocktakeMessages] = useState<Record<string, string>>({});
  const [stockRangeDraft, setStockRangeDraft] = useState<StockRangeFilterDraft>(() => getStockRangeFilterDraft(filters));
  const [visibleStockColumnKeys, setVisibleStockColumnKeys] = useState<string[]>(getStoredStockColumnKeys);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<HTMLElement | null>(null);
  const [stockProductOverrides, setStockProductOverrides] = useState<Record<string, Record<string, unknown>>>({});
  const [stockCellDrafts, setStockCellDrafts] = useState<Record<string, string>>({});
  const [stockCellSaving, setStockCellSaving] = useState<Record<string, boolean>>({});
  const [stockCellMessages, setStockCellMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    setStockRangeDraft(getStockRangeFilterDraft(filters));
  }, [
    filters.stockAvgDailyUsageMin,
    filters.stockAvgDailyUsageMax,
    filters.stockDaysOfCoverMin,
    filters.stockDaysOfCoverMax,
    filters.stockProjectedStockoutStart,
    filters.stockProjectedStockoutEnd,
  ]);

  useEffect(() => {
    setPage(1);
    setShortagesPage(1);
    setStocktakePage(1);
    setLedgerPage(1);
  }, [filters]);

  const handleBulkUpdateSuccess = () => {
    setSelectedStockRecords([]);
    refetch();
    stockShortages.refetch();
  };

  const handleAddToPoSuccess = (saved: boolean) => {
    setAddToPoModalOpen(false);
    if (saved) {
      setSelectedStockRecords([]);
      // Optionally refetch or show success message
    }
  };

  useEffect(() => {
    if (activeTab !== 2) return;
    let isSubscribed = true;
    setStocktakeLoading(true);
    setStocktakeError(null);
    getStocktakeRecords(filters, stocktakePage, 50)
      .then((response) => {
        if (!isSubscribed) return;
        setStocktakeRows(response.records);
        setStocktakeColumns(response.columns || []);
        setStocktakeTotalCount(response.totalCount);
      })
      .catch((error: any) => {
        if (isSubscribed) setStocktakeError(error.message || "Failed to load stocktake rows.");
      })
      .finally(() => {
        if (isSubscribed) setStocktakeLoading(false);
      });
    return () => {
      isSubscribed = false;
    };
  }, [activeTab, filters, stocktakePage]);

  const handleStocktakeSave = async (row: any) => {
    const key = String(row.product_id);
    const value = stocktakeInputs[key];
    const nextQty = Number(value);
    if (!Number.isFinite(nextQty) || nextQty < 0) {
      setStocktakeMessages(prev => ({ ...prev, [key]: "Enter a stock quantity of 0 or higher." }));
      return;
    }
    setStocktakeSaving(prev => ({ ...prev, [key]: true }));
    setStocktakeMessages(prev => ({ ...prev, [key]: "Saving..." }));
    try {
      const response = await updateStockQuantity(Number(row.product_id), nextQty);
      const savedQty = response.stock_qty ?? nextQty;
      setStocktakeRows(prev => prev.map((item: any) => String(item.product_id) === key
        ? {
            ...item,
            stock_qty: savedQty,
            stock_status: response.stock_status ?? item.stock_status,
          }
        : item
      ));
      setStocktakeInputs(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setStocktakeMessages(prev => ({ ...prev, [key]: `Saved ${savedQty}` }));
    } catch (error: any) {
      setStocktakeMessages(prev => ({ ...prev, [key]: error.message || "Failed to update stock." }));
    } finally {
      setStocktakeSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const isStocktakeQuantityEditable = (row: any) => row.manage_stock !== false || Boolean(row.wsvi_group_id);

  const renderStocktakeManualStatusNotice = () => (
    <Typography variant="caption" color="text.secondary">
      Stock status managed manually / bundle-derived
    </Typography>
  );

  const renderStocktakeSaveControls = (row: any, compact = false) => {
    const key = String(row.product_id);
    const inputValue = stocktakeInputs[key] ?? "";

    if (!isStocktakeQuantityEditable(row)) {
      return renderStocktakeManualStatusNotice();
    }

    return (
      <Stack direction="row" spacing={compact ? 0.5 : 1} alignItems="center" onClick={(event) => event.stopPropagation()}>
        <TextField
          size="small"
          type="number"
          value={inputValue}
          placeholder={String(row.stock_qty ?? "")}
          inputProps={{ min: 0, step: "any" }}
          onChange={(event) => setStocktakeInputs(prev => ({ ...prev, [key]: event.target.value }))}
          sx={{ width: compact ? 92 : 120 }}
        />
        <IconButton
          size="small"
          color="primary"
          disabled={stocktakeSaving[key] || inputValue === ""}
          onClick={() => handleStocktakeSave(row)}
          aria-label={`Save stock quantity for ${row.sku}`}
        >
          <Check fontSize="small" />
        </IconButton>
      </Stack>
    );
  };

  const renderStocktakeMessage = (row: any) => {
    const key = String(row.product_id);
    if (!stocktakeMessages[key]) return null;

    return (
      <Typography variant="caption" color={stocktakeMessages[key].startsWith("Saved") ? "success.main" : "text.secondary"}>
        {stocktakeMessages[key]}
      </Typography>
    );
  };

  const updateStockRangeDraft = (key: keyof StockRangeFilterDraft, value: string) => {
    setStockRangeDraft((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const hasPendingStockRangeFilters = stockRangeFilterKeys.some((key) => stockRangeDraft[key] !== filters[key]);
  const hasAppliedStockRangeFilters = stockRangeFilterKeys.some((key) => filters[key] !== "");

  const handleApplyStockRangeFilters = () => {
    updateFilters(stockRangeDraft);
  };

  const handleClearStockRangeFilters = () => {
    setStockRangeDraft(emptyStockRangeFilterDraft);
    updateFilters(emptyStockRangeFilterDraft);
  };

  const setVisibleStockColumns = (nextKeys: string[]) => {
    const safeKeys = nextKeys.length > 0 ? nextKeys : ["sku"];
    setVisibleStockColumnKeys(safeKeys);
    window.localStorage.setItem(stockColumnStorageKey, JSON.stringify(safeKeys));
  };

  const toggleStockColumn = (columnKey: string) => {
    setVisibleStockColumns(
      visibleStockColumnKeys.includes(columnKey)
        ? visibleStockColumnKeys.filter((key) => key !== columnKey)
        : [...visibleStockColumnKeys, columnKey]
    );
  };

  const isEditableStockRow = (row: any) => row.product_type !== "wsvi_group";

  const handleStockProductFieldSave = async (
    row: any,
    cellKey: string,
    fields: Record<string, unknown>
  ) => {
    if (!isEditableStockRow(row)) {
      setStockCellMessages((previous) => ({ ...previous, [cellKey]: "WSVI grouped rows cannot be edited directly." }));
      return;
    }
    const productId = Number(row.product_id);
    if (!Number.isFinite(productId) || productId <= 0) {
      setStockCellMessages((previous) => ({ ...previous, [cellKey]: "Missing product ID." }));
      return;
    }

    setStockCellSaving((previous) => ({ ...previous, [cellKey]: true }));
    setStockCellMessages((previous) => ({ ...previous, [cellKey]: "Saving..." }));
    try {
      const response = await updateStockProductFields([productId], fields);
      if (!response.success) {
        const message = response.errors?.map((item) => `${item.product_id}: ${item.message}`).join("; ") || response.message;
        throw new Error(message || "Product update failed.");
      }
      const savedProduct = response.products?.[0] ?? fields;
      setStockProductOverrides((previous) => ({
        ...previous,
        [String(productId)]: {
          ...(previous[String(productId)] ?? {}),
          ...savedProduct,
        },
      }));
      setStockCellDrafts((previous) => {
        const next = { ...previous };
        Object.keys(fields).forEach((fieldKey) => {
          delete next[`${productId}:${fieldKey}`];
        });
        return next;
      });
      setStockCellMessages((previous) => ({ ...previous, [cellKey]: "Saved" }));
    } catch (error: any) {
      setStockCellMessages((previous) => ({ ...previous, [cellKey]: error.message || "Failed to save." }));
    } finally {
      setStockCellSaving((previous) => ({ ...previous, [cellKey]: false }));
    }
  };

  const renderCellMessage = (cellKey: string) => {
    const message = stockCellMessages[cellKey];
    if (!message) return null;
    return (
      <Typography
        variant="caption"
        color={message === "Saved" ? "success.main" : message === "Saving..." ? "text.secondary" : "error.main"}
        sx={{ display: "block" }}
      >
        {message}
      </Typography>
    );
  };

  const renderEditableTextCell = (row: any, fieldKey: string, inputType: "text" | "number" = "text", width = 110) => {
    const productId = String(row.product_id);
    const cellKey = `${productId}:${fieldKey}`;
    const rawValue = row[fieldKey] === null || row[fieldKey] === undefined ? "" : String(row[fieldKey]);
    const value = stockCellDrafts[cellKey] ?? rawValue;
    if (!isEditableStockRow(row)) {
      return rawValue || "-";
    }

    const saveIfChanged = () => {
      if (value === rawValue) return;
      handleStockProductFieldSave(row, cellKey, { [fieldKey]: value });
    };

    return (
      <Box>
        <TextField
          size="small"
          type={inputType}
          value={value}
          disabled={Boolean(stockCellSaving[cellKey])}
          onChange={(event) => setStockCellDrafts((previous) => ({ ...previous, [cellKey]: event.target.value }))}
          onBlur={saveIfChanged}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          inputProps={inputType === "number" ? { step: "any", min: 0 } : undefined}
          sx={{ width }}
        />
        {renderCellMessage(cellKey)}
      </Box>
    );
  };

  const renderEditableSelectCell = (
    row: any,
    fieldKey: string,
    options: Array<{ value: string; label: string }>,
    toPayload?: (value: string) => unknown,
    width = 150
  ) => {
    const productId = String(row.product_id);
    const cellKey = `${productId}:${fieldKey}`;
    const rawValue = row[fieldKey] === null || row[fieldKey] === undefined ? "" : String(row[fieldKey]);
    if (!isEditableStockRow(row)) {
      return formatInlineSelectValue(rawValue, options) || "-";
    }

    return (
      <Box>
        <TextField
          size="small"
          select
          value={rawValue}
          disabled={Boolean(stockCellSaving[cellKey])}
          onChange={(event) => {
            const nextValue = event.target.value;
            handleStockProductFieldSave(row, cellKey, { [fieldKey]: toPayload ? toPayload(nextValue) : nextValue });
          }}
          sx={{ width }}
        >
          {options.map((option) => (
            <MenuItem key={option.value || "blank"} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        {renderCellMessage(cellKey)}
      </Box>
    );
  };

  const renderDimensionsCell = (row: any) => {
    if (!isEditableStockRow(row)) {
      const values = [row.length, row.width, row.height].map((value) => value ?? "-");
      return values.join(" x ");
    }
    return (
      <Stack direction="row" spacing={0.75}>
        {renderEditableTextCell(row, "length", "number", 76)}
        {renderEditableTextCell(row, "width", "number", 76)}
        {renderEditableTextCell(row, "height", "number", 76)}
      </Stack>
    );
  };

  const stockRows = (rows as any[]).map((row) => ({
    ...row,
    ...(stockProductOverrides[String(row.product_id)] ?? {}),
  }));

  const unifiedRows = stockRows.map((row) => {
    return {
      ...row,
      weight: renderEditableTextCell(row, "weight", "number"),
      dimensions: renderDimensionsCell(row),
      shipping_class: renderEditableTextCell(row, "shipping_class", "text", 150),
      regular_price: renderEditableTextCell(row, "regular_price", "number"),
      sale_price: renderEditableTextCell(row, "sale_price", "number"),
      manage_stock: renderEditableSelectCell(row, "manage_stock", yesNoOptions, (value) => value === "true"),
      enabled: renderEditableSelectCell(row, "enabled", yesNoOptions, (value) => value === "true"),
      backorders: renderEditableSelectCell(row, "backorders", backorderOptions, undefined, 190),
      ny_shippit_ppm: renderEditableTextCell(row, "ny_shippit_ppm", "number", 130),
      ny_packaging_overhead: renderEditableTextCell(row, "ny_packaging_overhead", "number", 130),
      ny_psp: renderEditableSelectCell(row, "ny_psp", nyPspOptions, undefined, 170),
      recent_movement_count: row.movement_count ?? 0,
      actions: (
        <Button size="small" variant="outlined" onClick={() => setSelectedSku({
          sku: row.sku,
          name: row.product_name,
          productId: row.product_id ? Number(row.product_id) : null,
          wsviGroupId: row.wsvi_group_id || null,
          canonicalProductKey: row.canonical_product_key || null,
        })}>
          Analyze
        </Button>
      ),
    };
  });
  const baseUnifiedColumns = columns
    .filter((column) => !["length", "width", "height"].includes(column.key))
    .flatMap((column) => {
      const normalizedColumn = ["weight", "shipping_class", "regular_price", "sale_price", "manage_stock", "enabled", "backorders", "ny_shippit_ppm", "ny_packaging_overhead", "ny_psp"].includes(column.key)
        ? { ...column, type: "node" as const }
        : column;
      if (column.key === "weight") {
        return [
          normalizedColumn,
          { key: "dimensions", label: "Dimensions (LxWxH)", type: "node" as const },
        ];
      }
      return [normalizedColumn];
    });
  const configurableUnifiedColumns = [
    ...baseUnifiedColumns,
    { key: "reorder_within_lead_time", label: "Needs Reorder", type: "boolean" as const },
    { key: "recent_movement_count", label: "Recent Movements", type: "number" as const },
  ];
  const visibleUnifiedColumns = getVisibleStockColumns(configurableUnifiedColumns, visibleStockColumnKeys);
  const columnSelectorOptions = configurableUnifiedColumns;

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        Stock
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Track out-of-stock risk and stock movement by SKU and product line.
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="stock tabs"
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons={isMobile ? "auto" : false}
          allowScrollButtonsMobile
        >
          <Tab label="Stock Items" />
          <Tab label="Stock Shortages & Affected Orders" />
          <Tab label="Stocktake" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <>
          <LoadStateBlock isLoading={isLoading} error={error} empty={!isLoading && !error && rows.length === 0} />
          {!isLoading && !error ? (
              <>
                <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      select
                      label="Forecast Average Window"
                      value={lookbackDays}
                      onChange={(e) => {
                        const value = e.target.value;
                        setLookbackDays(value === "dynamic" ? "dynamic" : Number(value));
                      }}
                      size="small"
                    >
                      <MenuItem value={7}>Last 7 Days</MenuItem>
                      <MenuItem value={14}>Last 14 Days</MenuItem>
                      <MenuItem value={30}>Last 30 Days</MenuItem>
                      <MenuItem value={60}>Last 60 Days</MenuItem>
                      <MenuItem value={90}>Last 90 Days</MenuItem>
                      <MenuItem value={180}>Last 180 Days</MenuItem>
                      <MenuItem value={365}>Last 365 Days</MenuItem>
                      <MenuItem value="dynamic">Dynamic</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Movement Search"
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      select
                      label="Movement Reason"
                      value={ledgerReason}
                      onChange={(e) => setLedgerReason(e.target.value)}
                      size="small"
                    >
                      <MenuItem value="all">All Movements</MenuItem>
                      <MenuItem value="manual_edit">Manual Edit</MenuItem>
                      <MenuItem value="order_placed">Order Placed</MenuItem>
                      <MenuItem value="order_restocked">Order Restocked</MenuItem>
                      <MenuItem value="order_refunded">Order Refunded</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Avg Usage Min"
                      value={stockRangeDraft.stockAvgDailyUsageMin}
                      onChange={(e) => updateStockRangeDraft("stockAvgDailyUsageMin", e.target.value)}
                      size="small"
                      inputProps={{ min: 0, step: "any" }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Avg Usage Max"
                      value={stockRangeDraft.stockAvgDailyUsageMax}
                      onChange={(e) => updateStockRangeDraft("stockAvgDailyUsageMax", e.target.value)}
                      size="small"
                      inputProps={{ min: 0, step: "any" }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Days Cover Min"
                      value={stockRangeDraft.stockDaysOfCoverMin}
                      onChange={(e) => updateStockRangeDraft("stockDaysOfCoverMin", e.target.value)}
                      size="small"
                      inputProps={{ min: 0, step: "any" }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Days Cover Max"
                      value={stockRangeDraft.stockDaysOfCoverMax}
                      onChange={(e) => updateStockRangeDraft("stockDaysOfCoverMax", e.target.value)}
                      size="small"
                      inputProps={{ min: 0, step: "any" }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Stockout From"
                      value={stockRangeDraft.stockProjectedStockoutStart}
                      onChange={(e) => updateStockRangeDraft("stockProjectedStockoutStart", e.target.value)}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Stockout To"
                      value={stockRangeDraft.stockProjectedStockoutEnd}
                      onChange={(e) => updateStockRangeDraft("stockProjectedStockoutEnd", e.target.value)}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Stack direction="row" spacing={1}>
                      <Button
                        fullWidth
                        variant="contained"
                        onClick={handleApplyStockRangeFilters}
                        disabled={!hasPendingStockRangeFilters}
                      >
                        Apply
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={handleClearStockRangeFilters}
                        disabled={!hasAppliedStockRangeFilters && !hasPendingStockRangeFilters}
                      >
                        Clear
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
                <Box sx={{ mb: 2, display: "flex", justifyContent: "flex-end", gap: 1, flexWrap: "wrap" }}>
                  <Button
                    variant="outlined"
                    onClick={(event) => setColumnMenuAnchor(event.currentTarget)}
                  >
                    Columns ({visibleUnifiedColumns.length - 1})
                  </Button>
                  <Menu
                    anchorEl={columnMenuAnchor}
                    open={Boolean(columnMenuAnchor)}
                    onClose={() => setColumnMenuAnchor(null)}
                  >
                    {columnSelectorOptions.map((column) => (
                      <MenuItem key={column.key} onClick={() => toggleStockColumn(column.key)}>
                        <Checkbox checked={visibleStockColumnKeys.includes(column.key)} />
                        <ListItemText primary={column.label} />
                      </MenuItem>
                    ))}
                  </Menu>
                  <Button 
                    variant="outlined" 
                    disabled={selectedStockRecords.length === 0}
                    onClick={() => setAddToPoModalOpen(true)}
                  >
                    Add to PO ({selectedStockRecords.length})
                  </Button>
                  <Button 
                    variant="contained" 
                    disabled={selectedStockRecords.length === 0}
                    onClick={() => setBulkUpdateModalOpen(true)}
                  >
                    Bulk Update Product Fields ({selectedStockRecords.length})
                  </Button>
                </Box>
                <DataTablePanel
                  title="Stock Items"
                  rows={unifiedRows as any}
                  columns={visibleUnifiedColumns}
                  page={page}
                  pageSize={pageSize}
                  totalCount={totalCount}
                  onPageChange={setPage}
                  getLinkUrl={(row, col) => col.key === "product_id" ? `https://naturalyield.com.au/wp-admin/post.php?post=${row.parent_id || row.product_id}&action=edit` : null}
                  selectable
                  selectedRows={selectedStockRecords}
                  onSelectionChange={setSelectedStockRecords}
                  rowIdKey="product_id"
                  stickyHeader
                  maxHeight={720}
                />
              </>
          ) : null}
        </>
      )}

      {activeTab === 1 && (
        <>
          <LoadStateBlock isLoading={stockShortages.isLoading} error={stockShortages.error} empty={!stockShortages.isLoading && !stockShortages.error && stockShortages.records.length === 0} />
          {!stockShortages.isLoading && !stockShortages.error && stockShortages.records.length > 0 ? (
            <DataTablePanel
              title="Stock Shortages & Affected Orders"
              rows={stockShortages.records}
              columns={stockShortages.columns}
              page={stockShortages.page}
              pageSize={stockShortages.pageSize}
              totalCount={stockShortages.totalCount}
              onPageChange={setShortagesPage}
              renderExpandedRow={(row) => {
                const orders = row.affected_orders as any[];
                if (!orders || orders.length === 0) return <Typography variant="body2">No affected orders found.</Typography>;
                return (
                  <Table size="small" aria-label="affected-orders">
                    <TableHead>
                      <TableRow>
                        <TableCell>Order ID</TableCell>
                        <TableCell>Date</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Qty</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.map((o: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{o.order_id}</TableCell>
                      <TableCell>{new Date(o.order_date).toLocaleDateString("en-AU")}</TableCell>
                      <TableCell>{o.customer_name}</TableCell>
                      <TableCell>{o.order_status}</TableCell>
                      <TableCell align="right">{o.qty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            );
          }}
        />
      ) : null}
      </>
      )}

      {activeTab === 2 && (
        <>
          <LoadStateBlock isLoading={stocktakeLoading} error={stocktakeError} empty={!stocktakeLoading && !stocktakeError && stocktakeRows.length === 0} />
          {!stocktakeLoading && !stocktakeError && isMobile ? (
            <Stack spacing={1}>
              {stocktakeRows.map((row: any) => (
                <Card key={String(row.product_id)} variant="outlined">
                  <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 } }}>
                    <Box sx={{ mb: 1 }}>
                      {renderStocktakeItemCell(row)}
                    </Box>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "0.8fr 0.9fr minmax(128px, auto)",
                        gap: 1,
                        alignItems: "center",
                      }}
                    >
                      {isStocktakeQuantityEditable(row) ? (
                        <>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Qty
                            </Typography>
                            <Typography variant="body2" fontWeight={700}>
                              {formatStocktakeQuantity(row.stock_qty)}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Unpacked
                            </Typography>
                            <Typography variant="body2" fontWeight={700}>
                              {formatStocktakeQuantity(row.qty_to_be_packed)}
                            </Typography>
                          </Box>
                          <Box sx={{ justifySelf: "end" }}>
                            {renderStocktakeSaveControls(row, true)}
                          </Box>
                        </>
                      ) : (
                        <Box sx={{ gridColumn: "1 / -1" }}>
                          {renderStocktakeManualStatusNotice()}
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ mt: 0.5 }}>
                      {renderStocktakeMessage(row)}
                    </Box>
                  </CardContent>
                </Card>
              ))}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Page {stocktakePage} / {Math.max(1, Math.ceil(stocktakeTotalCount / 50))} | {stocktakeTotalCount} total records
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" disabled={stocktakePage <= 1} onClick={() => setStocktakePage(stocktakePage - 1)}>
                    Previous
                  </Button>
                  <Button size="small" disabled={stocktakePage >= Math.max(1, Math.ceil(stocktakeTotalCount / 50))} onClick={() => setStocktakePage(stocktakePage + 1)}>
                    Next
                  </Button>
                </Stack>
              </Stack>
            </Stack>
          ) : null}
          {!stocktakeLoading && !stocktakeError && !isMobile ? (
            <DataTablePanel
              title="Stocktake"
              rows={stocktakeRows.map((row: any) => {
                const displayRow = {
                  ...row,
                  product_name: renderStocktakeProductCell(row),
                  stock_qty: isStocktakeQuantityEditable(row) ? row.stock_qty : "",
                  qty_to_be_packed: isStocktakeQuantityEditable(row) ? row.qty_to_be_packed : "",
                  new_qty: (
                    <Stack direction="row" spacing={1} alignItems="center">
                      {renderStocktakeSaveControls(row)}
                      {renderStocktakeMessage(row)}
                    </Stack>
                  ),
                };
                return displayRow;
              })}
              columns={isMobile
                ? [
                    { key: "sku", label: "Item", type: "node" as const },
                    { key: "stock_qty", label: "Qty", type: "number" as const },
                    { key: "qty_to_be_packed", label: "Unpacked", type: "number" as const },
                    { key: "new_qty", label: "New Qty", type: "node" as const },
                  ]
                : stocktakeColumns.map((column: any) => {
                    if (column.key === "new_qty") return { ...column, type: "node" as const };
                    if (column.key === "product_name") return { ...column, type: "node" as const };
                    if (column.key === "qty_to_be_packed") return { ...column, label: "Unpacked" };
                    return column;
                  })}
              page={stocktakePage}
              pageSize={50}
              totalCount={stocktakeTotalCount}
              onPageChange={setStocktakePage}
              getLinkUrl={(row, col) => col.key === "sku" ? `https://naturalyield.com.au/wp-admin/post.php?post=${row.parent_id || row.product_id}&action=edit` : null}
              stickyHeader
              maxHeight={720}
              rowIdKey="product_id"
            />
          ) : null}
        </>
      )}

      {activeTab === 3 && (
        <>
      <Box sx={{ mt: 4, mb: 2, display: "flex", gap: 2, alignItems: "center" }}>
        <Typography variant="h6">Stock Movement Ledger</Typography>
        <TextField
          label="Search SKU or Name"
          value={ledgerSearch}
          onChange={(e) => {
            setLedgerSearch(e.target.value);
            setLedgerPage(1);
          }}
          size="small"
          sx={{ minWidth: 250 }}
        />
        <TextField
          select
          label="Reason"
          value={ledgerReason}
          onChange={(e) => {
            setLedgerReason(e.target.value);
            setLedgerPage(1);
          }}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="all">All Movements</MenuItem>
          <MenuItem value="manual_edit">Manual Edit</MenuItem>
          <MenuItem value="order_placed">Order Placed</MenuItem>
          <MenuItem value="order_restocked">Order Restocked</MenuItem>
          <MenuItem value="order_refunded">Order Refunded</MenuItem>
        </TextField>
      </Box>

      <LoadStateBlock
        isLoading={stockLedger.isLoading}
        error={stockLedger.error}
        empty={!stockLedger.isLoading && !stockLedger.error && (!stockLedger.data || stockLedger.data.items.length === 0)}
      />
      {!stockLedger.isLoading && !stockLedger.error && stockLedger.data && stockLedger.data.items.length > 0 ? (
              <DataTablePanel
                title="Stock Movement History"
                  columns={[
                    { key: "timestamp", label: "Date/Time", type: "string" },
                    { key: "sku", label: "SKU", type: "string" },
                    { key: "product_name", label: "Product Name", type: "string" },
                    { key: "reason", label: "Reason", type: "string" },
                    { key: "change_amount", label: "Change", type: "string" },
                    { key: "new_stock_level", label: "New Level", type: "number" },
                    { key: "reference_id", label: "Ref ID (Order)", type: "string" },
                    { key: "actions", label: "Actions", type: "node" },
                  ]}
                rows={stockLedger.data.items.map((i: any) => {
                  let formattedDate = i.timestamp;
                  try {
                    // BigQuery sometimes returns dates as "YYYY-MM-DD HH:MM:SS" which Safari/Firefox fail to parse.
                    // Replace space with T to make it ISO 8601 compliant before parsing.
                    const isoString = i.timestamp.replace(' ', 'T');
                    formattedDate = new Date(isoString).toLocaleString("en-AU");
                  } catch (e) {
                    console.error("Date parsing error", e);
                  }
                  return {
                    ...i,
                    timestamp: formattedDate,
                    change_amount: i.change_amount > 0 ? `+${i.change_amount}` : i.change_amount,
                    reference_id: i.reference_id > 0 ? i.reference_id : "-",
                    actions: (
                      <Button 
                        size="small" 
                        variant="outlined" 
                        onClick={() => setSelectedSku({ sku: i.sku, name: i.product_name })}
                      >
                        View Chart
                      </Button>
                    ),
                  };
                })}
                totalCount={stockLedger.data.total}
                page={ledgerPage}
                pageSize={50}
                onPageChange={setLedgerPage}
              />
        ) : null}
        <StockLedgerChartModal 
          sku={selectedSku?.sku || null} 
          productName={selectedSku?.name || null} 
          movementReason={ledgerReason}
          onClose={() => setSelectedSku(null)} 
        />
        </>
      )}

      <StockLedgerChartModal
        sku={selectedSku?.sku || null}
        productName={selectedSku?.name || null}
        productId={selectedSku?.productId || null}
        wsviGroupId={selectedSku?.wsviGroupId || null}
        canonicalProductKey={selectedSku?.canonicalProductKey || null}
        lookbackDays={lookbackDays}
        startDate={filters.startDate}
        endDate={filters.endDate}
        movementReason={ledgerReason}
        onClose={() => setSelectedSku(null)}
      />

      <BulkUpdateModal
        open={bulkUpdateModalOpen}
        onClose={() => setBulkUpdateModalOpen(false)}
        selectedProducts={selectedStockRecords}
        onSuccess={handleBulkUpdateSuccess}
      />
      {addToPoModalOpen && (
        <AddToPOModal
          open={addToPoModalOpen}
          onClose={handleAddToPoSuccess}
          selectedItems={selectedStockRecords}
        />
      )}
    </Stack>
  );
}

export default StockPage;
