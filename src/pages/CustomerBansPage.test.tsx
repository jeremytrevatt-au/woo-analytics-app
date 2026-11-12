import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { customerBansApi } from "../api/customerBansApi";
import CustomerBansPage from "./CustomerBansPage";

describe("CustomerBansPage", () => {
  it("renders bans list and create form", async () => {
    vi.spyOn(customerBansApi, "list").mockResolvedValue({
      page: 1,
      page_size: 50,
      active: "yes",
      total_count: 1,
      bans: [
        {
          id: 9,
          is_active: true,
          name_pattern: "anliette chen",
          email_pattern: "amazinggrey@proton.me",
          phone_pattern: "61421374371",
          address_pattern: "1 arkle st prahran victoria 3181",
          match_mode: "any_field",
          notes: "PO test ban",
          linked_customer_ids: [2019],
          created_by: 0,
          updated_by: 0,
          created_at: "2026-11-12 03:00:00",
          updated_at: "2026-11-12 03:00:00",
          last_match_at: "2026-11-12 03:00:00",
          last_suspend_at: "2026-11-12 03:00:00",
        },
      ],
    });

    render(
      <MemoryRouter>
        <CustomerBansPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Customers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create ban" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/amazinggrey@proton.me/)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "2019" })).toHaveAttribute("href", "/customers/2019");
  });
});
