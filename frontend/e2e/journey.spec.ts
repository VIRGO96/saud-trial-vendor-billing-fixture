import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SAMPLES_DIR = path.resolve(__dirname, '../../samples');
const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/generated');

async function disableTransitions(page: any) {
  await page.addStyleTag({
    content: '*, *::before, *::after { -webkit-transition: none !important; -moz-transition: none !important; -o-transition: none !important; -ms-transition: none !important; transition: none !important; -webkit-animation: none !important; -moz-animation: none !important; -o-animation: none !important; -ms-animation: none !important; animation: none !important; }'
  });
}

test.describe('Vendor Billing Reconciliation - Clean Database User Journey', () => {

  test.beforeEach(async ({ page, baseURL }, testInfo) => {
    // Guard destructive execution: skip unless local or explicitly permitted
    const isLocal = baseURL && (baseURL.includes('localhost') || baseURL.includes('127.0.0.1'));
    if (!isLocal && process.env.E2E_ALLOW_DESTRUCTIVE !== '1') {
      testInfo.skip(true, 'Skipping destructive clean-slate journey test against non-local URL without E2E_ALLOW_DESTRUCTIVE=1');
      return;
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      const injectStyle = () => {
        const style = document.createElement('style');
        style.id = 'playwright-disable-animations';
        style.textContent = '*, *::before, *::after { -webkit-transition: none !important; -moz-transition: none !important; -o-transition: none !important; -ms-transition: none !important; transition: none !important; -webkit-animation: none !important; -moz-animation: none !important; -o-animation: none !important; -ms-animation: none !important; animation: none !important; }';
        document.head?.appendChild(style);
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyle);
      } else {
        injectStyle();
      }
    });
  });

  test('Complete user journey from clean slate to multi-vendor period reconciliation', async ({ page, request }) => {
    // 1. Ensure empty database by deleting all existing invoices & vendors via API
    const vendorsRes = await request.get('/api/vendors');
    if (vendorsRes.ok()) {
      const vendors = await vendorsRes.json();
      for (const v of vendors) {
        if (v.invoices && Array.isArray(v.invoices)) {
          for (const inv of v.invoices) {
            await request.delete(`/api/invoices/${inv.id}`);
          }
        }
        await request.delete(`/api/vendors/${v.id}`);
      }
    }

    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
        consoleErrors.push(msg.text());
      }
    });

    try {
      // 2. Navigate to Dashboard -> Assert clean empty state
      await page.goto('/');
      await disableTransitions(page);

      await expect(page.locator('h1')).toContainText('Vendors & Spend Overview');
      await expect(page.locator('text=No invoices uploaded yet')).toBeVisible();

      // 3. Ingest Sherweb 2026-07 CSV
      await page.click('button:has-text("Upload First Invoice")');
      await expect(page.locator('h2:has-text("Upload Vendor Invoice")')).toBeVisible();
      await disableTransitions(page);

      const fileChooserPromise1 = page.waitForEvent('filechooser');
      await page.click('text=Click to browse or drag and drop invoice file');
      const fileChooser1 = await fileChooserPromise1;
      await fileChooser1.setFiles(path.join(SAMPLES_DIR, 'vendor-sherweb-2026-07.csv'));

      // Assert parsed preview
      await expect(page.locator('text=Parsed Summary')).toBeVisible();
      await expect(page.locator('text=245 rows')).toBeVisible();
      await expect(page.locator('text=$20,362.51')).toBeVisible();

      // Confirm upload
      await page.click('button:has-text("Upload & Confirm")');
      await expect(page.locator('h2:has-text("Upload Vendor Invoice")')).not.toBeVisible();

      // Verify 1 period tracked on dashboard
      await expect(page.locator('h3:has-text("Sherweb")')).toBeVisible();
      await expect(page.locator('text=1 period tracked')).toBeVisible();

      // 4. Ingest Sherweb 2026-08 CSV
      await page.locator('button:has-text("Upload Invoice")').first().click();
      await expect(page.locator('h2:has-text("Upload Vendor Invoice")')).toBeVisible();
      await disableTransitions(page);

      const fileChooserPromise2 = page.waitForEvent('filechooser');
      await page.click('text=Click to browse or drag and drop invoice file');
      const fileChooser2 = await fileChooserPromise2;
      await fileChooser2.setFiles(path.join(SAMPLES_DIR, 'vendor-sherweb-2026-08.csv'));

      // Assert parsed preview
      await expect(page.locator('text=Parsed Summary')).toBeVisible();
      await expect(page.locator('text=245 rows')).toBeVisible();
      await expect(page.locator('text=$20,982.97')).toBeVisible();

      // Confirm upload
      await page.click('button:has-text("Upload & Confirm")');
      await expect(page.locator('h2:has-text("Upload Vendor Invoice")')).not.toBeVisible();

      // 5. Open Sherweb Compare Diff
      const sherwebCard = page.locator('div.rounded-xl', { has: page.locator('h3:has-text("Sherweb")') });
      await expect(sherwebCard.locator('text=2 periods tracked')).toBeVisible();
      await sherwebCard.locator('a:has-text("Compare Diff")').click();
      await page.waitForURL(/\/vendors\/.+\/compare/);
      await disableTransitions(page);

      // Assert Header & Reconciliation badge
      await expect(page.locator('h1')).toContainText('Period Reconciliation: Sherweb');
      await expect(page.locator('text=100% Reconciled to the Cent')).toBeVisible();
      await expect(page.locator('text=+$620.46').first()).toBeVisible();

      // Assert Exact KPI Counts (2 / 2 / 1 / 1)
      const priceKpi = page.locator('div.rounded-xl', { has: page.locator('span:has-text("Price Changes")') });
      await expect(priceKpi.locator('div.font-mono')).toHaveText('2');

      const qtyKpi = page.locator('div.rounded-xl', { has: page.locator('span:has-text("Quantity Changes")') });
      await expect(qtyKpi.locator('div.font-mono')).toHaveText('2');

      const newKpi = page.locator('div.rounded-xl', { has: page.locator('span:has-text("New Subscriptions")') });
      await expect(newKpi.locator('div.font-mono')).toHaveText('1');

      const removedKpi = page.locator('div.rounded-xl', { has: page.locator('span:has-text("Removed Subscriptions")') });
      await expect(removedKpi.locator('div.font-mono')).toHaveText('1');

      // Assert All Six Changes with exact values
      const tableBody = page.locator('table tbody');

      // 1. Bayview Clinic
      const bayviewRow = tableBody.locator('tr:has-text("Bayview Clinic")').first();
      await expect(bayviewRow).toBeVisible();
      await expect(bayviewRow).toContainText('QUANTITY');
      await expect(bayviewRow).toContainText('12 → 5');
      await expect(bayviewRow).toContainText('-$100.80');
      // Drilldown assertion
      await bayviewRow.click();
      await expect(page.locator('text=Net quantity after proration adjustments: 13 -> 6 (headline: 12 -> 5)').first()).toBeVisible();
      await bayviewRow.click(); // collapse

      // 2. Harbor 360
      const harborRow = tableBody.locator('tr:has-text("Harbor 360")').first();
      await expect(harborRow).toBeVisible();
      await expect(harborRow).toContainText('PRICE');
      await expect(harborRow).toContainText('+$6.12');

      // 3. Meridian Live
      const meridianRow = tableBody.locator('tr:has-text("Meridian Live")').first();
      await expect(meridianRow).toBeVisible();
      await expect(meridianRow).toContainText('PRICE');
      await expect(meridianRow).toContainText('+$136.45');

      // 4. Rosewood Pictures
      const rosewoodRow = tableBody.locator('tr:has-text("Rosewood Pictures")').first();
      await expect(rosewoodRow).toBeVisible();
      await expect(rosewoodRow).toContainText('REMOVED');
      await expect(rosewoodRow).toContainText('-$15.74');

      // 5. Saltbox Kitchen
      const saltboxRow = tableBody.locator('tr:has-text("Saltbox Kitchen")').first();
      await expect(saltboxRow).toBeVisible();
      await expect(saltboxRow).toContainText('NEW');
      await expect(saltboxRow).toContainText('+$859.62');

      // 6. Tandem Staffing
      const tandemRow = tableBody.locator('tr:has-text("Tandem Staffing")').first();
      await expect(tandemRow).toBeVisible();
      await expect(tandemRow).toContainText('QUANTITY');
      await expect(tandemRow).toContainText('-$265.19');

      // 6. Upload PowerDMARC 2026-08 PDF
      await page.goto('/');
      await disableTransitions(page);
      await page.locator('button:has-text("Upload Invoice")').first().click();
      await disableTransitions(page);

      const fileChooserPromisePdf1 = page.waitForEvent('filechooser');
      await page.click('text=Click to browse or drag and drop invoice file');
      const fileChooserPdf1 = await fileChooserPromisePdf1;
      await fileChooserPdf1.setFiles(path.join(SAMPLES_DIR, 'vendor-powerdmarc-2026-08.pdf'));

      await expect(page.locator('text=Parsed Summary')).toBeVisible();
      await expect(page.locator('text=$1,297.00').first()).toBeVisible();
      await page.click('button:has-text("Upload & Confirm")');
      await expect(page.locator('h2:has-text("Upload Vendor Invoice")')).not.toBeVisible();

      // 7. Upload PowerDMARC 2026-09 Synthetic PDF
      await page.locator('button:has-text("Upload Invoice")').first().click();
      await disableTransitions(page);

      const fileChooserPromisePdf2 = page.waitForEvent('filechooser');
      await page.click('text=Click to browse or drag and drop invoice file');
      const fileChooserPdf2 = await fileChooserPromisePdf2;
      await fileChooserPdf2.setFiles(path.join(FIXTURES_DIR, 'powerdmarc-2026-09-SYNTHETIC.pdf'));

      await expect(page.locator('text=Parsed Summary')).toBeVisible();
      await expect(page.locator('text=$1,445.00').first()).toBeVisible();
      await page.click('button:has-text("Upload & Confirm")');
      await expect(page.locator('h2:has-text("Upload Vendor Invoice")')).not.toBeVisible();

      // 8. Open PowerDMARC Compare Diff
      const pdCard = page.locator('div.rounded-xl', { has: page.locator('h3:has-text("PowerDMARC")') });
      await expect(pdCard.locator('text=2 periods tracked')).toBeVisible();
      await pdCard.locator('a:has-text("Compare Diff")').click();
      await page.waitForURL(/\/vendors\/.+\/compare/);
      await disableTransitions(page);

      // Assert Test fixture badge with exact text
      await expect(page.getByText('Test fixture', { exact: true }).first()).toBeVisible();

      // Assert Net Delta: +$148.00 and 100% Reconciled
      await expect(page.locator('text=+$148.00').first()).toBeVisible();
      await expect(page.locator('text=100% Reconciled to the Cent')).toBeVisible();

      // Locate Description column dynamically by header index
      const tableHeaders = await page.locator('table thead th').allTextContents();
      const descColIndex = tableHeaders.findIndex(h => h.trim().toLowerCase() === 'description') + 1;
      expect(descColIndex).toBeGreaterThan(0);

      // Assert Partner Plan exact text and price change
      const pdTable = page.locator('table tbody');
      const partnerPlanRow = pdTable.locator('tr:has-text("PowerDMARC MSP Partner Plan")').first();
      await expect(partnerPlanRow).toBeVisible();
      await expect(partnerPlanRow).toContainText('PRICE');
      await expect(partnerPlanRow).toContainText('+$50.00');

      const partnerDescCell = partnerPlanRow.locator(`td:nth-child(${descColIndex})`);
      await expect(partnerDescCell).toHaveText('PowerDMARC MSP Partner Plan — Monthly 13 Sep 2026 – 12 Oct 2026 · 50 domains included');

      // Expand Partner Plan row and assert tier note change (40 -> 50 domains) is visible in drill-down
      await partnerPlanRow.click();
      await expect(page.locator('text=Plan tier updated: 40 domains included -> 50 domains included').first()).toBeVisible();
      await partnerPlanRow.click(); // collapse

      // Assert Additional Domains Pack new (+$98.00) and exact description
      const addDomainsRow = pdTable.locator('tr:has-text("Additional Domains")').first();
      await expect(addDomainsRow).toBeVisible();
      await expect(addDomainsRow).toContainText('NEW');
      await expect(addDomainsRow).toContainText('+$98.00');

      const addDomainsDescCell = addDomainsRow.locator(`td:nth-child(${descColIndex})`);
      await expect(addDomainsDescCell).toHaveText('PowerDMARC Additional Domains Pack 13 Sep 2026 – 12 Oct 2026 · 10 extra domains');

      // Assert that NO description cell in the table matches /^\s*\d+[\s.:-]/
      const descriptions = await page.locator(`table tbody tr td:nth-child(${descColIndex})`).allTextContents();
      expect(descriptions.length).toBeGreaterThanOrEqual(2);
      for (const desc of descriptions) {
        expect(desc).not.toMatch(/^\s*\d+[\s.:-]/);
      }

      expect(consoleErrors).toEqual([]);
    } finally {
      // Always re-seed demo data in finally block
      try {
        await request.post('/api/vendors/seed');
      } catch {
        // Ignore
      }
    }
  });

});
