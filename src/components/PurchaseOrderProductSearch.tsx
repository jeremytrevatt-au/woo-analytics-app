import { useEffect, useMemo, useState } from "react";
import { Autocomplete, Box, Button, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import type { ProductSearchResult } from "../api/productsApi";
import { productsApi } from "../api/productsApi";
import type { PurchaseOrderLine } from "../api/purchaseOrdersApi";
import { findExistingProductLine, searchProductIndex } from "../lib/purchaseOrderProductSearch";

type Props = {
  lines: readonly PurchaseOrderLine[];
  onAdd: (product: ProductSearchResult) => void;
  onExisting: (lineIndex: number, product: ProductSearchResult) => void;
  onFilterChange: (query: string) => void;
  isOptionDisabled?: (option: ProductSearchResult) => boolean;
  formatOptionLabel?: (option: ProductSearchResult) => string;
};

type MuiKeyboardEvent = React.KeyboardEvent<HTMLDivElement> & {
  defaultMuiPrevented?: boolean;
};

export default function PurchaseOrderProductSearch({
  lines,
  onAdd,
  onExisting,
  onFilterChange,
  isOptionDisabled,
  formatOptionLabel,
}: Props) {
  const [productIndex, setProductIndex] = useState<ProductSearchResult[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [acceptedProduct, setAcceptedProduct] = useState<ProductSearchResult | null>(null);
  const [highlightedProduct, setHighlightedProduct] = useState<ProductSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    productsApi.getIndex()
      .then((products) => {
        if (!active) return;
        setProductIndex(products);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load the product index.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const options = useMemo(
    () => searchProductIndex(productIndex, inputValue),
    [inputValue, productIndex],
  );

  useEffect(() => {
    if (!acceptedProduct && inputValue.trim().length >= 2 && options.length > 0) {
      setOpen(true);
    }
  }, [acceptedProduct, inputValue, options.length]);

  const optionLabel = (product: ProductSearchResult) => (
    formatOptionLabel
      ? formatOptionLabel(product)
      : `${product.sku ? `[${product.sku}] ` : ""}${product.name}`
  );

  const filterValue = (product: ProductSearchResult) => product.sku || product.name;

  const acceptSuggestion = (product: ProductSearchResult) => {
    setAcceptedProduct(product);
    setHighlightedProduct(product);
    setInputValue(optionLabel(product));
    setOpen(false);
    setStatusMessage("Suggestion accepted. Press Enter or Add Product to confirm.");
    onFilterChange(filterValue(product));
  };

  const clearSelection = () => {
    setAcceptedProduct(null);
    setHighlightedProduct(null);
    setInputValue("");
    setStatusMessage(null);
    setOpen(false);
    onFilterChange("");
  };

  const confirmSelection = () => {
    if (!acceptedProduct) return;
    const existingLineIndex = findExistingProductLine(lines, acceptedProduct);
    if (existingLineIndex !== null) {
      onExisting(existingLineIndex, acceptedProduct);
      setStatusMessage(`Already on this PO. Existing row ${existingLineIndex + 1} is highlighted.`);
      onFilterChange(filterValue(acceptedProduct));
      return;
    }
    onAdd(acceptedProduct);
    clearSelection();
  };

  const handleKeyDown = (event: MuiKeyboardEvent) => {
    if (event.key === "Tab" && !acceptedProduct) {
      const productToAccept = highlightedProduct || options.find((product) => !isOptionDisabled?.(product));
      if (productToAccept) {
        event.preventDefault();
        event.defaultMuiPrevented = true;
        acceptSuggestion(productToAccept);
        return;
      }
    }

    if (event.key === "Enter" && acceptedProduct) {
      event.preventDefault();
      event.defaultMuiPrevented = true;
      confirmSelection();
      return;
    }

    if (event.key === "Enter" && !acceptedProduct) {
      const productToAccept = highlightedProduct || options.find((product) => !isOptionDisabled?.(product));
      if (productToAccept) {
        event.preventDefault();
        event.defaultMuiPrevented = true;
        acceptSuggestion(productToAccept);
      }
    }
  };

  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
        <Autocomplete
          fullWidth
          size="medium"
          autoHighlight
          open={open && options.length > 0}
          onOpen={() => setOpen(options.length > 0)}
          onClose={() => setOpen(false)}
          options={options}
          filterOptions={(availableOptions) => availableOptions}
          loading={loading}
          value={acceptedProduct}
          inputValue={inputValue}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          getOptionLabel={optionLabel}
          getOptionDisabled={isOptionDisabled}
          onHighlightChange={(_event, product) => setHighlightedProduct(product)}
          onChange={(_event, product, reason) => {
            if (reason === "clear" || !product) {
              clearSelection();
              return;
            }
            acceptSuggestion(product);
          }}
          onInputChange={(_event, newInputValue, reason) => {
            if (reason !== "input") return;
            setAcceptedProduct(null);
            setInputValue(newInputValue);
            setStatusMessage(null);
            setOpen(newInputValue.trim().length >= 2);
            onFilterChange(newInputValue);
          }}
          onKeyDown={handleKeyDown}
          renderOption={(props, product) => {
            const existingLineIndex = findExistingProductLine(lines, product);
            return (
              <Box component="li" {...props} key={product.id}>
                <Box>
                  <Typography variant="body2">{optionLabel(product)}</Typography>
                  {existingLineIndex !== null && (
                    <Typography variant="caption" color="warning.main">
                      Already on this PO — row {existingLineIndex + 1}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search SKU or Product Name"
              error={Boolean(loadError)}
              helperText={loadError || statusMessage || "Type to filter PO rows. Tab accepts a suggestion; Enter confirms it."}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
        <Button
          variant="contained"
          onClick={confirmSelection}
          disabled={!acceptedProduct}
          sx={{ minWidth: 130, mt: { sm: 1 } }}
        >
          Add Product
        </Button>
      </Stack>
      {!loading && !loadError && (
        <Typography variant="caption" color="text.secondary">
          {productIndex.length.toLocaleString()} products and variations indexed for this session.
        </Typography>
      )}
    </Stack>
  );
}
