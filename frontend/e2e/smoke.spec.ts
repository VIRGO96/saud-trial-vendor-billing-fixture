import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';

async function disableTransitions(page: any) {
  await page.addStyleTag({
    content: '*, *::before, *::after { -webkit-transition: none !important; -moz-transition: none !important; -o-transition: none !important; -ms-transition: none !important; transition: none !important; -webkit-animation: none !important; -moz-animation: none !important; -o-animation: none !important; -ms-animation: none !important; animation: none !important; }'
  });
}

test.describe('Vendor Billing Reconciliation - Non-Destructive Live Smoke Suite', () => {

  test.beforeEach(async ({ page }) => {
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

  test('01: Overview Dashboard renders KPIs, vendor cards, and passes WCAG 2.1 AA in Light & Dark modes', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await disableTransitions(page);

    // Verify main header & KPI cards
    await expect(page.locator('h1')).toContainText('Vendors & Spend Overview');
    await expect(page.locator('text=Tracked Vendors')).toBeVisible();
    await expect(page.locator('text=Total Ingested Invoices')).toBeVisible();
    await expect(page.locator('text=Latest Monitored Spend')).toBeVisible();
    await expect(page.locator('text=Reconciliation Engine')).toBeVisible();

    // Verify vendor accounts exist
    await expect(page.locator('h3', { hasText: 'Sherweb' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'PowerDMARC' })).toBeVisible();

    // WCAG 2.1 AA check in Light mode
    const lightA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(lightA11y.violations).toEqual([]);

    // Toggle Dark mode
    await page.getByRole('button', { name: 'Toggle color theme' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await disableTransitions(page);

    // WCAG 2.1 AA check in Dark mode
    const darkA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(darkA11y.violations).toEqual([]);

    // Reset back to Light mode
    await page.getByRole('button', { name: 'Toggle color theme' }).click();
    await disableTransitions(page);

    expect(consoleErrors).toEqual([]);
  });

  test('02: Vendor detail and invoice line items pages render and pass WCAG 2.1 AA', async ({ page }) => {
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

    const vendorA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(vendorA11y.violations).toEqual([]);

    // 2. Invoice Line Items Page
    await page.locator('a:has-text("View Line Items")').first().click();
    await page.waitForURL(/\/invoices\/.+/);
    await disableTransitions(page);

    await expect(page.locator('h1')).toContainText('Invoice Period');
    await expect(page.locator('table')).toBeVisible();

    const invoiceA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(invoiceA11y.violations).toEqual([]);

    expect(consoleErrors).toEqual([]);
  });

  test('03: Reconciliation diff view displays 6 changes, +$620.46, and drilldown', async ({ page }) => {
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

    // Verify comparison header & reconciliation status & unchanged count
    await expect(page.locator('h1')).toContainText('Period Reconciliation: Sherweb');
    await expect(page.locator('text=100% Reconciled to the Cent')).toBeVisible();
    await expect(page.locator('text=+$620.46').first()).toBeVisible();
    await expect(page.locator('text=163 subscriptions unchanged')).toBeVisible();

    // Verify 6 changes in table
    const tableBody = page.locator('table tbody');
    await expect(tableBody.locator('text=Bayview Clinic').first()).toBeVisible();
    await expect(tableBody.locator('text=Harbor 360').first()).toBeVisible();
    await expect(tableBody.locator('text=Meridian Live').first()).toBeVisible();
    await expect(tableBody.locator('text=Rosewood Pictures').first()).toBeVisible();
    await expect(tableBody.locator('text=Saltbox Kitchen').first()).toBeVisible();
    await expect(tableBody.locator('text=Tandem Staffing').first()).toBeVisible();

    // Assert Bayview Clinic headline quantity 12 -> 5, tooltips, and drill-down note
    const bayviewRow = tableBody.locator('tr:has-text("Bayview Clinic")').first();
    await expect(bayviewRow).toContainText('12 → 5');
    await expect(bayviewRow).toContainText('-$100.80');
    await expect(bayviewRow.locator('td[title="Bayview Clinic"]')).toBeVisible();
    await expect(bayviewRow.locator('td[title="SW-P-O365-13-A-M1M"]')).toBeVisible();
    await expect(bayviewRow.locator('td[title*="Microsoft Teams Domestic Calling Plan"]')).toBeVisible();

    await bayviewRow.click();
    await expect(page.locator('text=SW-P-O365-13-A-M1M').first()).toBeVisible();
    await expect(page.locator('text=Microsoft Teams Domestic Calling Plan (customers outside US/UK/CA) (NCE) - Monthly').first()).toBeVisible();
    await expect(page.locator('text=Net quantity after proration adjustments: 13 -> 6 (headline: 12 -> 5)').first()).toBeVisible();
    await bayviewRow.click();

    // A11y on Compare View
    const compA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(compA11y.violations).toEqual([]);

    expect(consoleErrors).toEqual([]);
  });

  test('04: Export reconciliation to CSV & XLSX without state mutations', async ({ page }) => {
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

    // Export CSV
    await page.click('button:has-text("Export Reconciliation")');
    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=CSV Data (.csv)')
    ]);
    const csvPath = await csvDownload.path();
    expect(csvPath).toBeTruthy();
    const csvContent = fs.readFileSync(csvPath!, 'utf8');
    expect(csvContent).toContain('Bayview Clinic');
    expect(csvContent).toContain('859.62');

    // Export XLSX
    await page.click('button:has-text("Export Reconciliation")');
    const [xlsxDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=Excel Workbook (.xlsx)')
    ]);
    const xlsxPath = await xlsxDownload.path();
    expect(xlsxPath).toBeTruthy();
    const xlsxBuffer = fs.readFileSync(xlsxPath!);
    const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });
    expect(workbook.SheetNames).toEqual(['Summary', 'Changes']);
    const changesData = XLSX.utils.sheet_to_json(workbook.Sheets['Changes']);
    expect(changesData.length).toBe(6);

    expect(consoleErrors).toEqual([]);
  });

  test('05: Mobile viewport responsiveness (375px) with zero horizontal overflow', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await disableTransitions(page);

    await expect(page.locator('h1')).toContainText('Vendors & Spend Overview');

    const dashboardOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(dashboardOverflow).toBe(false);

    expect(consoleErrors).toEqual([]);
  });

  test('06: PowerDMARC reconciliation comparison shows +$148.00, "Test fixture" badge, Partner Plan +$50.00 and Additional Domains +$98.00', async ({ page }) => {
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

    // Verify header, spend delta +$148.00, Test fixture badge, and unchanged count
    await expect(page.locator('h1')).toContainText('Period Reconciliation: PowerDMARC');
    await expect(page.locator('text=+$148.00').first()).toBeVisible();
    await expect(page.getByText('Test fixture', { exact: true }).first()).toBeVisible();
    await expect(page.locator('text=0 subscriptions unchanged')).toBeVisible();

    // Locate Description column dynamically by header index
    const tableHeaders = await page.locator('table thead th').allTextContents();
    const descColIndex = tableHeaders.findIndex(h => h.trim().toLowerCase() === 'description') + 1;
    expect(descColIndex).toBeGreaterThan(0);

    // Verify table items
    const tableBody = page.locator('table tbody');

    // Partner Plan: +$50.00 (Price Changed)
    const partnerPlanRow = tableBody.locator('tr:has-text("PowerDMARC MSP Partner Plan")').first();
    await expect(partnerPlanRow).toBeVisible();
    await expect(partnerPlanRow).toContainText('PRICE');
    await expect(partnerPlanRow).toContainText('+$50.00');

    const partnerDescCell = partnerPlanRow.locator(`td:nth-child(${descColIndex})`);
    await expect(partnerDescCell).toHaveText('PowerDMARC MSP Partner Plan — Monthly 13 Sep 2026 – 12 Oct 2026 · 50 domains included');

    // Expand Partner Plan row to verify drilldown Full SKU placeholder & Full Description
    await partnerPlanRow.click();
    await expect(page.locator('text=No SKU (matched by normalized description)').first()).toBeVisible();
    await expect(page.locator('text=PowerDMARC MSP Partner Plan — Monthly 13 Sep 2026 – 12 Oct 2026 · 50 domains included').first()).toBeVisible();
    await partnerPlanRow.click();

    // Additional Domains Pack: +$98.00 (New)
    const addDomainsRow = tableBody.locator('tr:has-text("Additional Domains")').first();
    await expect(addDomainsRow).toBeVisible();
    await expect(addDomainsRow).toContainText('NEW');
    await expect(addDomainsRow).toContainText('+$98.00');

    const addDomainsDescCell = addDomainsRow.locator(`td:nth-child(${descColIndex})`);
    await expect(addDomainsDescCell).toHaveText('PowerDMARC Additional Domains Pack 13 Sep 2026 – 12 Oct 2026 · 10 extra domains');

    // Assert that no description cell starts with a digit + space or digit prefix
    const descriptions = await page.locator(`table tbody tr td:nth-child(${descColIndex})`).allTextContents();
    expect(descriptions.length).toBeGreaterThanOrEqual(2);
    for (const desc of descriptions) {
      expect(desc).not.toMatch(/^\s*\d+[\s.:-]/);
    }

    // A11y check
    const pdA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(pdA11y.violations).toEqual([]);

    expect(consoleErrors).toEqual([]);
  });

});

