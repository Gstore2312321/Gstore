const { chromium } = require("playwright");

const baseUrl = "http://localhost:4321";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  const products = await page.evaluate(async () => {
    const response = await fetch("/api/products");
    const data = await response.json();
    return data.products.slice(0, 2);
  });

  const cart = products.map((product) => ({
    key: `${product.id}-${product.sizes[0] || ""}-${product.colors[0] || ""}`,
    productId: product.id,
    name: product.name,
    price: product.price,
    image: product.image_url,
    stock: product.stock,
    size: product.sizes[0] || "",
    color: product.colors[0] || "",
    quantity: 1
  }));

  await page.evaluate((items) => localStorage.setItem("gstore_cart", JSON.stringify(items)), cart);
  await page.reload({ waitUntil: "networkidle" });
  await page.click("#openCartButton");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "reports-checkout-mobile-viewport.png" });
  await page.screenshot({ path: "reports-checkout-mobile-delivery.png", fullPage: true });

  await page.check('input[name="delivery_method"][value="pickup"]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: "reports-checkout-mobile-pickup.png", fullPage: true });
  await page.evaluate(() => {
    document.querySelector(".cart-panel")?.scrollTo({ top: 620 });
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "reports-checkout-mobile-data.png" });

  const result = await page.evaluate(() => {
    const panel = document.querySelector(".cart-panel");
    const panelRect = panel?.getBoundingClientRect();
    const address = document.querySelector("#deliveryAddressWrap");
    const paypal = document.querySelector("#paypalCheckoutButton");
    const bodyOverflow = document.documentElement.scrollWidth > window.innerWidth + 2;
    return {
      bodyOverflow,
      panelVisible: Boolean(panel && panel.getBoundingClientRect().width > 0),
      panelRect: panelRect ? { x: panelRect.x, width: panelRect.width, height: panelRect.height } : null,
      addressHiddenOnPickup: Boolean(address?.hidden),
      paypalDisabledOnPickup: Boolean(paypal?.disabled),
      whatsappLabel: document.querySelector("#whatsappCheckoutButton")?.textContent.trim()
    };
  });

  console.log(JSON.stringify(result));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
