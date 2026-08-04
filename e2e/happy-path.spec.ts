import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { loginAsTestUser } from "./lib/login";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const SITES_URL = process.env.E2E_SITES_URL ?? "http://localhost:3001";

test.skip(!TEST_EMAIL, "E2E_TEST_EMAIL not set — see e2e/README.md");

function buildLeadCsv(businessName: string): Buffer {
  const header = "business_name,category,owner_name,phone,city,area,lead_source";
  const row = [businessName, "Dental Clinic", "Test Owner", "9999900001", "Delhi", "Karol Bagh", "e2e"].join(",");
  return Buffer.from(`${header}\n${row}\n`, "utf-8");
}

async function goToLead(page: import("@playwright/test").Page, businessName: string) {
  await page.goto("/leads");
  await page.getByPlaceholder(/search/i).fill(businessName);
  await page.getByRole("link", { name: businessName }).first().click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);
}

/**
 * Full happy path per the Phase 15 spec: import a lead → generate a
 * website → deploy (publish) it → track a visit → convert the lead to a
 * permanent client. Each stage reads the previous stage's real output (the
 * imported lead's unique name, the generated site's id/slug) rather than
 * hard-coded fixture ids, so the test stays valid as seed data changes.
 * Requires live Claude + Supabase credentials — see e2e/README.md.
 */
test("import → generate → deploy → track → convert", async ({ page, request }) => {
  const businessName = `E2E Test Business ${randomUUID().slice(0, 8)}`;

  await test.step("login", async () => {
    await loginAsTestUser(page, TEST_EMAIL!);
  });

  await test.step("import a lead from CSV", async () => {
    await page.goto("/leads/import");
    await page.locator('input[type="file"]').setInputFiles({
      name: "one-lead.csv",
      mimeType: "text/csv",
      buffer: buildLeadCsv(businessName),
    });

    await expect(page.getByText(/rows · pick a target for each column/)).toBeVisible();
    // Fixture headers match IMPORT_FIELDS keys exactly, so suggestMapping
    // auto-maps business_name — Continue is enabled as soon as it's mapped.
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Import \d+ rows/ }).click();
    await expect(page.getByText(/Imported 1 lead/)).toBeVisible();
  });

  let siteId = "";
  let siteSlug = "";

  await test.step("generate a website for the imported lead", async () => {
    await goToLead(page, businessName);

    await page.getByRole("link", { name: "Generate website" }).click();
    await expect(page).toHaveURL(/\/generator\/new/);

    await page.getByRole("button", { name: /^Generate website$/ }).click();
    // AI generation is genuinely slow (Claude call) — give it real headroom.
    await expect(page).toHaveURL(/\/generator\/[0-9a-f-]+$/, { timeout: 100_000 });

    siteId = page.url().split("/generator/")[1]!.split(/[/?#]/)[0]!;
    expect(siteId).toMatch(/^[0-9a-f-]{36}$/);
  });

  await test.step("deploy (publish) the generated site", async () => {
    await page.getByRole("button", { name: /^(Publish|Republish)$/ }).click();
    const liveBanner = page.getByText(/^Live at /);
    await expect(liveBanner).toBeVisible({ timeout: 30_000 });

    const liveText = await liveBanner.textContent();
    siteSlug = liveText!.replace(/^Live at https?:\/\//, "").split(".")[0]!;
    expect(siteSlug.length).toBeGreaterThan(0);
  });

  await test.step("track a visit on the published site", async () => {
    const visitResponse = await request.post(`${SITES_URL}/api/track/visit`, {
      data: {
        siteId,
        path: "/",
        deviceType: "desktop",
        visitorKey: `e2e-${randomUUID()}`,
      },
    });
    expect(visitResponse.ok()).toBeTruthy();
  });

  await test.step("convert the lead to a permanent client", async () => {
    await goToLead(page, businessName);

    await page.getByRole("button", { name: "Convert demo to client" }).click();
    await expect(page.getByText("Converted to a permanent client project.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Converted to client")).toBeVisible();
  });
});
