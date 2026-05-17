require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { DatabaseSync } = require("node:sqlite");

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const IS_VERCEL = Boolean(process.env.VERCEL);
const RAILWAY_VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH ? path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH) : "";
const IS_RAILWAY = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || RAILWAY_VOLUME_PATH);
const IS_PRODUCTION = process.env.NODE_ENV === "production" || IS_VERCEL;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : RAILWAY_VOLUME_PATH
    ? path.join(RAILWAY_VOLUME_PATH, "data")
    : IS_VERCEL
    ? path.join(os.tmpdir(), "gstore-data")
    : path.join(ROOT_DIR, "data");
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : RAILWAY_VOLUME_PATH
    ? path.join(RAILWAY_VOLUME_PATH, "uploads")
    : IS_VERCEL
    ? path.join(os.tmpdir(), "gstore-uploads")
    : path.join(PUBLIC_DIR, "uploads");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

const db = new DatabaseSync(path.join(DATA_DIR, "gstore.db"));

const PORT = Number(process.env.PORT || 4321);
const STORE_NAME = process.env.STORE_NAME || "GStore";
const CURRENCY = process.env.STORE_CURRENCY || "USD";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const STORE_TIME_ZONE = process.env.STORE_TIME_ZONE || "America/Guayaquil";
const ADMIN_SESSION_HOURS = Math.max(1, Math.min(24, Number(process.env.ADMIN_SESSION_HOURS || 8)));
const ADMIN_SECRET = cleanEnvSecret("ADMIN_SECRET", process.env.ADMIN_SECRET, "dev-secret");
const ADMIN_PASSWORD = cleanText(process.env.ADMIN_PASSWORD || "");
const ADMIN_COOKIE_NAME = "gstore_admin_session";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((req, res, next) => {
  applySecurityHeaders(req, res);
  return next();
});

app.use((req, res, next) => {
  const origin = req.get("Origin");
  const allowedOrigin = allowedCorsOrigin(origin);
  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  if (origin && !allowedOrigin && !isReadRequest(req)) {
    return next(httpError(403, "Origen no autorizado."));
  }
  return next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get(/^\/admin(?:-[a-z]+)?\.html$/, (req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});

app.use("/uploads", express.static(UPLOAD_DIR, {
  fallthrough: false,
  maxAge: IS_PRODUCTION ? "7d" : 0,
  setHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", IS_PRODUCTION ? "public, max-age=604800" : "no-cache");
  }
}));

app.use(express.static(PUBLIC_DIR, {
  extensions: ["html"],
  setHeaders(res, filePath) {
    if (/admin(?:-[a-z]+)?\.html$/.test(filePath)) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
    }
  }
}));

function now() {
  return new Date().toISOString();
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function cleanEnvSecret(name, value, fallback = "") {
  const secret = cleanText(value);
  if (IS_PRODUCTION && secret.length < 32) {
    throw new Error(`${name} debe tener minimo 32 caracteres para produccion.`);
  }
  return secret || fallback;
}

function configuredOrigins() {
  const origins = new Set();
  if (PUBLIC_BASE_URL) origins.add(PUBLIC_BASE_URL);
  if (process.env.VERCEL_URL) origins.add(`https://${process.env.VERCEL_URL.replace(/\/$/, "")}`);
  if (process.env.VERCEL_BRANCH_URL) origins.add(`https://${process.env.VERCEL_BRANCH_URL.replace(/\/$/, "")}`);
  String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
    .forEach((origin) => origins.add(origin));
  if (!IS_PRODUCTION) {
    origins.add(`http://localhost:${PORT}`);
    origins.add(`http://127.0.0.1:${PORT}`);
    origins.add("null");
  }
  return origins;
}

function allowedCorsOrigin(origin) {
  if (!origin) return "";
  const cleanOrigin = origin.replace(/\/$/, "");
  return configuredOrigins().has(cleanOrigin) ? cleanOrigin : "";
}

function isReadRequest(req) {
  return req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
}

function isUnsafeRequest(req) {
  return !isReadRequest(req);
}

function applySecurityHeaders(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (IS_PRODUCTION) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "connect-src 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join("; "));
  if (req.path.startsWith("/api/admin/") || /^\/admin(?:-[a-z]+)?\.html$/.test(req.path)) {
    res.setHeader("Cache-Control", "no-store");
  }
}

function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = `${req.ip || req.socket.remoteAddress || "local"}:${req.path}`;
    const nowMs = Date.now();
    const record = hits.get(key) || { count: 0, resetAt: nowMs + windowMs };
    if (record.resetAt <= nowMs) {
      record.count = 0;
      record.resetAt = nowMs + windowMs;
    }
    record.count += 1;
    hits.set(key, record);
    if (record.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((record.resetAt - nowMs) / 1000)));
      return next(httpError(429, message));
    }
    return next();
  };
}

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 7,
  message: "Demasiados intentos. Espera unos minutos antes de volver a entrar."
});

const checkoutLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 24,
  message: "Demasiadas solicitudes de pedido. Intenta nuevamente en unos minutos."
});

function parseCookies(header = "") {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index === -1) return cookies;
      const name = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
      return cookies;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}

function setAdminSessionCookie(res, token, expiresAt) {
  const cookieOptions = {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "Strict",
    path: "/",
    expires: new Date(expiresAt),
    maxAge: Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
  };
  if (process.env.ADMIN_COOKIE_DOMAIN) cookieOptions.domain = process.env.ADMIN_COOKIE_DOMAIN;
  res.setHeader("Set-Cookie", serializeCookie(ADMIN_COOKIE_NAME, token, cookieOptions));
}

function clearAdminSessionCookie(res) {
  const cookieOptions = {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "Strict",
    path: "/",
    expires: new Date(0),
    maxAge: 0
  };
  if (process.env.ADMIN_COOKIE_DOMAIN) cookieOptions.domain = process.env.ADMIN_COOKIE_DOMAIN;
  res.setHeader("Set-Cookie", serializeCookie(ADMIN_COOKIE_NAME, "", cookieOptions));
}

