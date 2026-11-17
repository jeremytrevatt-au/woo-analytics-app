import { Stack, Typography } from "@mui/material";
import {
  billingAddressFromProfile,
  customerAddressHasContent,
  customerContactLines,
  CustomerProfileContact,
  formatCustomerAddressLines,
  shippingAddressFromProfile,
} from "../lib/customerContactDisplay";

type Props = {
  profile: CustomerProfileContact;
};

function AddressBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 180, flex: 1 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700}>
        {title}
      </Typography>
      {lines.map((line) => (
        <Typography key={`${title}:${line}`} variant="body2">
          {line}
        </Typography>
      ))}
    </Stack>
  );
}

export default function CustomerProfileContactBlocks({ profile }: Props) {
  const contactLines = customerContactLines(profile);
  const billing = billingAddressFromProfile(profile);
  const shipping = shippingAddressFromProfile(profile);
  const showBilling = customerAddressHasContent(billing);
  const showShipping = customerAddressHasContent(shipping);

  return (
    <Stack spacing={1.25}>
      {contactLines.length ? (
        <Stack spacing={0.25}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            Contact
          </Typography>
          {contactLines.map((line) => (
            <Typography key={`${line.label}:${line.value}`} variant="body2">
              {line.label}: {line.value}
            </Typography>
          ))}
        </Stack>
      ) : null}

      {showBilling || showShipping ? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          {showBilling ? (
            <AddressBlock title="Billing" lines={formatCustomerAddressLines(billing)} />
          ) : null}
          {showShipping ? (
            <AddressBlock title="Shipping" lines={formatCustomerAddressLines(shipping)} />
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
