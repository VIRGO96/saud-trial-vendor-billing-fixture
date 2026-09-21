import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';

const SAMPLES_DIR = path.resolve(__dirname, '../../samples');
const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/generated');

async function disableTransitions(page: any) {
  await page.addStyleTag({
    content: '*, *::before, *::after { -webkit-transition: none !important; -moz-transition: none !important; -o-transition: none !important; -ms-transition: none !important; transition: none !important; -webkit-animation: none !important; -moz-animation: none !important; -o-animation: none !important; -ms-animation: none !important; animation: none !important; }'
  });
}

test.describe('Vendor Billing Reconciliation E2E Suite', () => {

  test.beforeAll(async ({ request }) => {
    try {
      await request.post('/api/vendors/seed');
    } catch {
      // Ignore if offline or seed endpoint guarded
    }
  });

  test.beforeEach(async ({ page, baseURL }, testInfo) => {
    // Guard destructive/mutation execution: skip unless local or explicitly permitted
    const isLocal = baseURL && (baseURL.includes('localhost') || baseURL.includes('127.0.0.1'));
    if (!isLocal && process.env.E2E_ALLOW_DESTRUCTIVE !== '1') {
      testInfo.skip(true, 'Skipping mutation/upload reconciliation tests against non-local deployment');
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

  test('01: Vendors Dashboard renders correctly and passes a11y in Light & Dark modes', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await disableTransitions(page);

    // Check main title & KPI strip
    await expect(page.locator('h1')).toContainText('Vendors & Spend Overview');
    await expect(page.locator('text=Tracked Vendors')).toBeVisible();
    await expect(page.locator('text=Total Ingested Invoices')).toBeVisible();
    await expect(page.locator('text=Latest Monitored Spend')).toBeVisible();
    await expect(page.locator('text=Reconciliation Engine')).toBeVisible();

    // Verify seeded vendors exist
    await expect(page.locator('h3', { hasText: 'Sherweb' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'PowerDMARC' })).toBeVisible();

    // A11y check in Light mode
    const lightA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(lightA11y.violations).toEqual([]);

    // Toggle Dark mode
    await page.getByRole('button', { name: 'Toggle color theme' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await disableTransitions(page);

    // A11y check in Dark mode
    const darkA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(darkA11y.violations).toEqual([]);

    // Toggle back to Light mode
    await page.getByRole('button', { name: 'Toggle color theme' }).click();
    await disableTransitions(page);

    expect(consoleErrors).toEqual([]);
  });

  test('02: Invoice Upload Modal workflow, preview, and a11y in Light & Dark modes', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await disableTransitions(page);
    
    // Open Upload Modal
    await page.locator('button:has-text("Upload Invoice")').first().click();
    await expect(page.locator('h2:has-text("Upload Vendor Invoice")')).toBeVisible();
    await disableTransitions(page);

    // A11y check on open modal in Light mode
    const modalA11yLight = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(modalA11yLight.violations).toEqual([]);

    // Close modal, toggle Dark mode, open modal in Dark mode
    await page.click('button:has-text("Cancel")');
    await page.getByRole('button', { name: 'Toggle color theme' }).click();
    await disableTransitions(page);
    await page.locator('button:has-text("Upload Invoice")').first().click();
    await disableTransitions(page);

    // Check modal a11y in Dark mode
    const modalA11yDark = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(modalA11yDark.violations).toEqual([]);

    // Upload July file for preview
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Click to browse or drag and drop invoice file');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(SAMPLES_DIR, 'vendor-sherweb-2026-07.csv'));

    // Assert parsed preview summary
    await expect(page.locator('text=Parsed Summary')).toBeVisible();
    await expect(page.locator('text=245 rows')).toBeVisible();
    await expect(page.locator('text=$20,362.51')).toBeVisible();

    // Close Modal
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('h2:has-text("Upload Vendor Invoice")')).not.toBeVisible();

    // Reset theme back to light
    await page.getByRole('button', { name: 'Toggle color theme' }).click();

    expect(consoleErrors).toEqual([]);
  });

  test('03: Error handling for wrong file type, corrupt PDF, and duplicate upload conflict with Replace flow', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      // Narrowed error filter: only filter expected HTTP error responses triggered by intentional test errors
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource') && !msg.text().includes('422') && !msg.text().includes('409') && !msg.text().includes('400')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await disableTransitions(page);
    
    // 1. Upload wrong file type (.txt created on the fly)
    await page.locator('button:has-text("Upload Invoice")').first().click();
    await disableTransitions(page);

    const tmpTxt = path.join(__dirname, 'test_invalid.txt');
    fs.writeFileSync(tmpTxt, 'Random text file not an invoice');
    try {
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.click('text=Click to browse or drag and drop invoice file');
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(tmpTxt);

      await expect(page.locator('text=Parsing Issue')).toBeVisible();
    } finally {
      if (fs.existsSync(tmpTxt)) fs.unlinkSync(tmpTxt);
    }

    // Reset file selection
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('h2:has-text("Upload Vendor Invoice")')).not.toBeVisible();

    // 2. Upload corrupt PDF
    await page.locator('button:has-text("Upload Invoice")').first().click();
    await disableTransitions(page);

    const tmpCorruptPdf = path.join(__dirname, 'test_corrupt.pdf');
    fs.writeFileSync(tmpCorruptPdf, '%PDF-1.4\ncorrupt header and unreadable binary garbage');
    try {
      const fileChooserPromisePdf = page.waitForEvent('filechooser');
      await page.click('text=Click to browse or drag and drop invoice file');
      const fileChooserPdf = await fileChooserPromisePdf;
      await fileChooserPdf.setFiles(tmpCorruptPdf);

      await expect(page.locator('text=Parsing Issue')).toBeVisible();
    } finally {
      if (fs.existsSync(tmpCorruptPdf)) fs.unlinkSync(tmpCorruptPdf);
    }

    // Reset file selection
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('h2:has-text("Upload Vendor Invoice")')).not.toBeVisible();

    // 3. Duplicate Upload & Replace Flow
    await page.locator('button:has-text("Upload Invoice")').first().click();
    await disableTransitions(page);

    const fileChooserPromise2 = page.waitForEvent('filechooser');
    await page.click('text=Click to browse or drag and drop invoice file');
    const fileChooser2 = await fileChooserPromise2;
    await fileChooser2.setFiles(path.join(SAMPLES_DIR, 'vendor-sherweb-2026-07.csv'));

    await expect(page.locator('text=Parsed Summary')).toBeVisible();
    await page.click('button:has-text("Upload & Confirm")');

    // Expect 409 conflict dialog with Replace option (since July was seeded/uploaded)
    await expect(page.locator('text=Invoice Already Exists')).toBeVisible();
    await expect(page.locator('button:has-text("Replace Existing Invoice")')).toBeVisible();

    // Click Replace
    await page.click('button:has-text("Replace Existing Invoice")');
    await expect(page.locator('h2:has-text("Upload Vendor Invoice")')).not.toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('04: Period-over-period reconciliation comparison (Sherweb July vs Aug 2026)', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await disableTransitions(page);

    const sherwebCard = page.locator('div.rounded-xl', { has: page.locator('h3:has-text("Sherweb")') });
    await sherwebCard.locator('a:has-text("Compare Diff")').click();
    await page.waitForURL(/\/vendors\/.+\/compare/);
    await disableTransitions(page);

    // Verify Comparison Header
    await expect(page.locator('h1')).toContainText('Period Reconciliation: Sherweb');

    // Verify 5 KPI cards and unchanged count
    await expect(page.locator('text=Net Spend Delta')).toBeVisible();
    await expect(page.locator('text=+$620.46').first()).toBeVisible();
    await expect(page.locator('text=100% Reconciled to the Cent')).toBeVisible();
    await expect(page.locator('text=163 subscriptions unchanged')).toBeVisible();
    await expect(page.locator('text=Price Changes')).toBeVisible();
    await expect(page.locator('text=Quantity Changes')).toBeVisible();
    await expect(page.locator('text=New Subscriptions')).toBeVisible();
    await expect(page.locator('text=Removed Subscriptions')).toBeVisible();

    // Verify line item changes table
    const tableBody = page.locator('table tbody');
    await expect(tableBody.locator('text=Bayview Clinic').first()).toBeVisible();
    await expect(tableBody.locator('text=Harbor 360').first()).toBeVisible();
    await expect(tableBody.locator('text=Meridian Live').first()).toBeVisible();
    await expect(tableBody.locator('text=Rosewood Pictures').first()).toBeVisible();
    await expect(tableBody.locator('text=Saltbox Kitchen').first()).toBeVisible();
    await expect(tableBody.locator('text=Tandem Staffing').first()).toBeVisible();

    // Assert Bayview Clinic headline quantity 12 -> 5
    const bayviewRow = tableBody.locator('tr:has-text("Bayview Clinic")').first();
    await expect(bayviewRow).toContainText('12 → 5');
    await expect(bayviewRow).toContainText('-$100.80');
    await expect(bayviewRow.locator('td[title="Bayview Clinic"]')).toBeVisible();
    await expect(bayviewRow.locator('td[title="SW-P-O365-13-A-M1M"]')).toBeVisible();
    await expect(bayviewRow.locator('td[title*="Microsoft Teams Domestic Calling Plan"]')).toBeVisible();

    // Expand Bayview Clinic row for detailed drilldown
    await bayviewRow.click();
    await expect(page.locator('text=SW-P-O365-13-A-M1M').first()).toBeVisible();
    await expect(page.locator('text=Microsoft Teams Domestic Calling Plan (customers outside US/UK/CA) (NCE) - Monthly').first()).toBeVisible();
    await expect(page.locator('text=Net quantity after proration adjustments: 13 -> 6 (headline: 12 -> 5)').first()).toBeVisible();
    await expect(page.locator('text=Underlying Rows in 2026-07').first()).toBeVisible();
    await expect(page.locator('text=Underlying Rows in 2026-08').first()).toBeVisible();

    // Test filter tabs
    await page.click('button:has-text("Price (2)")');
    await expect(tableBody.locator('text=Meridian Live').first()).toBeVisible();
    await expect(tableBody.locator('text=Harbor 360').first()).toBeVisible();
    await expect(tableBody.locator('text=Bayview Clinic')).not.toBeVisible();
    
    await page.click('button:has-text("Quantity (2)")');
    await expect(tableBody.locator('text=Bayview Clinic').first()).toBeVisible();
    await expect(tableBody.locator('text=Tandem Staffing').first()).toBeVisible();

    await page.click('button:has-text("New Items (1)")');
    await expect(tableBody.locator('text=Saltbox Kitchen').first()).toBeVisible();

    await page.click('button:has-text("Removed (1)")');
    await expect(tableBody.locator('text=Rosewood Pictures').first()).toBeVisible();
    
    await page.click('button:has-text("All Changes (6)")');

    // Test search filter
    const searchInput = page.locator('input[placeholder="Search changes..."]');
    await searchInput.fill('Meridian');
    await expect(tableBody.locator('text=Meridian Live').first()).toBeVisible();
    await expect(tableBody.locator('text=Harbor 360')).not.toBeVisible();
    await searchInput.fill('');

    // A11y check in Light mode
    const a11yLight = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(a11yLight.violations).toEqual([]);

    // Toggle Dark mode & check a11y
    await page.getByRole('button', { name: 'Toggle color theme' }).click();
    await disableTransitions(page);
    const a11yDark = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(a11yDark.violations).toEqual([]);
    await page.getByRole('button', { name: 'Toggle color theme' }).click();
    await disableTransitions(page);

    expect(consoleErrors).toEqual([]);
  });

  test('05: Export reconciliation to CSV and XLSX and assert parsed contents', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await disableTransitions(page);

    const sherwebCard = page.locator('div.rounded-xl', { has: page.locator('h3:has-text("Sherweb")') });
    await sherwebCard.locator('a:has-text("Compare Diff")').click();
    await page.waitForURL(/\/vendors\/.+\/compare/);
    await disableTransitions(page);

    // Open Export menu
    await page.click('button:has-text("Export Reconciliation")');

    // 1. Download CSV and assert content
    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=CSV Data (.csv)')
    ]);
    expect(csvDownload.suggestedFilename()).toContain('.csv');
    const csvPath = await csvDownload.path();
    expect(csvPath).toBeTruthy();
    const csvContent = fs.readFileSync(csvPath!, 'utf8');
    expect(csvContent.toLowerCase()).toContain('vendor,period_from,period_to,change_type');
    expect(csvContent).toContain('Meridian Live');
    expect(csvContent).toContain('Bayview Clinic');
    expect(csvContent).toContain('Saltbox Kitchen');
    expect(csvContent).toContain('Rosewood Pictures');
    expect(csvContent).toContain('859.62');
    expect(csvContent).toContain('-100.80');
    expect(csvContent).toContain('-265.19');

    // 2. Download XLSX and assert parsed workbook sheets & changes
    await page.click('button:has-text("Export Reconciliation")');
    const [xlsxDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=Excel Workbook (.xlsx)')
    ]);
    expect(xlsxDownload.suggestedFilename()).toContain('.xlsx');
    const xlsxPath = await xlsxDownload.path();
    expect(xlsxPath).toBeTruthy();
    
    const xlsxBuffer = fs.readFileSync(xlsxPath!);
    const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });
    expect(workbook.SheetNames).toEqual(['Summary', 'Changes']);

    const changesSheet = workbook.Sheets['Changes'];
    const changesData = XLSX.utils.sheet_to_json(changesSheet);
    expect(changesData.length).toBe(6);

    const accounts = changesData.map((row: any) => row['Account']);
    expect(accounts).toContain('Bayview Clinic');
    expect(accounts).toContain('Harbor 360');
    expect(accounts).toContain('Meridian Live');
    expect(accounts).toContain('Rosewood Pictures');
    expect(accounts).toContain('Saltbox Kitchen');
    expect(accounts).toContain('Tandem Staffing');

    expect(consoleErrors).toEqual([]);
  });

  test('06: PowerDMARC PDF multi-month reconciliation with Test fixture badge', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await disableTransitions(page);

    const pdCard = page.locator('div.rounded-xl', { has: page.locator('h3:has-text("PowerDMARC")') });
    await pdCard.locator('a:has-text("Compare Diff")').click();
    await page.waitForURL(/\/vendors\/.+\/compare/);
    await disableTransitions(page);

    // Verify Test fixture badge on compare view using exact text
    await expect(page.getByText('Test fixture', { exact: true }).first()).toBeVisible();
    await expect(page.locator('text=0 subscriptions unchanged')).toBeVisible();

    // Verify Net Delta: +$148.00
    await expect(page.locator('text=+$148.00').first()).toBeVisible();
    await expect(page.locator('text=100% Reconciled to the Cent')).toBeVisible();

    // Verify Rate Increase and New Item
    const partnerRow = page.locator('table tbody tr:has-text("PowerDMARC MSP Partner Plan")').first();
    await expect(partnerRow).toBeVisible();
    await partnerRow.click();
    await expect(page.locator('text=No SKU (matched by normalized description)').first()).toBeVisible();
    await expect(page.locator('text=PowerDMARC MSP Partner Plan — Monthly 13 Sep 2026 – 12 Oct 2026 · 50 domains included').first()).toBeVisible();
    await partnerRow.click();

    await expect(page.locator('text=Additional Domains').first()).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('07: Vendor Detail and Line Items pages render and pass a11y in Light & Dark modes', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Vendor Detail Page
    await page.goto('/');
    await disableTransitions(page);

    const sherwebCard = page.locator('div.rounded-xl', { has: page.locator('h3:has-text("Sherweb")') });
    await sherwebCard.locator('a:has-text("View Invoices")').click();
    await page.waitForURL(/\/vendors\/.+/);
    await disableTransitions(page);

    await expect(page.locator('h1')).toContainText('Sherweb');

    // A11y on Vendor Detail in Light mode
    const vendorA11yLight = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(vendorA11yLight.violations).toEqual([]);

    // A11y on Vendor Detail in Dark mode
    await page.getByRole('button', { name: 'Toggle color theme' }).click();
    await disableTransitions(page);
    const vendorA11yDark = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(vendorA11yDark.violations).toEqual([]);

    // 2. Line Items Page
    await page.locator('a:has-text("View Line Items")').first().click();
    await page.waitForURL(/\/invoices\/.+/);
    await disableTransitions(page);

    await expect(page.locator('h1')).toContainText('Invoice Period');
    await expect(page.locator('table')).toBeVisible();

    // A11y on Line Items in Dark mode
    const invoiceA11yDark = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(invoiceA11yDark.violations).toEqual([]);

    // A11y on Line Items in Light mode
    await page.getByRole('button', { name: 'Toggle color theme' }).click();
    await disableTransitions(page);
    const invoiceA11yLight = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(invoiceA11yLight.violations).toEqual([]);

    expect(consoleErrors).toEqual([]);
  });

  test('08: Mobile viewport responsiveness (375px) with horizontal overflow check', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await disableTransitions(page);

    // Verify Dashboard renders cleanly on mobile
    await expect(page.locator('h1')).toContainText('Vendors & Spend Overview');
    await expect(page.locator('button:has-text("Upload Invoice")').first()).toBeVisible();

    // Assert no horizontal overflow on dashboard
    const dashboardOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(dashboardOverflow).toBe(false);

    // Navigate to vendor detail
    const sherwebCard = page.locator('div.rounded-xl', { has: page.locator('h3:has-text("Sherweb")') });
    await sherwebCard.locator('a:has-text("View Invoices")').click();
    await page.waitForURL(/\/vendors\/.+/);
    await disableTransitions(page);

    await expect(page.locator('h1')).toContainText('Sherweb');
    const vendorOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(vendorOverflow).toBe(false);

    // Navigate to compare diff
    await page.goto('/');
    await disableTransitions(page);
    const sherwebCard2 = page.locator('div.rounded-xl', { has: page.locator('h3:has-text("Sherweb")') });
    await sherwebCard2.locator('a:has-text("Compare Diff")').click();
    await page.waitForURL(/\/vendors\/.+\/compare/);
    await disableTransitions(page);

    await expect(page.locator('text=+$620.46').first()).toBeVisible();
    await expect(page.locator('table')).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

});
