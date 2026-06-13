import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

describe("App", () => {
  it("renders overview page heading", async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(await screen.findByText("Overview")).toBeInTheDocument();
  });
});
