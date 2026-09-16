import { useEffect, useMemo, useState } from "react";
import { Autocomplete, Box, Button, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import type { ProductSearchResult } from "../api/productsApi";
import { searchProductIndex } from "../lib/purchaseOrderProductSearch";
import { useProductIndex } from "./ProductIndexProvider";

type Props = {
  initialQuery?: string;
  onLocalQueryChange: (query: string) => void;
  onConfirm: (query: string) => void;
  onClear: () => void;
};

type MuiKeyboardEvent = React.KeyboardEvent<HTMLDivElement> & {
  defaultMuiPrevented?: boolean;
};

function productLabel(product: ProductSearchResult): string {
  return `${product.sku ? `[${product.sku}] ` : ""}${product.name}`;
}

export default function StockProductSearch({
  initialQuery = "",
  onLocalQueryChange,
  onConfirm,
  onClear,
}: Props) {
  const { products, loading, error } = useProductIndex();
  const [inputValue, setInputValue] = useState(initialQuery);
  const [acceptedProduct, setAcceptedProduct] = useState<ProductSearchResult | null>(null);
  const [highlightedProduct, setHighlightedProduct] = useState<ProductSearchResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () => searchProductIndex(products, inputValue),
    [inputValue, products],
  );

  useEffect(() => {
    if (!acceptedProduct && inputValue.trim().length >= 2 && options.length > 0) {
      setOpen(true);
    }
  }, [acceptedProduct, inputValue, options.length]);

  const localFilterValue = (product: ProductSearchResult): string => product.sku || product.name;

  const acceptSuggestion = (product: ProductSearchResult) => {
    setAcceptedProduct(product);
    setHighlightedProduct(product);
    setInputValue(productLabel(product));
    setOpen(false);
    setStatusMessage("Suggestion accepted. Press Enter or Search All Stock to confirm.");
    onLocalQueryChange(localFilterValue(product));
  };

  const clearSearch = () => {
    setInputValue("");
    setAcceptedProduct(null);
    setHighlightedProduct(null);
    setStatusMessage(null);
    setOpen(false);
    onLocalQueryChange("");
    onClear();
  };

  const confirmSelection = () => {
    const query = acceptedProduct ? localFilterValue(acceptedProduct) : inputValue.trim();
    if (!query) return;
    onConfirm(query);
    setStatusMessage(`Searching all stock records for ${query}.`);
  };

  const handleKeyDown = (event: MuiKeyboardEvent) => {
    const productToAccept = highlightedProduct || options[0] || null;

    if (event.key === "Tab" && !acceptedProduct && productToAccept) {
      event.preventDefault();
      event.defaultMuiPrevented = true;
      acceptSuggestion(productToAccept);
      return;
    }

    if (event.key === "Enter" && inputValue.trim()) {
      event.preventDefault();
      event.defaultMuiPrevented = true;
      confirmSelection();
      return;
    }
  };

  return (
    <Stack spacing={0.75}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
        <Autocomplete
          fullWidth
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
          getOptionLabel={productLabel}
          onHighlightChange={(_event, product) => setHighlightedProduct(product)}
          onChange={(_event, product, reason) => {
            if (reason === "clear" || !product) {
              clearSearch();
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
            onLocalQueryChange(newInputValue);
          }}
          onKeyDown={handleKeyDown}
          renderOption={(props, product) => (
            <Box component="li" {...props} key={product.id}>
              <Typography variant="body2">{productLabel(product)}</Typography>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search SKU or Product Name"
              error={Boolean(error)}
              helperText={error || statusMessage || "Enter searches the partial term. Tab accepts a suggestion, then Enter searches that exact item."}
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
          disabled={!inputValue.trim()}
          sx={{ minWidth: 160, mt: { sm: 1 } }}
        >
          Search All Stock
        </Button>
      </Stack>
      {!loading && !error && (
        <Typography variant="caption" color="text.secondary">
          {products.length.toLocaleString()} products and variations available in the global index.
        </Typography>
      )}
    </Stack>
  );
}
