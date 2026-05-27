const path = require("path");
const { chromium } = require("playwright");

const fileUrl = (name) => `file:///${path.resolve(`public/${name}`).replace(/\\/g, "/")}`;

const categories = [
  { id: 1, name: "Ropa", slug: "ropa", description: "Prendas importadas", active: true },
  { id: 2, name: "Carteras", slug: "carteras", description: "Bolsos y carteras", active: true }
];

const products = [
  {
    id: 1,
    name: "Cartera mini champagne",
    sku: "GS-001",
    description: "Pequena, elegante y facil de llevar cuando solo necesitas lo esencial.",
    price: 35,
    compare_price: 48,
    cost_price: 18,
    stock: 2,
    active: true,
    featured: true,
    promo_type: "last_units",
    promo_label: "Ultimas unidades",
    sizes: [],
    colors: ["Champagne", "Cafe"],
    image_url: "assets/product-bag.svg",
    category: categories[1]
  },
  {
    id: 2,
    name: "Vestido dorado suave",
    sku: "GS-002",
    description: "Vestido ligero con caida limpia para una salida bonita sin exagerar.",
    price: 58,
    compare_price: 72,
    cost_price: 28,
    stock: 3,
    active: true,
    featured: true,
    promo_type: "discount",
    promo_label: "Precio especial",
    sizes: ["S", "M", "L"],
    colors: ["Champagne", "Negro"],
    image_url: "assets/product-dress.svg",
    category: categories[0]
  }
];

const orders = [
  {
    id: 10,
    order_code: "GS-20260519-001",
    created_at: "2026-05-19T14:20:00.000Z",
    customer_name: "Sofia Carriel",
    customer_phone: "0980000000",
    customer_email: "cliente@example.com",
    customer_city: "Guayaquil",
    customer_address: "Urdesa",
    delivery_method: "delivery",
    payment_method: "whatsapp",
    payment_status: "pending",
    status: "new",
    total: 93,
    notes: "",
    items: [
      { quantity: 1, name: "Cartera mini champagne", size: "", color: "Champagne", sku: "GS-001", price: 35, line_total: 35 }
    ]
  }
];

const analytics = {
  totals: {
    sales: 93,
    estimatedProfit: 47,
    paidProfit: 0,
    pendingProfit: 47,
    inventoryPotentialProfit: 212,
    inventoryValue: 482,
    averageOrder: 93,
    margin: 51,
    orderCount: 1
  },
  salesProfitByDay: [
    { label: "Lun", sales: 0, profit: 0 },
    { label: "Mar", sales: 35, profit: 17 },
    { label: "Mie", sales: 93, profit: 47 }
  ],
  topProducts: [
    { name: "Vestido dorado suave", sku: "GS-002", quantity: 1, sales: 58, profit: 30 }
  ],
  categoryProfit: [
    { category: "Ropa", stock: 3, inventoryCost: 28, inventoryValue: 58, potentialProfit: 30 },
    { category: "Carteras", stock: 2, inventoryCost: 18, inventoryValue: 35, potentialProfit: 17 }
  ],
  orderStatus: [
    { label: "Nuevo", count: 1 },
    { label: "Preparando", count: 0 }
  ]
};

async function mockRoutes(page) {
  const json = (route, data, status = 200) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data)
  });

  await page.route("**/api/config", (route) => json(route, { storeName: "GStore", currency: "USD", paypalEnabled: false }));
  await page.route("**/api/categories", (route) => json(route, { categories }));
  await page.route("**/api/products", (route) => json(route, { products }));
  await page.route("**/api/banners", (route) => json(route, { banners: [] }));
  await page.route("**/api/admin/session", (route) => json(route, { csrfToken: "visual-csrf" }));
  await page.route("**/api/admin/summary", (route) => json(route, {
    productCount: products.length,
    activeProducts: products.length,
    orderCount: orders.length,
    revenue: 93
  }));
  await page.route("**/api/admin/analytics", (route) => json(route, analytics));
  await page.route("**/api/admin/categories", (route) => json(route, { categories }));
  await page.route("**/api/admin/products", (route) => json(route, { products }));
  await page.route("**/api/admin/banners", (route) => json(route, { banners: [] }));
  await page.route("**/api/admin/orders", (route) => json(route, { orders }));
}