function csrfMatches(expected, provided) {
  const expectedBuffer = Buffer.from(String(expected || ""));
  const providedBuffer = Buffer.from(String(provided || ""));
  if (!expectedBuffer.length || expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function slugify(value) {
  const base = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return base || `item-${Date.now()}`;
}

function parseJsonList(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function incomingList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatMoney(value) {
  return money(value).toFixed(2);
}

function boolToInt(value) {
  return value === true || value === "true" || value === "1" || value === 1 ? 1 : 0;
}

function cleanText(value, fallback = "") {
  return String(value || fallback).trim();
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

function publicOrder(order) {
  if (!order) return null;
  const publicItems = parseJsonList(order.items_json).map((item) => ({
    product_id: item.product_id,
    name: item.name,
    sku: item.sku,
    image_url: item.image_url,
    price: item.price,
    quantity: item.quantity,
    size: item.size,
    color: item.color,
    line_total: item.line_total
  }));
  return {
    id: order.id,
    order_code: order.order_code,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    customer_email: order.customer_email,
    customer_address: order.customer_address,
    customer_city: order.customer_city,
    delivery_method: order.delivery_method || "delivery",
    notes: order.notes,
    items: publicItems,
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    status: order.status,
    source: order.source,
    created_at: order.created_at,
    updated_at: order.updated_at
  };
}

function productFromRow(row, options = {}) {
  if (!row) return null;
  const product = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || "",
    price: row.price,
    compare_price: row.compare_price || 0,
    stock: row.stock,
    sku: row.sku || "",
    image_url: row.image_url || "/assets/product-placeholder.svg",
    sizes: parseJsonList(row.sizes_json),
    colors: parseJsonList(row.colors_json),
    active: Boolean(row.active),
    featured: Boolean(row.featured),
    promo_type: normalizePromoType(row.promo_type),
    promo_label: row.promo_label || "",
    category: row.category_id ? {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug
    } : null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
  if (options.includePrivate) {
    product.cost_price = row.cost_price || 0;
  }
  return product;
}

function normalizePromoType(value) {
  const type = cleanText(value).toLowerCase();
  return ["none", "discount", "last_units", "new_arrival"].includes(type) ? type : "none";
}

function promoLabelFor(type, fallback = "") {
  const custom = cleanText(fallback);
  if (custom) return custom;
  if (type === "discount") return "Oferta limitada";
  if (type === "last_units") return "Últimas unidades";
  if (type === "new_arrival") return "Recién llegado";
  return "";
}

function categoryFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || "",
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function ensureSchema() {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      cost_price REAL NOT NULL DEFAULT 0,
      compare_price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      sku TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      sizes_json TEXT DEFAULT '[]',
      colors_json TEXT DEFAULT '[]',
      promo_type TEXT DEFAULT 'none',
      promo_label TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      featured INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT DEFAULT '',
      customer_address TEXT DEFAULT '',
      customer_city TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      items_json TEXT NOT NULL,
      subtotal REAL NOT NULL,
      shipping REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      status TEXT NOT NULL DEFAULT 'new',
      source TEXT DEFAULT 'storefront',
      paypal_order_id TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const orderColumns = new Set(db.prepare("PRAGMA table_info(orders)").all().map((column) => column.name));
  if (!orderColumns.has("delivery_method")) {
    db.exec("ALTER TABLE orders ADD COLUMN delivery_method TEXT DEFAULT 'delivery'");
  }

  const productColumns = new Set(db.prepare("PRAGMA table_info(products)").all().map((column) => column.name));
  if (!productColumns.has("cost_price")) {
    db.exec("ALTER TABLE products ADD COLUMN cost_price REAL NOT NULL DEFAULT 0");
  }
  if (!productColumns.has("compare_price")) {
    db.exec("ALTER TABLE products ADD COLUMN compare_price REAL NOT NULL DEFAULT 0");
  }
  if (!productColumns.has("promo_type")) {
    db.exec("ALTER TABLE products ADD COLUMN promo_type TEXT DEFAULT 'none'");
  }
  if (!productColumns.has("promo_label")) {
    db.exec("ALTER TABLE products ADD COLUMN promo_label TEXT DEFAULT ''");
  }

  const promoCount = db.prepare(`
    SELECT COUNT(*) AS count
    FROM products
    WHERE promo_type != 'none' OR promo_label != '' OR compare_price > price
  `).get().count;
  if (promoCount === 0) {
    db.prepare(`
      UPDATE products
      SET compare_price = 72, promo_type = 'discount', promo_label = 'Precio especial'
      WHERE sku = 'GS-VES-002'
    `).run();
    db.prepare(`
      UPDATE products
      SET promo_type = 'last_units', promo_label = 'Últimas unidades'
      WHERE stock <= 2
    `).run();
  }

  db.prepare("UPDATE products SET cost_price = 28 WHERE sku = 'GS-SET-001' AND cost_price = 0").run();
  db.prepare("UPDATE products SET cost_price = 34 WHERE sku = 'GS-VES-002' AND cost_price = 0").run();
  db.prepare("UPDATE products SET cost_price = 24 WHERE sku = 'GS-ZAP-003' AND cost_price = 0").run();
  db.prepare("UPDATE products SET cost_price = 18 WHERE sku = 'GS-CAR-004' AND cost_price = 0").run();
  db.prepare("UPDATE products SET cost_price = 7 WHERE sku = 'GS-ACC-005' AND cost_price = 0").run();
}

function ensureUniqueSlug(table, source, currentId = null) {
  const base = slugify(source);
  let candidate = base;
  let counter = 2;
  const statement = db.prepare(`SELECT id FROM ${table} WHERE slug = ?`);
  while (true) {
    const found = statement.get(candidate);
    if (!found || (currentId && Number(found.id) === Number(currentId))) return candidate;
    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

function seedData() {
  const categoryCount = db.prepare("SELECT COUNT(*) AS count FROM categories").get().count;
  if (categoryCount === 0) {
    const insertCategory = db.prepare(`
      INSERT INTO categories (name, slug, description, active, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `);
    [
      ["Ropa", "Prendas importadas para looks de diario y salidas especiales."],
      ["Zapatos", "Pares seleccionados para combinar con pocas piezas y verse bien."],
      ["Carteras", "Carteras y bolsos fáciles de usar, cuidar y regalar."],
      ["Accesorios", "Detalles pequeños que terminan el outfit."]
    ].forEach(([name, description]) => {
      insertCategory.run(name, ensureUniqueSlug("categories", name), description, now(), now());
    });
  }

  const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  if (productCount === 0) {
    const categoryBySlug = db.prepare("SELECT id FROM categories WHERE slug = ?");
    const insertProduct = db.prepare(`
      INSERT INTO products (
        category_id, name, slug, description, price, cost_price, compare_price, stock, sku, image_url,
        sizes_json, colors_json, promo_type, promo_label, active, featured, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);

    const products = [
      {
        category: "ropa",
        name: "Set blanco casual",
        description: "Conjunto suave para viajar, salir o resolver el día sin pensar demasiado.",
        price: 49,
        costPrice: 28,
        comparePrice: 0,
        stock: 4,
        sku: "GS-SET-001",
        image: "/assets/product-set.svg",
        sizes: ["XS", "S", "M", "L"],
        colors: ["Blanco", "Arena"],
        promoType: "none",
        promoLabel: "",
        featured: 1
      },
      {
        category: "ropa",
        name: "Vestido dorado suave",
        description: "Vestido ligero con caída limpia, pensado para una salida bonita sin exagerar.",
        price: 58,
        costPrice: 34,
        comparePrice: 72,
        stock: 3,
        sku: "GS-VES-002",
        image: "/assets/product-dress.svg",
        sizes: ["S", "M", "L", "8", "10"],
        colors: ["Champagne", "Negro"],
        promoType: "discount",
        promoLabel: "Precio especial",
        featured: 1
      },
      {
        category: "zapatos",
        name: "Sandalias nude",
        description: "Sandalias cómodas con brillo discreto para combinar con casi todo.",
        price: 42,
        costPrice: 24,
        comparePrice: 0,
        stock: 5,
        sku: "GS-ZAP-003",
        image: "/assets/product-heels.svg",
        sizes: ["36", "37", "38", "39", "40"],
        colors: ["Nude", "Dorado"],
        promoType: "none",
        promoLabel: "",
        featured: 0
      },
      {
        category: "carteras",
        name: "Cartera mini champagne",
        description: "Pequeña, elegante y fácil de llevar cuando solo necesitas lo esencial.",
        price: 35,
        costPrice: 18,
        comparePrice: 0,
        stock: 2,
        sku: "GS-CAR-004",
        image: "/assets/product-bag.svg",
        sizes: [],
        colors: ["Champagne", "Café"],
        promoType: "last_units",
        promoLabel: "Últimas unidades",
        featured: 1
      },
      {
        category: "accesorios",
        name: "Set de aretes dorados",
        description: "Accesorios con brillo cálido para completar looks sencillos.",
        price: 18,
        costPrice: 7,
        comparePrice: 0,
        stock: 8,
        sku: "GS-ACC-005",
        image: "/assets/product-accessories.svg",
        sizes: [],
        colors: ["Dorado"],
        promoType: "none",
        promoLabel: "",
        featured: 0
      }
    ];

    products.forEach((product) => {
      const category = categoryBySlug.get(product.category);
      insertProduct.run(
        category ? category.id : null,
        product.name,
        ensureUniqueSlug("products", product.name),
        product.description,
        product.price,
        product.costPrice,
        product.comparePrice,
        product.stock,
        product.sku,
        product.image,
        JSON.stringify(product.sizes),
        JSON.stringify(product.colors),
        product.promoType,
        product.promoLabel,
        product.featured,
        now(),
        now()
      );
    });
  }
}

function getProducts({ includeInactive = false, includePrivate = false } = {}) {
  const sql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${includeInactive ? "" : "WHERE p.active = 1"}
    ORDER BY p.featured DESC, p.updated_at DESC, p.id DESC
  `;
  return db.prepare(sql).all().map((row) => productFromRow(row, { includePrivate }));
}

function getProductPrivateIndex() {
  const rows = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
  `).all();
  const index = new Map();
  rows.forEach((row) => {
    index.set(Number(row.id), productFromRow(row, { includePrivate: true }));
  });
  return index;
}

function getProductById(id, options = {}) {
  return productFromRow(db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = ?
  `).get(id), options);
}

function getOrderByCode(code) {
  return db.prepare("SELECT * FROM orders WHERE order_code = ?").get(code);
}

function getOrderById(id) {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
}

function createOrderCode() {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `GS-${stamp}-${random}`;
}

function normalizeDeliveryMethod(value) {
  return cleanText(value) === "pickup" ? "pickup" : "delivery";
}

function numericValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function dayKey(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function shiftDayKey(key, offset) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}

function dayLabel(key) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(`${key}T12:00:00Z`));
}

function recentDayBuckets(days = 7) {
  const buckets = new Map();
  const todayKey = dayKey(new Date());
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const key = shiftDayKey(todayKey, -offset);
    buckets.set(key, {
      date: key,
      label: dayLabel(key),
      sales: 0,
      profit: 0,
      orders: 0
    });
  }
  return buckets;
}

function orderFinancials(order, productIndex) {
  const items = parseJsonList(order.items_json);
  const lines = items.map((item) => {
    const product = productIndex.get(Number(item.product_id));
    const quantity = Math.max(0, numericValue(item.quantity, 0));
    const unitPrice = numericValue(item.price, product?.price || 0);
    const storedCost = Number.isFinite(Number(item.cost_price)) ? Number(item.cost_price) : null;
    const unitCost = storedCost !== null ? storedCost : numericValue(product?.cost_price, 0);
    const sales = money(Number.isFinite(Number(item.line_total)) ? Number(item.line_total) : unitPrice * quantity);
    const cost = money(Number.isFinite(Number(item.line_cost)) ? Number(item.line_cost) : unitCost * quantity);
    const profit = money(Number.isFinite(Number(item.line_profit)) ? Number(item.line_profit) : sales - cost);
    return {
      product_id: Number(item.product_id || 0),
      name: cleanText(item.name || product?.name, "Producto sin nombre"),
      sku: cleanText(item.sku || product?.sku),
      category: cleanText(product?.category?.name, "Sin categoría"),
      quantity,
      sales,
      cost,
      profit
    };
  });

  return lines.reduce((total, line) => ({
    lines: total.lines.concat(line),
    quantity: total.quantity + line.quantity,
    sales: money(total.sales + line.sales),
    cost: money(total.cost + line.cost),
    profit: money(total.profit + line.profit)
  }), { lines: [], quantity: 0, sales: 0, cost: 0, profit: 0 });
}

function validateCustomer(input, deliveryMethod = "delivery") {
  const customer = {
    name: cleanText(input.name),
    phone: normalizePhone(input.phone),
    email: cleanText(input.email),
    address: cleanText(input.address),
    city: cleanText(input.city || "Guayaquil"),
    notes: cleanText(input.notes)
  };

  if (customer.name.length < 2) throw httpError(400, "Escribe el nombre de quien recibe el pedido.");
  if (customer.phone.length < 7) throw httpError(400, "Escribe un teléfono válido para coordinar el pedido.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    throw httpError(400, "Escribe un correo electrónico válido para confirmar el pedido.");
  }
  if (deliveryMethod === "delivery" && customer.address.length < 4) {
    throw httpError(400, "Escribe una dirección o referencia para el envío.");
  }
  return customer;
}

function calculateCart(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw httpError(400, "El carrito está vacío.");
  }

  const findProduct = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = ? AND p.active = 1
  `);

  const items = rawItems.map((item) => {
    const product = productFromRow(findProduct.get(Number(item.productId || item.id)), { includePrivate: true });
    if (!product) throw httpError(404, "Uno de los productos ya no está disponible.");

    const quantity = Math.max(1, Math.min(99, Number(item.quantity || 1)));
    if (quantity > product.stock) {
      throw httpError(409, `${product.name} solo tiene ${product.stock} disponible.`);
    }

    const size = cleanText(item.size);
    const color = cleanText(item.color);

    if (product.sizes.length && !size) {
      throw httpError(400, `Elige talla para ${product.name}.`);
    }
    if (product.sizes.length && !product.sizes.includes(size)) {
      throw httpError(400, `La talla seleccionada para ${product.name} no está disponible.`);
    }
    if (product.colors.length && !color) {
      throw httpError(400, `Elige color para ${product.name}.`);
    }
    if (product.colors.length && !product.colors.includes(color)) {
      throw httpError(400, `El color seleccionado para ${product.name} no está disponible.`);
    }

    const lineTotal = money(product.price * quantity);
    const lineCost = money((product.cost_price || 0) * quantity);
    return {
      product_id: product.id,
      name: product.name,
      sku: product.sku,
      image_url: product.image_url,
      price: product.price,
      cost_price: product.cost_price || 0,
      quantity,
      size,
      color,
      line_total: lineTotal,
      line_cost: lineCost,
      line_profit: money(lineTotal - lineCost)
    };
  });

  const subtotal = money(items.reduce((sum, item) => sum + item.line_total, 0));
  const shipping = money(process.env.DEFAULT_SHIPPING || 0);
  return {
    items,
    subtotal,
    shipping,
    total: money(subtotal + shipping)
  };
}

function decrementStock(items) {
  const update = db.prepare(`
    UPDATE products
    SET stock = CASE WHEN stock - ? < 0 THEN 0 ELSE stock - ? END,
        updated_at = ?
    WHERE id = ?
  `);
  items.forEach((item) => update.run(item.quantity, item.quantity, now(), item.product_id));
}

function insertOrder({ customer, cart, deliveryMethod, paymentMethod, paymentStatus, status, source, paypalOrderId = "" }) {
  const code = createOrderCode();
  const result = db.prepare(`
    INSERT INTO orders (
      order_code, customer_name, customer_phone, customer_email, customer_address, customer_city, delivery_method,
      notes, items_json, subtotal, shipping, total, payment_method, payment_status, status,
      source, paypal_order_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    code,
    customer.name,
    customer.phone,
    customer.email,
    customer.address,
    customer.city,
    normalizeDeliveryMethod(deliveryMethod),
    customer.notes,
    JSON.stringify(cart.items),
    cart.subtotal,
    cart.shipping,
    cart.total,
    paymentMethod,
    paymentStatus,
    status,
    source,
    paypalOrderId,
    now(),
    now()
  );

  return getOrderById(result.lastInsertRowid);
}

function buildWhatsappMessage(order) {
  const deliveryMethod = normalizeDeliveryMethod(order.delivery_method);
  const items = parseJsonList(order.items_json)
    .map((item) => {
      const variants = [item.size && `Talla ${item.size}`, item.color && `Color ${item.color}`]
        .filter(Boolean)
        .join(", ");
      return `- ${item.quantity} x ${item.name}${variants ? ` (${variants})` : ""}: $${formatMoney(item.line_total)}`;
    })
    .join("\n");

  return [
    `Hola, quiero hacer este pedido en ${STORE_NAME}:`,
    "",
    `Pedido: ${order.order_code}`,
    items,
    "",
    `Total: $${formatMoney(order.total)} ${CURRENCY}`,
    `Nombre: ${order.customer_name}`,
    `Teléfono: ${order.customer_phone}`,
    `Correo: ${order.customer_email}`,
    `Entrega: ${deliveryMethod === "pickup" ? "Retiro coordinado por WhatsApp" : "Envío a domicilio"}`,
    order.customer_city ? `Ciudad: ${order.customer_city}` : "",
    deliveryMethod === "delivery" && order.customer_address ? `Dirección: ${order.customer_address}` : "",
    order.notes ? `Nota: ${order.notes}` : "",
    "",
    "Quedó pendiente de confirmación."
  ].filter(Boolean).join("\n");
}

function getWhatsappUrl(order) {
  const phone = normalizePhone(process.env.WHATSAPP_ADMIN_PHONE);
  if (!phone) throw httpError(500, "Falta configurar WHATSAPP_ADMIN_PHONE en el backend.");
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsappMessage(order))}`;
}

async function sendOrderEmail(order) {
  const apiKey = process.env.RESEND_API_KEY;
  const ownerEmail = cleanText(process.env.RESEND_TO_EMAIL || process.env.STORE_OWNER_EMAIL);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "GStore <onboarding@resend.dev>";
  const replyToEmail = cleanText(process.env.RESEND_REPLY_TO_EMAIL || order.customer_email);
  if (!apiKey || !ownerEmail) return { skipped: true };

  const items = parseJsonList(order.items_json)
    .map((item) => `${item.quantity} x ${item.name} - $${formatMoney(item.line_total)}`)
    .join("\n");

  const text = [
    `Nuevo pedido ${order.order_code}`,
    "",
    `Cliente: ${order.customer_name}`,
    `Teléfono: ${order.customer_phone}`,
    order.customer_email ? `Correo: ${order.customer_email}` : "",
    `Entrega: ${normalizeDeliveryMethod(order.delivery_method) === "pickup" ? "Retiro coordinado por WhatsApp" : "Envío a domicilio"}`,
    order.customer_city ? `Ciudad: ${order.customer_city}` : "",
    normalizeDeliveryMethod(order.delivery_method) === "delivery" && order.customer_address ? `Dirección: ${order.customer_address}` : "",
    "",
    items,
    "",
    `Total: $${formatMoney(order.total)} ${CURRENCY}`,
    `Método: ${order.payment_method}`,
    `Estado de pago: ${order.payment_status}`
  ].filter(Boolean).join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: ownerEmail,
      reply_to: replyToEmail || undefined,
      subject: `${STORE_NAME}: nuevo pedido ${order.order_code}`,
      text
    })
  });

  if (!response.ok) {
    const message = await response.text();
    console.warn("Resend no pudo enviar la notificacion:", message);
    return { ok: false, message };
  }

  return response.json();
}

function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

function paypalBaseUrl() {
  return process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function paypalAccessToken() {
  if (!paypalConfigured()) throw httpError(400, "PayPal todavía no está configurado.");
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(502, data.error_description || "PayPal no entrego token de acceso.");
  return data.access_token;
}

async function createPaypalOrder(order) {
  const token = await paypalAccessToken();
  const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: order.order_code,
          custom_id: order.order_code,
          description: `${STORE_NAME} ${order.order_code}`,
          amount: {
            currency_code: CURRENCY,
            value: formatMoney(order.total)
          }
        }
      ],
      application_context: {
        brand_name: STORE_NAME,
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: `${PUBLIC_BASE_URL}/success.html?paypal=1&order=${encodeURIComponent(order.order_code)}`,
        cancel_url: `${PUBLIC_BASE_URL}/success.html?cancelled=1&order=${encodeURIComponent(order.order_code)}`
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(502, data.message || "PayPal no pudo crear la orden.");
  const approvalUrl = (data.links || []).find((link) => link.rel === "approve")?.href;
  if (!approvalUrl) throw httpError(502, "PayPal no devolvió enlace de aprobación.");
  return { paypalOrderId: data.id, approvalUrl, raw: data };
}

async function capturePaypalOrder(paypalOrderId) {
  const token = await paypalAccessToken();
  const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(502, data.message || "PayPal no pudo capturar el pago.");
  return data;
}

function base64url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signToken(payload) {
  const body = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", ADMIN_SECRET)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = crypto
    .createHmac("sha256", ADMIN_SECRET)
    .update(body)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (payload.role !== "admin") return null;
    return payload;
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req.get("Cookie") || "");
  const cookieToken = cookies[ADMIN_COOKIE_NAME] || "";
  const header = req.get("Authorization") || "";
  const bearerToken = !IS_PRODUCTION && header.startsWith("Bearer ") ? header.slice(7) : "";
  const token = cookieToken || bearerToken;
  const payload = verifyToken(token);
  if (!payload) return next(httpError(401, "Sesion expirada. Vuelve a entrar al panel."));
  if (cookieToken && isUnsafeRequest(req) && !csrfMatches(payload.csrf, req.get("X-CSRF-Token"))) {
    return next(httpError(403, "Sesion protegida. Recarga el panel y vuelve a intentar."));
  }
  req.admin = payload;
  return next();
}

function passwordMatches(value) {
  const expected = Buffer.from(ADMIN_PASSWORD);
  const provided = Buffer.from(String(value || ""));
  if (!expected.length || expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}

function adminEmailMatches(value) {
  const expected = cleanText(process.env.ADMIN_EMAIL || process.env.STORE_OWNER_EMAIL).toLowerCase();
  const provided = cleanText(value).toLowerCase();
  return Boolean(expected && provided && expected === provided);
}

function localUpload(file) {
  if (IS_VERCEL || (IS_PRODUCTION && !RAILWAY_VOLUME_PATH && !process.env.UPLOAD_DIR)) {
    throw httpError(500, "Configura Cloudinary o un volumen persistente para subir imagenes en produccion.");
  }
  const original = path.basename(file.originalname || "imagen.jpg");
  const ext = path.extname(original).toLowerCase() || ".jpg";
  const safeName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext.replace(/[^.\w]/g, "")}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, safeName), file.buffer);
  return { url: `/uploads/${safeName}`, provider: "local" };
}

function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

async function uploadToCloudinary(file) {
  if (!cloudinaryConfigured()) return localUpload(file);

  const timestamp = Math.round(Date.now() / 1000);
  const folder = process.env.CLOUDINARY_FOLDER || "gstore";
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");
  const form = new FormData();

  form.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname || "producto.jpg");
  form.append("api_key", process.env.CLOUDINARY_API_KEY);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: form
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(502, data.error?.message || "Cloudinary no pudo subir la imagen.");
  return { url: data.secure_url, provider: "cloudinary", public_id: data.public_id };
}

function assertSafeImageUpload(file) {
  if (!file) throw httpError(400, "Sube una imagen.");
  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
    throw httpError(400, "La imagen debe ser JPG, PNG o WebP.");
  }

  const buffer = file.buffer || Buffer.alloc(0);
  const isJpg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  const allowedByBytes = {
    "image/jpeg": isJpg,
    "image/png": isPng,
    "image/webp": isWebp
  };

  if (!allowedByBytes[file.mimetype]) {
    throw httpError(400, "El contenido del archivo no coincide con una imagen valida.");
  }
}

function validateProductionConfig() {
  if (!IS_PRODUCTION) return;
  const missing = [];
  if (!cleanText(process.env.ADMIN_EMAIL || process.env.STORE_OWNER_EMAIL)) missing.push("ADMIN_EMAIL");
  if (ADMIN_PASSWORD.length < 12) missing.push("ADMIN_PASSWORD de minimo 12 caracteres");
  if (!process.env.PUBLIC_BASE_URL || /localhost|127\.0\.0\.1/.test(process.env.PUBLIC_BASE_URL)) missing.push("PUBLIC_BASE_URL real");
  if (IS_VERCEL && !cloudinaryConfigured()) missing.push("Cloudinary para imagenes persistentes");
  if (IS_RAILWAY && !RAILWAY_VOLUME_PATH && !process.env.DATA_DIR) missing.push("volumen Railway o DATA_DIR persistente");
  if (missing.length) {
    throw new Error(`Configuracion de produccion incompleta: ${missing.join(", ")}.`);
  }
}

validateProductionConfig();
ensureSchema();
seedData();

app.get("/api/health", (req, res) => {
  res.json({ ok: true, store: STORE_NAME, time: now() });
});

app.get("/api/config", (req, res) => {
  res.json({
    storeName: STORE_NAME,
    currency: CURRENCY,
    paypalEnabled: paypalConfigured()
  });
});

app.get("/api/categories", (req, res) => {
  const categories = db.prepare("SELECT * FROM categories WHERE active = 1 ORDER BY name ASC").all().map(categoryFromRow);
  res.json({ categories });
});

app.get("/api/products", (req, res) => {
  res.json({ products: getProducts({ includeInactive: false }) });
});

app.get("/api/products/:slug", (req, res, next) => {
  const row = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.slug = ? AND p.active = 1
  `).get(req.params.slug);
  const product = productFromRow(row);
  if (!product) return next(httpError(404, "Producto no encontrado."));
  res.json({ product });
});

