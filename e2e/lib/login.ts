import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { generateTestOtp } from "./supabase-admin";

/** Drives the real email+OTP login form using a server-generated test code. */
export async function loginAsTestUser(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();

  await expect(page.getByText("Enter your code")).toBeVisible();
  const otp = await generateTestOtp(email);

  const otpInput = page.locator('input[name="token"]');
  await otpInput.first().fill(otp);
  await page.getByRole("button", { name: "Verify & sign in" }).click();

  await expect(page).toHaveURL("/");
}
