export type CustomerAddressFields = {
  first_name?: string | null;
  last_name?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
  phone?: string | null;
};

export type CustomerProfileContact = {
  user_email?: string | null;
  billing_email?: string | null;
  billing_phone?: string | null;
  shipping_phone?: string | null;
  billing_first_name?: string | null;
  billing_last_name?: string | null;
  billing_address_1?: string | null;
  billing_address_2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_postcode?: string | null;
  billing_country?: string | null;
  shipping_first_name?: string | null;
  shipping_last_name?: string | null;
  shipping_address_1?: string | null;
  shipping_address_2?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_postcode?: string | null;
  shipping_country?: string | null;
};

function text(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export function customerFullName(firstName?: string | null, lastName?: string | null): string {
  return [text(firstName), text(lastName)].filter(Boolean).join(" ");
}

export function formatCustomerAddressLines(address: CustomerAddressFields): string[] {
  const lines: string[] = [];
  const name = customerFullName(address.first_name, address.last_name);
  if (name) lines.push(name);
  const street1 = text(address.address_1);
  if (street1) lines.push(street1);
  const street2 = text(address.address_2);
  if (street2) lines.push(street2);
  const locality = [text(address.city), text(address.state), text(address.postcode)]
    .filter(Boolean)
    .join(" ");
  if (locality) lines.push(locality);
  const country = text(address.country);
  if (country) lines.push(country);
  return lines;
}

export function customerAddressHasContent(address: CustomerAddressFields): boolean {
  return Boolean(
    text(address.address_1)
      || text(address.address_2)
      || text(address.city)
      || text(address.postcode)
      || text(address.first_name)
      || text(address.last_name),
  );
}

export function billingAddressFromProfile(profile: CustomerProfileContact): CustomerAddressFields {
  return {
    first_name: profile.billing_first_name,
    last_name: profile.billing_last_name,
    address_1: profile.billing_address_1,
    address_2: profile.billing_address_2,
    city: profile.billing_city,
    state: profile.billing_state,
    postcode: profile.billing_postcode,
    country: profile.billing_country,
    phone: profile.billing_phone,
  };
}

export function shippingAddressFromProfile(profile: CustomerProfileContact): CustomerAddressFields {
  return {
    first_name: profile.shipping_first_name,
    last_name: profile.shipping_last_name,
    address_1: profile.shipping_address_1,
    address_2: profile.shipping_address_2,
    city: profile.shipping_city,
    state: profile.shipping_state,
    postcode: profile.shipping_postcode,
    country: profile.shipping_country,
    phone: profile.shipping_phone,
  };
}

export type ContactDisplayLine = {
  label: string;
  value: string;
};

export function customerContactLines(profile: CustomerProfileContact): ContactDisplayLine[] {
  const lines: ContactDisplayLine[] = [];
  const userEmail = text(profile.user_email);
  const billingEmail = text(profile.billing_email);
  if (userEmail) {
    lines.push({ label: "User email", value: userEmail });
  }
  if (billingEmail) {
    lines.push({ label: "Billing email", value: billingEmail });
  }

  const billingPhone = text(profile.billing_phone);
  const shippingPhone = text(profile.shipping_phone);
  if (billingPhone) {
    lines.push({ label: "Billing phone", value: billingPhone });
  }
  if (shippingPhone && shippingPhone !== billingPhone) {
    lines.push({ label: "Shipping phone", value: shippingPhone });
  }
  return lines;
}
