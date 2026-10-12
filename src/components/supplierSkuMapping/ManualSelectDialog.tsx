import { useEffect, useMemo, useState } from "react";
import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";
import type { SkuMappingCandidate, SkuMappingPreviewRow } from "../../api/supplierSkuMappingApi";
import { wooStatusLabel } from "./statusDisplay";

type Props = {
  row: SkuMappingPreviewRow | null;
  /** Every simple product and variation. Variable parents are never offered. */
  candidates: SkuMappingCandidate[];
  onSelect: (rowId: number, candidate: SkuMappingCandidate) => void;
  onClose: () => void;
};

const optionLabel = (candidate: SkuMappingCandidate) =>
  `${candidate.sku || "(no SKU)"} - ${candidate.label} [#${candidate.id}, ${candidate.type}, ${wooStatusLabel(candidate.status)}]`;

export default function ManualSelectDialog({ row, candidates, onSelect, onClose }: Props) {
  const [value, setValue] = useState<SkuMappingCandidate | null>(null);

  useEffect(() => {
    setValue(null);
  }, [row?.row_id]);

  // Candidates the matcher already considered for this row come first.
  const options = useMemo(() => {
    if (!row) return candidates;
    const suggestedIds = new Set(row.candidates.map((candidate) => candidate.id));
    const suggested = candidates.filter((candidate) => suggestedIds.has(candidate.id));
    const rest = candidates.filter((candidate) => !suggestedIds.has(candidate.id));
    return [...suggested, ...rest];
  }, [candidates, row]);

  return (
    <Dialog open={Boolean(row)} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Select the Woo product</DialogTitle>
      <DialogContent>
        {row ? (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Sheet row {row.row_id}: <strong>{row.supplier_name}</strong> ({row.supplier_sku}). Only simple products and
              variations can be selected; variable parent products are not offered.
            </Typography>
            <Autocomplete
              options={options}
              value={value}
              onChange={(_event, next) => setValue(next)}
              getOptionLabel={optionLabel}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              filterOptions={(all, state) => {
                const needle = state.inputValue.trim().toLowerCase();
                const matches = needle ? all.filter((candidate) => optionLabel(candidate).toLowerCase().includes(needle)) : all;
                return matches.slice(0, 100);
              }}
              renderInput={(params) => <TextField {...params} label="Search by SKU, name or id" autoFocus />}
            />
            {value ? (
              <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
                Currently holds: {value.supplier_sku || value.supplier_price || value.supplier_id ? `supplier ${value.supplier_id ?? "-"} / ${value.supplier_sku || "no SKU"} / ${value.supplier_price ? `$${value.supplier_price}` : "no price"}` : "no supplier values"}
              </Typography>
            ) : null}
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!row || !value} onClick={() => row && value && onSelect(row.row_id, value)}>
          Use this product
        </Button>
      </DialogActions>
    </Dialog>
  );
}
