import DeleteIcon from "@mui/icons-material/Delete";
import { Box, Button, IconButton, Stack, TextField, Typography } from "@mui/material";
import { createBlankParcel, type ParcelDraft } from "../lib/packingParcels";

type Props = {
  parcels: ParcelDraft[];
  onChange: (parcels: ParcelDraft[]) => void;
  disabled?: boolean;
};

export default function PackingParcelList({ parcels, onChange, disabled }: Props) {
  const updateParcel = (id: string, field: keyof Omit<ParcelDraft, "id">, value: string) => {
    onChange(parcels.map(parcel => parcel.id === id ? { ...parcel, [field]: value } : parcel));
  };

  const addParcel = () => {
    onChange([...parcels, createBlankParcel()]);
  };

  const removeParcel = (id: string) => {
    if (parcels.length <= 1) return;
    onChange(parcels.filter(parcel => parcel.id !== id));
  };

  return (
    <>
      {parcels.map((parcel, index) => (
        <Box key={parcel.id} sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">Parcel {index + 1}</Typography>
            <IconButton
              aria-label="Remove parcel"
              onClick={() => removeParcel(parcel.id)}
              disabled={disabled || parcels.length === 1}
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Qty"
              type="number"
              value={parcel.qty}
              onChange={event => updateParcel(parcel.id, "qty", event.target.value)}
              inputProps={{ min: 1, step: 1 }}
              disabled={disabled}
            />
            <TextField
              label="Weight g"
              type="number"
              value={parcel.weightGrams}
              onChange={event => updateParcel(parcel.id, "weightGrams", event.target.value)}
              inputProps={{ min: 0, step: 1 }}
              disabled={disabled}
            />
            <TextField
              label="Length cm"
              type="number"
              value={parcel.lengthCm}
              onChange={event => updateParcel(parcel.id, "lengthCm", event.target.value)}
              inputProps={{ min: 0, step: 0.1 }}
              disabled={disabled}
            />
            <TextField
              label="Width cm"
              type="number"
              value={parcel.widthCm}
              onChange={event => updateParcel(parcel.id, "widthCm", event.target.value)}
              inputProps={{ min: 0, step: 0.1 }}
              disabled={disabled}
            />
            <TextField
              label="Height cm"
              type="number"
              value={parcel.heightCm}
              onChange={event => updateParcel(parcel.id, "heightCm", event.target.value)}
              inputProps={{ min: 0, step: 0.1 }}
              disabled={disabled}
            />
          </Stack>
        </Box>
      ))}

      <Button variant="outlined" onClick={addParcel} disabled={disabled}>
        Add Parcel
      </Button>
    </>
  );
}
