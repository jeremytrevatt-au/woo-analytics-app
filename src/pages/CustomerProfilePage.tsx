import { Alert, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";
import CustomerCrmPanel from "../components/CustomerCrmPanel";

export default function CustomerProfilePage() {
  const { customerId: rawCustomerId } = useParams();
  const customerId = Number(rawCustomerId);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return <Alert severity="error">The CRM customer reference is invalid.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        gap={1}
      >
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700}>CRM customer profile</Typography>
          <Typography variant="body2" color="text.secondary">
            WooCommerce customer #{customerId}
          </Typography>
        </Stack>
        <Button component={RouterLink} to="/customers" variant="outlined">
          Back to customers
        </Button>
      </Stack>
      <CustomerCrmPanel customer_id={customerId} defaultTriggerEvent="manual" />
    </Stack>
  );
}
