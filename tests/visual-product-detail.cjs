const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:4321", { waitUntil: "networkidle" });
  await page.click("[data-open-product]");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "reports-product-detail-compact-desktop.png" });

  const desktop = await page.evaluate(() => {
    const panel = document.querySelector(".product-panel")?.getBoundingClientRect();
    const image = document.querySelector(".product-detail img")?.getBoundingClientRect();
    return {
      panelWidth: Math.round(panel?.width || 0),
      panelHeight: Math.round(panel?.height || 0),
      imageHeight: Math.round(image?.height || 0),
      viewportWidth: window.innerWidth
    };
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:4321", { waitUntil: "networkidle" });
  await page.click("[data-open-product]");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "reports-product-detail-compact-mobile.png" });

  const mobile = await page.evaluate(() => {
    const panel = document.querySelector(".product-panel")?.getBoundingClientRect();
    const overflow = document.documentElement.scrollWidth > window.innerWidth + 2;
    return {
      panelWidth: Math.round(panel?.width || 0),
      panelHeight: Math.round(panel?.height || 0),
      viewportWidth: window.innerWidth,
      overflow
    };
  });

  console.log(JSON.stringify({ desktop, mobile }));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
