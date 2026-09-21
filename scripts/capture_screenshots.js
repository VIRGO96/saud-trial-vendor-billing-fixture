const { chromium } = require('../frontend/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function reseed() {
  return new Promise((resolve) => {
    const req = http.request('http://127.0.0.1:8000/api/vendors/seed', { method: 'POST' }, (res) => {
      resolve();
    });
    req.on('error', () => resolve());
    req.end();
  });
}

async function disableTransitions(page) {
  await page.addStyleTag({
    content: '*, *::before, *::after { -webkit-transition: none !important; -moz-transition: none !important; -o-transition: none !important; -ms-transition: none !important; transition: none !important; -webkit-animation: none !important; -moz-animation: none !important; -o-animation: none !important; -ms-animation: none !important; animation: none !important; }'
  });
}

async function capture() {
  const outDir = path.resolve(__dirname, '..', 'docs', 'screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('0. Reseeding database for fresh screenshot capture...');
  await reseed();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  console.log('1. Navigating to Dashboard...');
  await page.goto('http://127.0.0.1:3000');
  await disableTransitions(page);
  await page.waitForSelector('text=Vendors & Spend Overview');
  await page.waitForSelector('text=Sherweb');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(outDir, '01_dashboard.png'), fullPage: true });

  console.log('2. Navigating to Sherweb Vendor timeline...');
  const sherwebCard = page.getByRole('heading', { name: 'Sherweb' }).locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]');
  await sherwebCard.getByRole('link', { name: 'View Invoices' }).click();
  await disableTransitions(page);
  await page.waitForSelector('text=Billing Periods & Invoices');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(outDir, '02_vendor_timeline.png'), fullPage: true });

  console.log('3. Navigating to Line Items page...');
  const viewItems = page.locator('a:has-text("View Line Items")').first();
  await viewItems.click();
  await disableTransitions(page);
  await page.waitForSelector('text=Filtered Line Items');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(outDir, '03_line_items.png'), fullPage: true });

  console.log('4. Navigating to Reconciliation page...');
  await page.goto('http://127.0.0.1:3000');
  await disableTransitions(page);
  await page.waitForSelector('text=Sherweb');
  const sherwebCard2 = page.getByRole('heading', { name: 'Sherweb' }).locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]');
  await sherwebCard2.getByRole('link', { name: 'Compare Diff' }).click();
  await disableTransitions(page);
  await page.waitForSelector('text=Period Reconciliation: Sherweb');
  await page.waitForSelector('text=+$620.46');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(outDir, '04_reconciliation.png'), fullPage: true });

  console.log('5. Expanding Drilldown on Reconciliation page...');
  const rowToExpand = page.locator('table tbody tr:has-text("SW-P-O365-13-A-M1M")').first();
  await rowToExpand.click();
  await page.waitForSelector('text=Change Notes:');
  await page.waitForSelector('text=Underlying Rows in');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '05_drilldown.png'), fullPage: true });

  console.log('6. Navigating to PowerDMARC Comparison with drilldown...');
  await page.goto('http://127.0.0.1:3000');
  await disableTransitions(page);
  await page.waitForSelector('text=PowerDMARC');
  const pdCard = page.getByRole('heading', { name: 'PowerDMARC' }).locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]');
  await pdCard.getByRole('link', { name: 'Compare Diff' }).click();
  await disableTransitions(page);
  await page.waitForSelector('text=PowerDMARC');
  await page.waitForSelector('text=Test fixture');
  await page.waitForSelector('text=+$148.00');
  // Expand Partner Plan row to show tier note change
  const partnerRow = page.locator('table tbody tr:has-text("PowerDMARC MSP Partner Plan")').first();
  await partnerRow.click();
  await page.waitForSelector('text=Plan tier updated');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '06_powerdmarc_comparison.png'), fullPage: true });

  console.log('7. Opening Upload and Preview Modal...');
  await page.goto('http://127.0.0.1:3000');
  await disableTransitions(page);
  await page.waitForSelector('text=Vendors & Spend Overview');
  await page.click('button:has-text("Upload Invoice")');
  await disableTransitions(page);
  await page.waitForSelector('text=Upload Vendor Invoice');
  const fileInput = page.locator('input[type="file"]');
  const sampleCsv = path.resolve(__dirname, '..', 'samples', 'vendor-sherweb-2026-08.csv');
  await fileInput.setInputFiles(sampleCsv);
  await page.waitForSelector('text=Parsed Summary');
  await page.waitForSelector('text=Unit Price');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '07_upload_preview.png') });

  await browser.close();
  console.log('All 7 screenshots saved successfully in docs/screenshots/');
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});

