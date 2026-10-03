import { CrmCustomerProfile } from "../api/crmApi";

export function crmCustomerDisplayName(
  profile: CrmCustomerProfile["profile"] | null | undefined,
  customerId: number,
): string {
  const splitName = [
    profile?.billing_first_name?.trim(),
    profile?.billing_last_name?.trim(),
  ].filter(Boolean).join(" ");

  return splitName
    || profile?.customer_name?.trim()
    || `Woo customer #${customerId}`;
}