app.get("/api/orders/:code", (req, res, next) => {
  const order = getOrderByCode(req.params.code);
  if (!order) return next(httpError(404, "Pedido no encontrado."));
  res.json({ order: publicOrder(order) });
});

app.post("/api/orders/whatsapp", checkoutLimiter, asyncHandler(async (req, res) => {
  const deliveryMethod = normalizeDeliveryMethod(req.body.delivery_method);
  const customer = validateCustomer(req.body.customer || {}, deliveryMethod);
  const cart = calculateCart(req.body.items || []);
  const order = insertOrder({
    customer,
    cart,
    deliveryMethod,
    paymentMethod: "whatsapp",
    paymentStatus: "pending",
    status: "new",
    source: "storefront"
  });

  decrementStock(cart.items);
  sendOrderEmail(order).catch((error) => console.warn(error.message));
  res.status(201).json({
    order: publicOrder(order),
    whatsappUrl: getWhatsappUrl(order)
  });
}));

app.post("/api/paypal/create-order", checkoutLimiter, asyncHandler(async (req, res) => {
  if (!paypalConfigured()) throw httpError(400, "PayPal está listo en código, pero faltan credenciales en .env.");
  const deliveryMethod = normalizeDeliveryMethod(req.body.delivery_method);
  if (deliveryMethod === "pickup") {
    throw httpError(400, "Para retiro, confirma el pedido por WhatsApp para coordinar directamente.");
  }
  const customer = validateCustomer(req.body.customer || {}, deliveryMethod);
  const cart = calculateCart(req.body.items || []);

  const draftOrder = {
    order_code: createOrderCode(),
    total: cart.total
  };
  const paypalOrder = await createPaypalOrder(draftOrder);

  const order = insertOrder({
    customer,
    cart,
    deliveryMethod,
    paymentMethod: "paypal",
    paymentStatus: "pending",
    status: "waiting_payment",
    source: "storefront",
    paypalOrderId: paypalOrder.paypalOrderId
  });

  db.prepare("UPDATE orders SET order_code = ?, updated_at = ? WHERE id = ?")
    .run(draftOrder.order_code, now(), order.id);

  res.status(201).json({
    order: publicOrder(getOrderById(order.id)),
    paypalOrderId: paypalOrder.paypalOrderId,
    approvalUrl: paypalOrder.approvalUrl
  });
}));

