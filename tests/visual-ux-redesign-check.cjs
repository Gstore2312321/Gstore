const path = require("path");
const { chromium } = require("playwright");

const fileUrl = (name) => `file:///${path.resolve(`public/${name}`).replace(/\\/g, "/")}`;

const categories = [
  { id: 1, name: "Ropa", slug: "ropa", description: "Prendas importadas", active: true },
  { id: 2, name: "Zapatos", slug: "zapatos", description: "Calzado por talla", active: true },
  { id: 3, name: "Carteras", slug: "carteras", description: "Carteras y bolsos", active: true },
  { id: 4, name: "Accesorios", slug: "accesorios", description: "Detalles para completar looks", active: true }
];

const products = [
  {
    id: 1,
    name: "Cartera mini champagne",
    sku: "GS-001",
    description: "Pequeña, elegante y fácil de llevar cuando solo necesitas lo esencial.",
    price: 35,
    compare_price: 48,
    cost_price: 18,
    stock: 2,
    active: true,
    featured: true,
    promo_type: "last_units",
    promo_label: "Últimas unidades",
    sizes: [],
    colors: ["Champagne", "Café"],
    image_url: "assets/product-bag.svg",
    category: categories[2]
  },
  {
    id: 2,
    name: "Vestido dorado suave",
    sku: "GS-002",
    description: "Vestido ligero con caída limpia, pensado para una salida bonita sin exagerar.",
    price: 58,
    compare_price: 72,
    cost_price: 28,
    stock: 3,
    active: true,
    featured: true,
    promo_type: "discount",
    promo_label: "Precio especial",
    sizes: ["S", "M", "L", "8"],
    colors: ["Champagne", "Negro"],
    image_url: "assets/product-dress.svg",
    category: categories[0]
  },
  {
    id: 3,
    name: "Set blanco casual",
    sku: "GS-003",
    description: "Conjunto suave para viajar, salir o resolver el día sin pensar demasiado.",
    price: 49,
    compare_price: 0,
    cost_price: 24,
    stock: 4,
    active: true,
    featured: false,
    promo_type: "new_arrival",
    promo_label: "Recién llegado",
    sizes: ["XS", "S", "M", "L"],
    colors: ["Blanco", "Arena"],
    image_url: "assets/product-set.svg",
    category: categories[0]
  },
  {
    id: 4,
    name: "Set de aretes dorados",
    sku: "GS-004",
    description: "Accesorios con brillo cálido para completar looks sencillos.",
    price: 18,
    compare_price: 0,
    cost_price: 7,
    stock: 8,
    active: true,
    featured: false,
    promo_type: "none",
    promo_label: "",
    sizes: [],
    colors: ["Dorado"],
    image_url: "assets/product-accessories.svg",
    category: categories[3]
  }
];

