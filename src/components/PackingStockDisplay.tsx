import { Box, Typography } from "@mui/material";

type Props = {
  reportedStockQty: number | string | null | undefined;
  adjustedStockQty: number | string | null | undefined;
  backgroundColor: string;
  color: string;
  onOpen: (anchorEl: HTMLElement, event: React.MouseEvent<HTMLElement>) => void;
};

export default function PackingStockDisplay({
  reportedStockQty,
  adjustedStockQty,
  backgroundColor,
  color,
  onOpen,
}: Props) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={`Stock / Adj: ${reportedStockQty ?? "-"} / ${adjustedStockQty ?? "-"}`}
      onClick={(event) => onOpen(event.currentTarget, event)}
      sx={{
        width: 120,
        height: 48,
        m: 0,
        px: 1,
        py: 0.5,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: backgroundColor,
        color,
        cursor: "pointer",
        font: "inherit",
        textAlign: "left",
        fontVariantNumeric: "tabular-nums",
        gridColumn: { xs: "1 / -1", sm: "2" },
        justifySelf: "start",
      }}
    >
      <Typography component="span" variant="caption" fontWeight={700} lineHeight={1.1}>
        Stock / Adj
      </Typography>
      <Typography component="span" variant="body2" lineHeight={1.25}>
        {reportedStockQty ?? "-"} / {adjustedStockQty ?? "-"}
      </Typography>
    </Box>
  );
}
