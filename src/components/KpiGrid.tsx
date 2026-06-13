import { ArrowDownward, ArrowUpward } from "@mui/icons-material";
import { Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { KpiCardData } from "../types/analytics";

type Props = {
  cards: KpiCardData[];
};

function KpiGrid({ cards }: Props) {
  return (
    <Grid container spacing={2}>
      {cards.map((card) => (
        <Grid item xs={12} md={3} key={card.id}>
          <Card>
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
        </Grid>
      ))}
    </Grid>
  );
}

export default KpiGrid;