const orders = [
  {
    id: 10,
    order_code: "GS-20260519-001",
    created_at: "2026-05-19T14:20:00.000Z",
    customer_name: "Sofía Carriel",
    customer_phone: "0980000000",
    customer_email: "cliente@example.com",
    customer_city: "Guayaquil",
    customer_address: "Urdesa, referencia principal",
    delivery_method: "delivery",
    payment_method: "whatsapp",
    payment_status: "pending",
    status: "new",
    total: 93,
    notes: "Confirmar disponibilidad antes de enviar.",
    items: [
      { quantity: 1, name: "Cartera mini champagne", size: "", color: "Champagne", sku: "GS-001", price: 35, line_total: 35 },
      { quantity: 1, name: "Vestido dorado suave", size: "M", color: "Champagne", sku: "GS-002", price: 58, line_total: 58 }
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
    { label: "Mié", sales: 93, profit: 47 },
    { label: "Jue", sales: 0, profit: 0 },
    { label: "Vie", sales: 58, profit: 30 },
    { label: "Sáb", sales: 18, profit: 11 },
    { label: "Dom", sales: 0, profit: 0 }
  ],
  topProducts: [
    { name: "Vestido dorado suave", sku: "GS-002", quantity: 1, sales: 58, profit: 30 },
    { name: "Cartera mini champagne", sku: "GS-001", quantity: 1, sales: 35, profit: 17 }
  ],
  categoryProfit: [
    { category: "Ropa", stock: 7, inventoryCost: 124, inventoryValue: 263, potentialProfit: 139 },
    { category: "Carteras", stock: 2, inventoryCost: 36, inventoryValue: 70, potentialProfit: 34 },
    { category: "Accesorios", stock: 8, inventoryCost: 56, inventoryValue: 144, potentialProfit: 88 }
  ],
  orderStatus: [
    { label: "Nuevo", count: 1 },
    { label: "Preparando", count: 0 },
    { label: "Completado", count: 0 }
  ]
};

async function attachRoutes(page, { authenticated = true } = {}) {
  const json = (route, data, status = 200) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data)
  });

  await page.route("**/api/config", (route) => json(route, { storeName: "GStore", currency: "USD", paypalEnabled: false }));
  await page.route("**/api/categories", (route) => json(route, { categories }));
  await page.route("**/api/products", (route) => json(route, { products }));
  await page.route("**/api/banners", (route) => json(route, { banners: [] }));
  await page.route("**/api/admin/session", (route) => {
    if (!authenticated) return json(route, { error: "No autorizado" }, 401);
    return json(route, { csrfToken: "visual-csrf" });
  });
  await page.route("**/api/admin/summary", (route) => json(route, {
    productCount: products.length,
    activeProducts: products.filter((product) => product.active).length,
    orderCount: orders.length,
    revenue: 93
  }));
  await page.route("**/api/admin/analytics", (route) => json(route, analytics));
  await page.route("**/api/admin/categories", (route) => json(route, { categories }));
  await page.route("**/api/admin/products", (route) => json(route, { products }));
  await page.route("**/api/admin/banners", (route) => json(route, { banners: [] }));
  await page.route("**/api/admin/orders", (route) => json(route, { orders }));
}

async function shot(page, file, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(700);
  await page.screenshot({ path: file, fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  const loginPage = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  await attachRoutes(loginPage, { authenticated: false });
  await loginPage.goto(fileUrl("admin.html"), { waitUntil: "networkidle" });
  await shot(loginPage, "reports-ux-admin-login-desktop.png", { width: 1366, height: 768 });
  await loginPage.close();

  const page = await browser.newPage({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
  await attachRoutes(page);

  await page.goto(fileUrl("index.html"), { waitUntil: "networkidle" });
  await shot(page, "reports-ux-store-desktop.png", { width: 1440, height: 920 });
  await page.click("[data-open-product='2']");
  await page.waitForSelector("#productDrawer.is-open");
  await shot(page, "reports-ux-store-product-modal.png", { width: 1200, height: 820 });
  await page.click(".close-product");
  await shot(page, "reports-ux-store-mobile.png", { width: 390, height: 844 });

  const adminPages = [
    ["admin.html", "reports-ux-admin-dashboard-desktop.png"],
    ["admin-reportes.html", "reports-ux-admin-reportes-desktop.png"],
    ["admin-productos.html", "reports-ux-admin-productos-desktop.png"],
    ["admin-categorias.html", "reports-ux-admin-categorias-desktop.png"],
    ["admin-pedidos.html", "reports-ux-admin-pedidos-desktop.png"]
  ];

  for (const [name, screenshot] of adminPages) {
    await page.setViewportSize({ width: 1440, height: 920 });
    await page.goto(fileUrl(name), { waitUntil: "networkidle" });
    await page.waitForSelector("#dashboardView:not([hidden])");
    await shot(page, screenshot, { width: 1440, height: 920 });
  }

  await page.goto(fileUrl("admin-productos.html"), { waitUntil: "networkidle" });
  await page.waitForSelector("#dashboardView:not([hidden])");
  await shot(page, "reports-ux-admin-productos-mobile.png", { width: 390, height: 844 });

  const checks = await page.evaluate(() => ({
    font: getComputedStyle(document.body).fontFamily,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    activeNav: document.querySelector(".admin-sidebar nav a.is-active")?.textContent?.trim(),
    brief: Boolean(document.querySelector(".admin-page-brief"))
  }));
  console.log(JSON.stringify(checks, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