app.post("/api/paypal/capture", checkoutLimiter, asyncHandler(async (req, res) => {
  const paypalOrderId = cleanText(req.body.paypalOrderId || req.body.token);
  if (!paypalOrderId) throw httpError(400, "Falta el id de la orden PayPal.");

  const order = db.prepare("SELECT * FROM orders WHERE paypal_order_id = ?").get(paypalOrderId);
  if (!order) throw httpError(404, "No encontramos el pedido local de PayPal.");
  if (order.payment_status === "paid") {
    return res.json({ order: publicOrder(order), capture: { status: "ALREADY_CAPTURED" } });
  }

  const capture = await capturePaypalOrder(paypalOrderId);
  const status = capture.status === "COMPLETED" ? "paid" : "pending";
  const nextOrderStatus = status === "paid" ? "paid" : "waiting_payment";

  db.prepare(`
    UPDATE orders
    SET payment_status = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(status, nextOrderStatus, now(), order.id);

  if (status === "paid") {
    decrementStock(parseJsonList(order.items_json));
    sendOrderEmail(getOrderById(order.id)).catch((error) => console.warn(error.message));
  }

  res.json({ order: publicOrder(getOrderById(order.id)), capture });
}));

app.post("/api/admin/login", loginLimiter, (req, res, next) => {
  if (!adminEmailMatches(req.body.email) || !passwordMatches(req.body.password)) {
    return next(httpError(401, "Correo o clave incorrectos."));
  }
  const expiresAt = Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000;
  const csrfToken = crypto.randomBytes(32).toString("base64url");
  const token = signToken({
    role: "admin",
    email: cleanText(req.body.email).toLowerCase(),
    csrf: csrfToken,
    exp: expiresAt
  });
  setAdminSessionCookie(res, token, expiresAt);
  res.json({
    ok: true,
    csrfToken,
    expiresAt
  });
});

app.get("/api/admin/session", requireAdmin, (req, res) => {
  res.json({
    ok: true,
    email: req.admin.email,
    csrfToken: req.admin.csrf,
    expiresAt: req.admin.exp
  });
});

app.post("/api/admin/logout", (req, res) => {
  clearAdminSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/admin/summary", requireAdmin, (req, res) => {
  const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  const activeProducts = db.prepare("SELECT COUNT(*) AS count FROM products WHERE active = 1").get().count;
  const orderCount = db.prepare("SELECT COUNT(*) AS count FROM orders").get().count;
  const pendingOrders = db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status IN ('new', 'waiting_payment')").get().count;
  const revenue = db.prepare("SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE payment_status = 'paid'").get().total;
  res.json({ productCount, activeProducts, orderCount, pendingOrders, revenue: money(revenue) });
});

app.get("/api/admin/analytics", requireAdmin, (req, res) => {
  const statusLabels = {
    new: "Nuevo",
    waiting_payment: "Esperando pago",
    paid: "Pagado",
    preparing: "Preparando",
    ready: "Listo",
    sent: "Enviado",
    completed: "Completado",
    cancelled: "Cancelado"
  };
  const productIndex = getProductPrivateIndex();
  const products = Array.from(productIndex.values());
  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at ASC").all();
  const activeOrders = orders.filter((order) => order.status !== "cancelled");
  const paidOrders = activeOrders.filter((order) => order.payment_status === "paid");
  const dayBuckets = recentDayBuckets(7);
  const productProfit = new Map();
  const categoryProfit = new Map();

  let sales = 0;
  let cost = 0;
  let estimatedProfit = 0;
  let paidSales = 0;
  let paidProfit = 0;

  activeOrders.forEach((order) => {
    const financials = orderFinancials(order, productIndex);
    sales = money(sales + financials.sales);
    cost = money(cost + financials.cost);
    estimatedProfit = money(estimatedProfit + financials.profit);

    if (order.payment_status === "paid") {
      paidSales = money(paidSales + financials.sales);
      paidProfit = money(paidProfit + financials.profit);
    }

    const key = dayKey(order.created_at);
    if (dayBuckets.has(key)) {
      const bucket = dayBuckets.get(key);
      bucket.sales = money(bucket.sales + financials.sales);
      bucket.profit = money(bucket.profit + financials.profit);
      bucket.orders += 1;
    }

    financials.lines.forEach((line) => {
      const productKey = line.product_id || line.sku || line.name;
      const current = productProfit.get(productKey) || {
        name: line.name,
        sku: line.sku,
        quantity: 0,
        sales: 0,
        profit: 0
      };
      current.quantity += line.quantity;
      current.sales = money(current.sales + line.sales);
      current.profit = money(current.profit + line.profit);
      productProfit.set(productKey, current);
    });
  });

  products.forEach((product) => {
    const category = product.category?.name || "Sin categoría";
    const current = categoryProfit.get(category) || {
      category,
      stock: 0,
      inventoryValue: 0,
      inventoryCost: 0,
      potentialProfit: 0
    };
    const stock = Math.max(0, numericValue(product.stock, 0));
    const value = money(stock * numericValue(product.price, 0));
    const productCost = money(stock * numericValue(product.cost_price, 0));
    current.stock += stock;
    current.inventoryValue = money(current.inventoryValue + value);
    current.inventoryCost = money(current.inventoryCost + productCost);
    current.potentialProfit = money(current.potentialProfit + value - productCost);
    categoryProfit.set(category, current);
  });

  const inventoryValue = money(products.reduce((sum, product) => sum + Math.max(0, numericValue(product.stock, 0)) * numericValue(product.price, 0), 0));
  const inventoryCost = money(products.reduce((sum, product) => sum + Math.max(0, numericValue(product.stock, 0)) * numericValue(product.cost_price, 0), 0));
  const inventoryPotentialProfit = money(inventoryValue - inventoryCost);
  const orderStatus = Object.entries(statusLabels)
    .map(([status, label]) => ({
      status,
      label,
      count: orders.filter((order) => order.status === status).length
    }))
    .filter((item) => item.count > 0);

  res.json({
    totals: {
      sales,
      cost,
      paidSales,
      estimatedProfit,
      paidProfit,
      pendingProfit: money(estimatedProfit - paidProfit),
      margin: sales > 0 ? money((estimatedProfit / sales) * 100) : 0,
      inventoryValue,
      inventoryCost,
      inventoryPotentialProfit,
      averageOrder: activeOrders.length ? money(sales / activeOrders.length) : 0,
      orderCount: activeOrders.length,
      paidOrderCount: paidOrders.length
    },
    salesProfitByDay: Array.from(dayBuckets.values()),
    topProducts: Array.from(productProfit.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 6),
    categoryProfit: Array.from(categoryProfit.values())
      .sort((a, b) => b.potentialProfit - a.potentialProfit),
    orderStatus
  });
});

app.get("/api/admin/categories", requireAdmin, (req, res) => {
  const categories = db.prepare("SELECT * FROM categories ORDER BY active DESC, name ASC").all().map(categoryFromRow);
  res.json({ categories });
});

app.post("/api/admin/categories", requireAdmin, (req, res) => {
  const name = cleanText(req.body.name);
  if (name.length < 2) throw httpError(400, "La categoría necesita nombre.");
  const slug = ensureUniqueSlug("categories", name);
  const result = db.prepare(`
    INSERT INTO categories (name, slug, description, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, slug, cleanText(req.body.description), boolToInt(req.body.active ?? true), now(), now());
  res.status(201).json({ category: categoryFromRow(db.prepare("SELECT * FROM categories WHERE id = ?").get(result.lastInsertRowid)) });
});

app.put("/api/admin/categories/:id", requireAdmin, (req, res, next) => {
  const id = Number(req.params.id);
  const current = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
  if (!current) return next(httpError(404, "Categoría no encontrada."));
  const name = cleanText(req.body.name);
  if (name.length < 2) throw httpError(400, "La categoría necesita nombre.");
  const slug = ensureUniqueSlug("categories", name, id);
  db.prepare(`
    UPDATE categories
    SET name = ?, slug = ?, description = ?, active = ?, updated_at = ?
    WHERE id = ?
  `).run(name, slug, cleanText(req.body.description), boolToInt(req.body.active), now(), id);
  res.json({ category: categoryFromRow(db.prepare("SELECT * FROM categories WHERE id = ?").get(id)) });
});

app.delete("/api/admin/categories/:id", requireAdmin, (req, res, next) => {
  const id = Number(req.params.id);
  const productCount = db.prepare("SELECT COUNT(*) AS count FROM products WHERE category_id = ?").get(id).count;
  if (productCount > 0) {
    return next(httpError(409, "No se puede eliminar una categoría con productos. Mueve o elimina esos productos primero."));
  }
  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  res.json({ ok: true });
});

app.get("/api/admin/products", requireAdmin, (req, res) => {
  res.json({ products: getProducts({ includeInactive: true, includePrivate: true }) });
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
  const name = cleanText(req.body.name);
  if (name.length < 2) throw httpError(400, "El producto necesita nombre.");
  const slug = ensureUniqueSlug("products", name);
  const promoType = normalizePromoType(req.body.promo_type);
  const price = money(req.body.price);
  const costPrice = money(req.body.cost_price);
  const comparePrice = promoType === "discount" ? money(req.body.compare_price) : 0;
  if (promoType === "discount" && comparePrice <= price) {
    throw httpError(400, "El precio antes del descuento debe ser mayor al precio de venta.");
  }
  const result = db.prepare(`
    INSERT INTO products (
      category_id, name, slug, description, price, cost_price, compare_price, stock, sku, image_url,
      sizes_json, colors_json, promo_type, promo_label, active, featured, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.body.category_id ? Number(req.body.category_id) : null,
    name,
    slug,
    cleanText(req.body.description),
    price,
    costPrice,
    comparePrice,
    Math.max(0, Number(req.body.stock || 0)),
    cleanText(req.body.sku),
    cleanText(req.body.image_url || "/assets/product-placeholder.svg"),
    JSON.stringify(incomingList(req.body.sizes)),
    JSON.stringify(incomingList(req.body.colors)),
    promoType,
    promoLabelFor(promoType, req.body.promo_label),
    boolToInt(req.body.active ?? true),
    boolToInt(req.body.featured),
    now(),
    now()
  );
  res.status(201).json({ product: getProductById(result.lastInsertRowid, { includePrivate: true }) });
});

app.put("/api/admin/products/:id", requireAdmin, (req, res, next) => {
  const id = Number(req.params.id);
  const current = getProductById(id);
  if (!current) return next(httpError(404, "Producto no encontrado."));
  const name = cleanText(req.body.name);
  if (name.length < 2) throw httpError(400, "El producto necesita nombre.");
  const slug = ensureUniqueSlug("products", name, id);
  const promoType = normalizePromoType(req.body.promo_type);
  const price = money(req.body.price);
  const costPrice = money(req.body.cost_price);
  const comparePrice = promoType === "discount" ? money(req.body.compare_price) : 0;
  if (promoType === "discount" && comparePrice <= price) {
    throw httpError(400, "El precio antes del descuento debe ser mayor al precio de venta.");
  }
  db.prepare(`
    UPDATE products
    SET category_id = ?, name = ?, slug = ?, description = ?, price = ?, cost_price = ?, compare_price = ?, stock = ?, sku = ?,
        image_url = ?, sizes_json = ?, colors_json = ?, promo_type = ?, promo_label = ?, active = ?, featured = ?, updated_at = ?
    WHERE id = ?
  `).run(
    req.body.category_id ? Number(req.body.category_id) : null,
    name,
    slug,
    cleanText(req.body.description),
    price,
    costPrice,
    comparePrice,
    Math.max(0, Number(req.body.stock || 0)),
    cleanText(req.body.sku),
    cleanText(req.body.image_url || "/assets/product-placeholder.svg"),
    JSON.stringify(incomingList(req.body.sizes)),
    JSON.stringify(incomingList(req.body.colors)),
    promoType,
    promoLabelFor(promoType, req.body.promo_label),
    boolToInt(req.body.active),
    boolToInt(req.body.featured),
    now(),
    id
  );
  res.json({ product: getProductById(id, { includePrivate: true }) });
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

app.post("/api/admin/upload", requireAdmin, upload.single("image"), asyncHandler(async (req, res) => {
  assertSafeImageUpload(req.file);
  const result = await uploadToCloudinary(req.file);
  res.status(201).json(result);
}));

app.get("/api/admin/orders", requireAdmin, (req, res) => {
  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all().map(publicOrder);
  res.json({ orders });
});

app.patch("/api/admin/orders/:id/status", requireAdmin, (req, res, next) => {
  const id = Number(req.params.id);
  const allowed = ["new", "waiting_payment", "paid", "preparing", "ready", "sent", "completed", "cancelled"];
  const status = cleanText(req.body.status);
  if (!allowed.includes(status)) throw httpError(400, "Estado no válido.");
  const order = getOrderById(id);
  if (!order) return next(httpError(404, "Pedido no encontrado."));
  db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), id);
  res.json({ order: publicOrder(getOrderById(id)) });
});

app.get("/api/admin/orders/:id/whatsapp", requireAdmin, (req, res, next) => {
  const order = getOrderById(Number(req.params.id));
  if (!order) return next(httpError(404, "Pedido no encontrado."));
  res.json({ whatsappUrl: getWhatsappUrl(order) });
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next(httpError(404, "Ruta no encontrada."));
  }
  res.status(404).sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  const publicMessage = IS_PRODUCTION && status >= 500
    ? "Algo salio mal en el servidor."
    : err.message || "Algo salio mal.";
  res.status(status).json({ error: publicMessage });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`${STORE_NAME} listo en ${PUBLIC_BASE_URL}`);
    console.log(`Panel protegido: ${PUBLIC_BASE_URL}/admin.html`);
  });
}

module.exports = app;
