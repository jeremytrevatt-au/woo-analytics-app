import { Box, Button, CardActions, Chip, Stack, Typography } from "@mui/material";
import { formatCurrency } from "../lib/format";

type Props = {
  subtotal: number;
  shipping: number;
  total: number;
  shippingMethod: string;
  currentStatus: string;
  isSaving: boolean;
  canChangePackingStatus: boolean;
  onDimensions: (event: React.MouseEvent) => void;
  onCrm: (event: React.MouseEvent) => void;
  onStatusChange: (status: "unpacked" | "packing" | "packed", event: React.MouseEvent) => void;
};

export default function PackingOrderFooter({
  subtotal,
  shipping,
  total,
  shippingMethod,
  currentStatus,
  isSaving,
  canChangePackingStatus,
  onDimensions,
  onCrm,
  onStatusChange,
}: Props) {
  return (
    <CardActions
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" },
        gap: 1.5,
        alignItems: "end",
        px: 2,
        py: 1.5,
      }}
    >
      <Stack spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`Subtotal: ${formatCurrency(subtotal)}`} variant="outlined" />
          <Chip size="small" label={`Shipping: ${formatCurrency(shipping)}`} variant="outlined" />
          <Chip size="small" label={`Total: ${formatCurrency(total)}`} variant="outlined" color="primary" />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Shipping method: <Box component="span" color="text.primary" fontWeight={700}>{shippingMethod || "Not recorded"}</Box>
        </Typography>
        <Button size="small" variant="outlined" onClick={onDimensions}>
          L W H
        </Button>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        justifyContent={{ xs: "flex-start", md: "flex-end" }}
        alignItems="center"
      >
        <Button size="small" variant="outlined" onClick={onCrm}>
          CRM
        </Button>
        {currentStatus === "unpacked" && (
          <>
            <Button size="small" variant="outlined" color="warning" onClick={(event) => onStatusChange("packing", event)} disabled={isSaving}>
              Pack
            </Button>
            <Button size="small" variant="contained" color="success" onClick={(event) => onStatusChange("packed", event)} disabled={isSaving}>
              Packed
            </Button>
          </>
        )}
        {currentStatus === "packing" && (
          <>
            <Button size="small" variant="outlined" color="inherit" onClick={(event) => onStatusChange("unpacked", event)} disabled={isSaving || !canChangePackingStatus}>
              Unpack
            </Button>
            <Button size="small" variant="contained" color="success" onClick={(event) => onStatusChange("packed", event)} disabled={isSaving || !canChangePackingStatus}>
              Packed
            </Button>
          </>
        )}
        {currentStatus === "packed" && (
          <>
            <Button size="small" variant="outlined" color="inherit" onClick={(event) => onStatusChange("unpacked", event)} disabled={isSaving}>
              Unpack
            </Button>
            <Button size="small" variant="outlined" color="warning" onClick={(event) => onStatusChange("packing", event)} disabled={isSaving}>
              Pack
            </Button>
          </>
        )}
      </Stack>
    </CardActions>
  );
}
