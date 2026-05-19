const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const fileUrl = `file:///${path.resolve("public/index.html").replace(/\\/g, "/")}`;
  await page.goto(fileUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "reports-file-open-fixed.png" });
  const result = await page.evaluate(() => ({
    href: location.href,
    css: getComputedStyle(document.body).fontFamily,
    cards: document.querySelectorAll(".product-card").length,
    banners: document.querySelectorAll(".promo-banner").length,
    stylesheet: document.querySelector('link[rel="stylesheet"]')?.getAttribute("href"),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2
  }));
  console.log(JSON.stringify(result));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
