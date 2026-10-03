import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./api/journeyApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/journeyApi")>();
  return {
    ...actual,
    listJourneys: vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      per_page: 25,
      total: 0,
    }),
  };
});

describe("App", () => {
  it("renders overview page heading", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect((await screen.findAllByText("Overview")).length).toBeGreaterThan(0);
  });

  it("routes to Visitor Journeys and exposes its navigation item", async () => {
    const app = render(
      <MemoryRouter initialEntries={["/journeys"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Visitor Journeys" }))
      .toBeInTheDocument();
    fireEvent.click(app.getByRole("button", { name: "open drawer" }));
    expect(screen.getByRole("link", { name: "Visitor Journeys" }))
      .toHaveAttribute("href", "/journeys");
  });
});
