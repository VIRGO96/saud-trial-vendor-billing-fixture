const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

async function generateFixture() {
  const outDir = path.join(__dirname, "..", "fixtures", "generated");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, "powerdmarc-2026-09-SYNTHETIC.pdf");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 40px;
      color: #333333;
      font-size: 13px;
      line-height: 1.4;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 25px;
    }
    .issuer-name {
      font-size: 16px;
      font-weight: bold;
      color: #111827;
    }
    .vendor-title {
      font-size: 15px;
      font-weight: bold;
      color: #2563eb;
      margin-top: 4px;
      margin-bottom: 8px;
    }
    .invoice-title {
      font-size: 24px;
      font-weight: bold;
      text-align: right;
      color: #111827;
      letter-spacing: 1px;
    }
    .invoice-meta {
      text-align: right;
      margin-top: 8px;
    }
    .paid-badge {
      display: inline-block;
      color: #16a34a;
      font-weight: bold;
      font-size: 14px;
      margin-top: 4px;
    }
    .bill-to-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 25px;
      border-top: 1px solid #e5e7eb;
      padding-top: 15px;
    }
    .section-title {
      font-weight: bold;
      color: #4b5563;
      margin-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background-color: #f3f4f6;
      text-align: left;
      padding: 8px 10px;
      font-size: 12px;
      border-bottom: 1px solid #d1d5db;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }
    .text-right {
      text-align: right;
    }
    .item-title {
      font-weight: bold;
      color: #111827;
    }
    .item-desc {
      color: #6b7280;
      font-size: 12px;
      margin-top: 3px;
    }
    .totals-area {
      width: 280px;
      margin-left: auto;
      margin-bottom: 30px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }
    .total-grand {
      font-size: 15px;
      font-weight: bold;
      border-top: 1px solid #111827;
      padding-top: 6px;
      margin-top: 4px;
    }
    .footer {
      margin-top: 50px;
      border-top: 1px solid #e5e7eb;
      padding-top: 12px;
      font-size: 11px;
      color: #9ca3af;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="issuer-name">MENAINFOSEC, Inc</div>
      <div class="vendor-title">PowerDMARC</div>
      <div>1000 Dummy Blvd, Suite 000</div>
      <div>Springfield, DE 00000</div>
      <div>United States</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">INVOICE</div>
      <div style="margin-top: 6px;"><strong>Invoice#</strong> INV-000001</div>
      <div class="paid-badge">PAID</div>
    </div>
  </div>

  <div class="bill-to-section">
    <div>
      <div class="section-title">Bill To</div>
      <div style="font-weight: bold; color: #111827;">Example MSP LLC</div>
      <div>Accounts Payable</div>
      <div>100 Sample Street</div>
      <div>Anytown, CA 00000</div>
    </div>
    <div style="text-align: right;">
      <div><strong>Invoice Date</strong> 13 Sep 2026</div>
      <div><strong>Terms</strong> Due on Receipt</div>
      <div><strong>Due Date</strong> 13 Sep 2026</div>
      <div><strong>Subscription#</strong> SUB-0000000</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px;">#</th>
        <th>Item & Description</th>
        <th class="text-right" style="width: 50px;">Qty</th>
        <th class="text-right" style="width: 80px;">Rate</th>
        <th class="text-right" style="width: 80px;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>
          <div class="item-title">PowerDMARC MSP Partner Plan — Monthly</div>
          <div class="item-desc">13 Sep 2026 – 12 Oct 2026 · 50 domains included</div>
        </td>
        <td class="text-right">1</td>
        <td class="text-right">1,347.00</td>
        <td class="text-right">1,347.00</td>
      </tr>
      <tr>
        <td>2</td>
        <td>
          <div class="item-title">PowerDMARC Additional Domains Pack</div>
          <div class="item-desc">13 Sep 2026 – 12 Oct 2026 · 10 extra domains</div>
        </td>
        <td class="text-right">2</td>
        <td class="text-right">49.00</td>
        <td class="text-right">98.00</td>
      </tr>
    </tbody>
  </table>

  <div class="totals-area">
    <div class="totals-row">
      <span>Sub Total</span>
      <span>1,445.00</span>
    </div>
    <div class="totals-row total-grand">
      <span>Total</span>
      <span>$1,445.00</span>
    </div>
    <div class="totals-row">
      <span>Payment Made</span>
      <span>(-) 1,445.00</span>
    </div>
    <div class="totals-row" style="font-weight: bold;">
      <span>Balance Due</span>
      <span>$0.00</span>
    </div>
  </div>

  <div class="footer">
    Sanitized TEST FIXTURE for the AllSafe developer trial. Modeled on a Zoho Subscriptions invoice email. Not a real invoice.
  </div>
</body>
</html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.pdf({
    path: outFile,
    format: "A4",
    printBackground: true,
  });
  await browser.close();

  console.log(`Generated synthetic fixture: ${outFile}`);
}

generateFixture().catch((err) => {
  console.error("Error generating fixture:", err);
  process.exit(1);
});