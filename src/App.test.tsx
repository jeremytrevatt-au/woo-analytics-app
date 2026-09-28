import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders overview page heading", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect((await screen.findAllByText("Overview")).length).toBeGreaterThan(0);
  });
});