async function screenshot(page, name, fullPage = true) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: name, fullPage });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mockRoutes(page);

  await page.goto(fileUrl("index.html"), { waitUntil: "networkidle" });
  await page.waitForSelector("#catalogo");
  const catalogFirstChecks = await page.evaluate(() => {
    const catalog = document.querySelector("#catalogo")?.getBoundingClientRect();
    const tools = document.querySelector(".catalog-tools")?.getBoundingClientRect();
    const cards = Array.from(document.querySelectorAll(".product-card")).slice(0, 2).map((card) => card.getBoundingClientRect());
    return {
      noHero: !document.querySelector(".hero"),
      noMobileIndex: !document.querySelector(".mobile-store-index"),
      noPromoBanners: !document.querySelector("#promoBannerRow"),
      catalogTop: Math.round(catalog?.top || 0),
      catalogTitle: document.querySelector("#catalogTitle")?.textContent?.trim(),
      toolsWidth: Math.round(tools?.width || 0),
      toolsTop: Math.round(tools?.top || 0),
      productCardCount: document.querySelectorAll(".product-card").length,
      firstCardWidth: Math.round(cards[0]?.width || 0),
      secondCardWidth: Math.round(cards[1]?.width || 0),
      firstTwoSameRow: Boolean(cards[0] && cards[1] && Math.abs(cards[0].top - cards[1].top) < 4)
    };
  });

  await page.click("[data-open-product='2']");
  await page.waitForSelector("#productDrawer.is-open");
  await screenshot(page, "reports-mobile-polish-product-drawer.png", false);
  await page.click("#addDetailToCart");
  await page.waitForSelector("#cartDrawer.is-open");
  await page.click("#continueCheckoutButton");
  await page.waitForSelector("#checkoutForm:not([hidden])");
  await page.check('input[name="delivery_method"][value="pickup"]');
  await screenshot(page, "reports-mobile-polish-checkout.png", false);

  const storeChecks = await page.evaluate((catalogFirstChecks) => {
    const productPanel = document.querySelector("#productDrawer .drawer-panel")?.getBoundingClientRect();
    const cartPanel = document.querySelector("#cartDrawer .drawer-panel")?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      ...catalogFirstChecks,
      productPanelWidth: Math.round(productPanel?.width || 0),
      cartPanelWidth: Math.round(cartPanel?.width || 0),
      checkoutVisible: !document.querySelector("#checkoutForm")?.hidden,
      addressHiddenOnPickup: Boolean(document.querySelector("#deliveryAddressWrap")?.hidden),
      paypalDisabledOnPickup: Boolean(document.querySelector("#paypalCheckoutButton")?.disabled)
    };
  }, catalogFirstChecks);

  await page.goto(fileUrl("admin.html"), { waitUntil: "networkidle" });
  await page.waitForSelector("#dashboardView:not([hidden])");
  await screenshot(page, "reports-mobile-polish-admin-dashboard.png");

  await page.goto(fileUrl("admin-productos.html"), { waitUntil: "networkidle" });
  await page.waitForSelector("#dashboardView:not([hidden])");
  await page.click("[data-edit-product='1']");
  await page.waitForSelector("#productDrawer:not([hidden])");
  await screenshot(page, "reports-mobile-polish-admin-drawer.png", false);

  const adminChecks = await page.evaluate(() => {
    const drawer = document.querySelector("#productDrawer .drawer-panel")?.getBoundingClientRect();
    const nav = document.querySelector(".admin-sidebar nav")?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      drawerWidth: Math.round(drawer?.width || 0),
      drawerHeight: Math.round(drawer?.height || 0),
      navHeight: Math.round(nav?.height || 0),
      activeNav: document.querySelector(".admin-sidebar nav a.is-active")?.textContent?.trim()
    };
  });

  if (storeChecks.overflow) throw new Error("La tienda tiene overflow horizontal en movil.");
  if (!storeChecks.noHero || !storeChecks.noMobileIndex || !storeChecks.noPromoBanners) {
    throw new Error("La tienda todavia muestra secciones superiores que deben estar eliminadas.");
  }
  if (storeChecks.catalogTop > 120 || storeChecks.toolsWidth > 390 || storeChecks.catalogTitle !== "Elige tu pieza.") {
    throw new Error("El catalogo no aparece como primera experiencia movil.");
  }
  if (storeChecks.productCardCount < 2 || !storeChecks.firstTwoSameRow || storeChecks.firstCardWidth > 190 || storeChecks.secondCardWidth > 190) {
    throw new Error("Las cards del catalogo movil no estan en dos columnas compactas.");
  }
  if (storeChecks.productPanelWidth > 390 || storeChecks.cartPanelWidth > 390) {
    throw new Error("Los drawers de tienda se salen del viewport movil.");
  }
  if (!storeChecks.checkoutVisible || !storeChecks.addressHiddenOnPickup || !storeChecks.paypalDisabledOnPickup) {
    throw new Error("El checkout movil no conserva el flujo esperado.");
  }
  if (adminChecks.overflow || adminChecks.drawerWidth > 390 || adminChecks.navHeight > 120) {
    throw new Error("El panel admin tiene un problema responsive en movil.");
  }

  console.log(JSON.stringify({ storeChecks, adminChecks }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
