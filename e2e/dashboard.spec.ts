import { expect, test } from "@playwright/test";

test("loads dashboard and navigates sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Natural Yield Analytics")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.getByRole("button", { name: "Orders" }).click();
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();

  await page.getByRole("button", { name: "Forecast" }).click();
  await expect(page.getByRole("heading", { name: "Forecast" })).toBeVisible();
});
