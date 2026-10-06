import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { registeredAccountsApi } from "../api/registeredAccountsApi";
import SecurityRegisteredAccountsPage from "./SecurityRegisteredAccountsPage";

vi.mock("../config/wordpress", () => ({
  wordpressAdminUrl: () => "https://naturalyield.com.au/wp-admin/user-edit.php?user_id=4",
}));

describe("SecurityRegisteredAccountsPage", () => {
  it("shows a zero-order account and its quality flags", async () => {
    vi.spyOn(registeredAccountsApi, "list").mockResolvedValue({
      page: 1,
      page_size: 50,
      quality: "all",
      total_count: 1,
      accounts: [{
        user_id: 4,
        user_login: "temp@example.com",
        email: "temp@example.com",
        display_name: "temp@example.com",
        registered_at: "2026-10-01 01:00:00",
        first_name: "",
        last_name: "",
        billing_address: { address_1: "", city: "", postcode: "", country: "AU" },
        shipping_address: { address_1: "", city: "", postcode: "", country: "" },
        is_missing_email: false,
        is_invalid_email: false,
        is_missing_first_name: true,
        is_missing_last_name: true,
        is_missing_billing_address: true,
        is_missing_shipping_address: true,
        is_email_used_as_name: true,
        is_suspicious_name: false,
        is_suspicious_email: false,
        is_flagged: true,
      }],
    });

    render(
      <MemoryRouter>
        <SecurityRegisteredAccountsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Security" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Registered accounts" })).toHaveAttribute("href", "/security/registered-accounts");
    expect(screen.getByText("temp@example.com")).toBeInTheDocument();
    expect(screen.getByText("Missing first name")).toBeInTheDocument();
    expect(screen.getByText("Name is the email")).toBeInTheDocument();
    expect(screen.getAllByText("No")).toHaveLength(2);
  });
});
