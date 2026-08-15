import { ArrowDownward, ArrowUpward } from "@mui/icons-material";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { KpiCardData } from "../types/analytics";

type Props = {
  cards: KpiCardData[];
};

function KpiGrid({ cards }: Props) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
        },
        gap: 2,
        width: "100%",
        minWidth: 0,
      }}
    >
      {cards.map((card) => (
        <Box key={card.id} sx={{ minWidth: 0 }}>
          <Card sx={{ height: "100%", width: "100%" }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {card.label}
              </Typography>
              <Typography variant="h5" mt={1} fontWeight={700}>
                {card.value}
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center" mt={1}>
                {card.positiveDelta ? (
                  <ArrowUpward color="success" fontSize="small" />
                ) : (
                  <ArrowDownward color="error" fontSize="small" />
                )}
                <Typography variant="body2" color={card.positiveDelta ? "success.main" : "error.main"}>
                  {card.delta}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      ))}
    </Box>
  );
}

export default KpiGrid;
