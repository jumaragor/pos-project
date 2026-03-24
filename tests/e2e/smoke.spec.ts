import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("owner@microbiz.local");
  await page.getByPlaceholder("Password").fill("Owner123!");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("login and open dashboard", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("create sale smoke", async ({ page }) => {
  await login(page);
  await page.goto("/pos");
  await page.getByPlaceholder("Scan barcode or type SKU/name").fill("SAR-155");
  await page.getByRole("button", { name: /Sardines/i }).first().click();
  await page.getByRole("button", { name: "Complete Sale" }).click();
  await expect(page.getByText(/Receipt|Pending Sync/)).toBeVisible();
});

test("inventory adjustment smoke", async ({ page }) => {
  await login(page);
  await page.goto("/inventory");
  await page.getByRole("heading", { name: "Stock Adjustment" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Apply Adjustment" })).toBeVisible();
});
