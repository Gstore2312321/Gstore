require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const sharp = require("sharp");

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const IMPORTED_PRODUCTS_FILE = path.join(ROOT_DIR, "data", "imported-products.json");
const IS_VERCEL = Boolean(process.env.VERCEL);
const RAILWAY_VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH ? path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH) : "";
const IS_RAILWAY = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || RAILWAY_VOLUME_PATH);
const IS_PRODUCTION = process.env.NODE_ENV === "production" || IS_VERCEL || IS_RAILWAY;
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : RAILWAY_VOLUME_PATH
    ? path.join(RAILWAY_VOLUME_PATH, "uploads")
    : IS_VERCEL
    ? path.join(os.tmpdir(), "gstore-uploads")
    : path.join(PUBLIC_DIR, "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

const PORT = Number(process.env.PORT || 4321);
const STORE_NAME = process.env.STORE_NAME || "GStore";
const CURRENCY = process.env.STORE_CURRENCY || "USD";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const STORE_TIME_ZONE = process.env.STORE_TIME_ZONE || "America/Guayaquil";
const ADMIN_SESSION_HOURS = Math.max(1, Math.min(24, Number(process.env.ADMIN_SESSION_HOURS || 8)));
const ADMIN_SECRET = cleanEnvSecret("ADMIN_SECRET", process.env.ADMIN_SECRET, "dev-secret");
const ADMIN_PASSWORD = cleanText(process.env.ADMIN_PASSWORD || "");
const ADMIN_PASSWORD_HASH = cleanText(process.env.ADMIN_PASSWORD_HASH || "");
const ADMIN_COOKIE_NAME = "gstore_admin_session";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const LOCAL_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const IMAGE_WIDTHS = [96, 140, 180, 220, 260, 320, 360, 420, 520, 640, 720, 820, 960, 1100, 1200, 1400];
const IMAGE_CACHE_DIR = path.join(UPLOAD_DIR, "_image-cache");
const STORE_BANNERS_SETTING_KEY = "store_banners";
const MAX_STORE_BANNERS = 6;
const MYSQL_CONNECTION_URL = cleanText(process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_URL);
let db;

const CLEAN_PAGE_PATHS = new Map([
  ["/index.html", "/"],
  ["/success.html", "/success"],
  ["/admin.html", "/admin"],
  ["/admin-reportes.html", "/admin-reportes"],
  ["/admin-productos.html", "/admin-productos"],
  ["/admin-categorias.html", "/admin-categorias"],
  ["/admin-pedidos.html", "/admin-pedidos"],
  ["/admin-clientes.html", "/admin-clientes"]
]);

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

app.get(Array.from(CLEAN_PAGE_PATHS.keys()), (req, res) => {
  const cleanPath = CLEAN_PAGE_PATHS.get(req.path);
  const queryIndex = req.originalUrl.indexOf("?");
  const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
  res.redirect(301, `${cleanPath}${query}`);
});

app.get(/^\/admin(?:-[a-z]+)?\/$/, (req, res) => {
  const queryIndex = req.originalUrl.indexOf("?");
  const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
  res.redirect(301, `${req.path.replace(/\/$/, "")}${query}`);
});

app.get(/^\/admin(?:-[a-z]+)?$/, (req, res, next) => {
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

function clientIp(req) {
  return cleanText(req.headers["x-forwarded-for"]?.split(",")[0] || req.ip || req.socket.remoteAddress);
}

function shortUserAgent(req) {
  return cleanText(req.get("User-Agent")).slice(0, 255);
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
  if (req.path.startsWith("/api/admin/") || isAdminPagePath(req.path)) {
    res.setHeader("Cache-Control", "no-store");
  }
}

function isAdminPagePath(pathname) {
  return /^\/admin(?:-[a-z]+)?(?:\.html|\/)?$/.test(pathname);
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

const orderLookupLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 35,
  message: "Demasiadas consultas de pedido. Intenta nuevamente en unos minutos."
});

const passwordResetLimiter = createRateLimiter({
  windowMs: 30 * 60 * 1000,
  max: 4,
  message: "Demasiadas solicitudes de recuperación. Intenta nuevamente más tarde."
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

function parseJsonObject(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
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

function cleanEnvValue(value, fallback = "") {
  let text = cleanText(value);
  if (!text) text = cleanText(fallback);
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function rawEnvHasOuterWhitespace(name) {
  const raw = String(process.env[name] || "");
  return Boolean(raw && raw !== raw.trim());
}

function rawEnvHasWrappingQuotes(name) {
  const raw = cleanText(process.env[name]);
  return Boolean(
    raw.length > 1 &&
    ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
  );
}

function maskValue(value, head = 4, tail = 4) {
  const text = cleanText(value);
  if (!text) return "";
  if (text.length <= head + tail) return "*".repeat(text.length);
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function publicOrder(order, options = {}) {
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
  const output = {
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
  if (options.includeAdmin) {
    output.admin_email_status = order.admin_email_status || "pending";
    output.customer_email_status = order.customer_email_status || "pending";
    output.email_error = order.email_error || "";
    output.email_sent_at = order.email_sent_at || "";
  }
  return output;
}

function publicCustomer(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    city: row.city || "",
    address: row.address || "",
    notes: row.notes || "",
    marketing_status: row.marketing_status || "cliente",
    order_count: Number(row.order_count || 0),
    total_spent: money(row.total_spent || 0),
    last_order_code: row.last_order_code || "",
    first_order_at: row.first_order_at || "",
    last_order_at: row.last_order_at || "",
    created_at: row.created_at || "",
    updated_at: row.updated_at || ""
  };
}

function csvCell(value) {
  const text = String(value ?? "").replace(/\r?\n/g, " ").replace(/"/g, '""');
  return `"${text}"`;
}

function customersToCsv(customers) {
  const headers = [
    "Nombre",
    "Telefono",
    "Correo",
    "Ciudad",
    "Direccion",
    "Notas",
    "Estado marketing",
    "Pedidos",
    "Total comprado",
    "Ultimo pedido",
    "Primera compra",
    "Ultima compra"
  ];
  const rows = customers.map((customer) => [
    customer.name,
    customer.phone,
    customer.email,
    customer.city,
    customer.address,
    customer.notes,
    customer.marketing_status,
    customer.order_count,
    formatMoney(customer.total_spent),
    customer.last_order_code,
    customer.first_order_at,
    customer.last_order_at
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function productFromRow(row, options = {}) {
  if (!row) return null;
  const product = {
    id: row.id,
    name: row.name,
    brand_name: row.brand_name || "",
    slug: row.slug,
    description: row.description || "",
    price: row.price,
    compare_price: row.compare_price || 0,
    stock: row.stock,
    sku: row.sku || "",
    image_url: row.image_url || "/assets/product-placeholder.svg",
    image_fit: normalizeImageFit(row.image_fit),
    image_position_x: clampImagePercent(row.image_position_x, 50),
    image_position_y: clampImagePercent(row.image_position_y, 50),
    image_zoom: clampImageZoom(row.image_zoom),
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

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function clampImagePercent(value, fallback = 50) {
  return clampNumber(value, 0, 100, fallback);
}

function clampImageZoom(value) {
  return clampNumber(value, 1, 1.8, 1);
}

function normalizeImageFit(value) {
  return cleanText(value).toLowerCase() === "contain" ? "contain" : "cover";
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

async function auditLog(req, { action, entityType, entityId = "", summary, metadata = {} }) {
  try {
    await dbRun(`
      INSERT INTO audit_logs (
        actor_email, action, entity_type, entity_id, summary, metadata_json, ip_address, user_agent, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cleanText(req?.admin?.email || "system"),
      cleanText(action),
      cleanText(entityType),
      cleanText(entityId),
      cleanText(summary).slice(0, 255),
      JSON.stringify(metadata || {}),
      clientIp(req),
      shortUserAgent(req),
      now()
    ]);
  } catch (error) {
    console.warn("No se pudo guardar auditoria:", error.message);
  }
}

async function getAppSetting(key) {
  const row = await dbGet("SELECT setting_value FROM app_settings WHERE setting_key = ?", [key]);
  return row ? row.setting_value : "";
}

async function setAppSetting(key, value) {
  await dbRun(`
    INSERT INTO app_settings (setting_key, setting_value, updated_at)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = VALUES(updated_at)
  `, [key, value, now()]);
}

function cleanBannerLink(value) {
  const link = cleanText(value);
  if (!link) return "";
  if (link.startsWith("/") || link.startsWith("#")) return link.slice(0, 260);
  try {
    const parsed = new URL(link);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString().slice(0, 260) : "";
  } catch {
    return "";
  }
}

function bannerFromInput(body = {}, existing = {}) {
  const imageUrl = cleanText(body.image_url || existing.image_url);
  if (!imageUrl || imageUrl.includes("product-placeholder.svg")) {
    throw httpError(400, "Sube una imagen real para el banner.");
  }
  const title = cleanText(body.title || existing.title).slice(0, 80);
  if (title.length < 2) throw httpError(400, "El banner necesita un título corto.");
  const kicker = cleanText(body.kicker || existing.kicker || "Promo").slice(0, 42);
  const text = cleanText(body.text || existing.text).slice(0, 150);
  return {
    id: existing.id || crypto.randomUUID(),
    kicker,
    title,
    text,
    image_url: imageUrl,
    link_url: cleanBannerLink(body.link_url || existing.link_url),
    active: body.active === undefined ? Boolean(existing.active ?? true) : boolToInt(body.active) === 1,
    created_at: existing.created_at || now(),
    updated_at: now()
  };
}

function normalizeBannerList(value, { includeInactive = false } = {}) {
  let parsed = [];
  if (Array.isArray(value)) parsed = value;
  else {
    try {
      parsed = JSON.parse(value || "[]");
    } catch {
      parsed = [];
    }
  }
  return parsed
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: cleanText(item.id) || crypto.randomUUID(),
      kicker: cleanText(item.kicker || "Promo").slice(0, 42),
      title: cleanText(item.title).slice(0, 80),
      text: cleanText(item.text).slice(0, 150),
      image_url: cleanText(item.image_url),
      link_url: cleanBannerLink(item.link_url),
      active: Boolean(item.active),
      created_at: cleanText(item.created_at),
      updated_at: cleanText(item.updated_at)
    }))
    .filter((item) => item.title && item.image_url && (includeInactive || item.active))
    .slice(0, MAX_STORE_BANNERS);
}

async function getStoreBanners(options = {}) {
  return normalizeBannerList(await getAppSetting(STORE_BANNERS_SETTING_KEY), options);
}

async function saveStoreBanners(banners) {
  const normalized = normalizeBannerList(banners, { includeInactive: true }).slice(0, MAX_STORE_BANNERS);
  await setAppSetting(STORE_BANNERS_SETTING_KEY, JSON.stringify(normalized));
  return normalized;
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function mysqlConnectionOptions() {
  if (MYSQL_CONNECTION_URL) {
    const url = new URL(MYSQL_CONNECTION_URL);
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username || ""),
      password: decodeURIComponent(url.password || ""),
      database: decodeURIComponent(url.pathname.replace(/^\//, "")),
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
      queueLimit: 0,
      decimalNumbers: true,
      charset: "utf8mb4"
    };
  }

  return {
    host: process.env.MYSQLHOST || process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQLUSER || process.env.MYSQL_USER || "root",
    password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || "gstore",
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    decimalNumbers: true,
    charset: "utf8mb4"
  };
}

async function connectDatabase() {
  db = mysql.createPool(mysqlConnectionOptions());
  await db.query("SELECT 1");
}

async function dbAll(sql, params = []) {
  const [rows] = await db.execute(sql, params);
  return rows;
}

async function dbGet(sql, params = []) {
  const rows = await dbAll(sql, params);
  return rows[0] || null;
}

async function dbRun(sql, params = []) {
  const [result] = await db.execute(sql, params);
  return result;
}

async function ensureColumn(table, column, definition) {
  const rows = await dbAll(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
  `, [table, column]);
  if (!rows.length) {
    await dbRun(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
  }
}

async function ensureSchema() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(180) NOT NULL,
      slug VARCHAR(200) NOT NULL,
      description TEXT,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY categories_name_unique (name),
      UNIQUE KEY categories_slug_unique (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      category_id INT UNSIGNED NULL,
      name VARCHAR(220) NOT NULL,
      brand_name VARCHAR(120) DEFAULT '',
      slug VARCHAR(240) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      compare_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      stock INT NOT NULL DEFAULT 0,
      sku VARCHAR(90) DEFAULT '',
      image_url TEXT,
      image_fit VARCHAR(16) DEFAULT 'cover',
      image_position_x DECIMAL(5,2) NOT NULL DEFAULT 50,
      image_position_y DECIMAL(5,2) NOT NULL DEFAULT 50,
      image_zoom DECIMAL(4,2) NOT NULL DEFAULT 1,
      sizes_json TEXT,
      colors_json TEXT,
      promo_type VARCHAR(40) DEFAULT 'none',
      promo_label VARCHAR(160) DEFAULT '',
      active TINYINT(1) NOT NULL DEFAULT 1,
      featured TINYINT(1) NOT NULL DEFAULT 0,
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY products_slug_unique (slug),
      KEY products_category_id_index (category_id),
      CONSTRAINT products_category_id_foreign
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_code VARCHAR(60) NOT NULL,
      customer_name VARCHAR(180) NOT NULL,
      customer_phone VARCHAR(60) NOT NULL,
      customer_email VARCHAR(180) DEFAULT '',
      customer_address TEXT,
      customer_city VARCHAR(120) DEFAULT '',
      delivery_method VARCHAR(30) DEFAULT 'delivery',
      notes TEXT,
      items_json MEDIUMTEXT NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL,
      shipping DECIMAL(10,2) NOT NULL DEFAULT 0,
      total DECIMAL(10,2) NOT NULL,
      payment_method VARCHAR(40) NOT NULL,
      payment_status VARCHAR(40) NOT NULL DEFAULT 'pending',
      status VARCHAR(40) NOT NULL DEFAULT 'new',
      source VARCHAR(80) DEFAULT 'storefront',
      paypal_order_id VARCHAR(160) DEFAULT '',
      admin_email_status VARCHAR(40) DEFAULT 'pending',
      customer_email_status VARCHAR(40) DEFAULT 'pending',
      email_error TEXT,
      email_sent_at VARCHAR(32) DEFAULT '',
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY orders_order_code_unique (order_code),
      KEY orders_status_index (status),
      KEY orders_payment_status_index (payment_status),
      KEY orders_paypal_order_id_index (paypal_order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(180) NOT NULL,
      phone VARCHAR(60) NOT NULL,
      email VARCHAR(180) NOT NULL,
      city VARCHAR(120) DEFAULT '',
      address TEXT,
      notes TEXT,
      marketing_status VARCHAR(80) DEFAULT 'cliente',
      order_count INT UNSIGNED NOT NULL DEFAULT 0,
      total_spent DECIMAL(10,2) NOT NULL DEFAULT 0,
      last_order_code VARCHAR(60) DEFAULT '',
      first_order_at VARCHAR(32) DEFAULT '',
      last_order_at VARCHAR(32) DEFAULT '',
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY customers_email_unique (email),
      KEY customers_phone_index (phone),
      KEY customers_last_order_index (last_order_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      actor_email VARCHAR(180) DEFAULT '',
      action VARCHAR(80) NOT NULL,
      entity_type VARCHAR(80) NOT NULL,
      entity_id VARCHAR(80) DEFAULT '',
      summary VARCHAR(255) NOT NULL,
      metadata_json MEDIUMTEXT,
      ip_address VARCHAR(80) DEFAULT '',
      user_agent VARCHAR(255) DEFAULT '',
      created_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      KEY audit_logs_created_at_index (created_at),
      KEY audit_logs_entity_index (entity_type, entity_id),
      KEY audit_logs_actor_index (actor_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(120) NOT NULL,
      setting_value MEDIUMTEXT NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(180) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at VARCHAR(32) NOT NULL,
      used_at VARCHAR(32) DEFAULT NULL,
      ip_address VARCHAR(80) DEFAULT '',
      created_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY password_reset_tokens_hash_unique (token_hash),
      KEY password_reset_tokens_email_index (email),
      KEY password_reset_tokens_expires_index (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumn("orders", "delivery_method", "delivery_method VARCHAR(30) DEFAULT 'delivery'");
  await ensureColumn("products", "brand_name", "brand_name VARCHAR(120) DEFAULT ''");
  await ensureColumn("products", "cost_price", "cost_price DECIMAL(10,2) NOT NULL DEFAULT 0");
  await ensureColumn("products", "compare_price", "compare_price DECIMAL(10,2) NOT NULL DEFAULT 0");
  await ensureColumn("products", "promo_type", "promo_type VARCHAR(40) DEFAULT 'none'");
  await ensureColumn("products", "promo_label", "promo_label VARCHAR(160) DEFAULT ''");
  await ensureColumn("products", "featured", "featured TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("products", "image_fit", "image_fit VARCHAR(16) DEFAULT 'cover'");
  await ensureColumn("products", "image_position_x", "image_position_x DECIMAL(5,2) NOT NULL DEFAULT 50");
  await ensureColumn("products", "image_position_y", "image_position_y DECIMAL(5,2) NOT NULL DEFAULT 50");
  await ensureColumn("products", "image_zoom", "image_zoom DECIMAL(4,2) NOT NULL DEFAULT 1");
  await ensureColumn("orders", "admin_email_status", "admin_email_status VARCHAR(40) DEFAULT 'pending'");
  await ensureColumn("orders", "customer_email_status", "customer_email_status VARCHAR(40) DEFAULT 'pending'");
  await ensureColumn("orders", "email_error", "email_error TEXT");
  await ensureColumn("orders", "email_sent_at", "email_sent_at VARCHAR(32) DEFAULT ''");
  await rebuildCustomersFromOrders();

  const promoCount = await dbGet(`
    SELECT COUNT(*) AS count
    FROM products
    WHERE promo_type != 'none' OR promo_label != '' OR compare_price > price
  `);
  if (Number(promoCount?.count || 0) === 0) {
    await dbRun(`
      UPDATE products
      SET compare_price = 72, promo_type = 'discount', promo_label = 'Precio especial'
      WHERE sku = 'GS-VES-002'
    `);
    await dbRun(`
      UPDATE products
      SET promo_type = 'last_units', promo_label = 'Últimas unidades'
      WHERE stock <= 2
    `);
  }

  await dbRun("UPDATE products SET cost_price = 28 WHERE sku = 'GS-SET-001' AND cost_price = 0");
  await dbRun("UPDATE products SET cost_price = 34 WHERE sku = 'GS-VES-002' AND cost_price = 0");
  await dbRun("UPDATE products SET cost_price = 24 WHERE sku = 'GS-ZAP-003' AND cost_price = 0");
  await dbRun("UPDATE products SET cost_price = 18 WHERE sku = 'GS-CAR-004' AND cost_price = 0");
  await dbRun("UPDATE products SET cost_price = 7 WHERE sku = 'GS-ACC-005' AND cost_price = 0");
}

async function ensureUniqueSlug(table, source, currentId = null) {
  const base = slugify(source);
  let candidate = base;
  let counter = 2;
  const safeTable = table === "categories" ? "categories" : "products";
  while (true) {
    const found = await dbGet(`SELECT id FROM ${safeTable} WHERE slug = ?`, [candidate]);
    if (!found || (currentId && Number(found.id) === Number(currentId))) return candidate;
    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

const SEED_CATEGORIES = [
  ["Ropa", "Prendas importadas para looks de diario y salidas especiales."],
  ["Zapatos", "Pares seleccionados para combinar con pocas piezas y verse bien."],
  ["Carteras", "Carteras y bolsos faciles de usar, cuidar y regalar."],
  ["Accesorios", "Detalles pequenos que terminan el outfit."],
  ["Belleza", "Perfumes, cremas y sets personales listos para vitrina."]
];

function loadImportedProducts() {
  try {
    const raw = fs.readFileSync(IMPORTED_PRODUCTS_FILE, "utf8");
    const products = JSON.parse(raw);
    return Array.isArray(products) ? products : [];
  } catch {
    return [];
  }
}

async function ensureSeedCategories() {
  for (const [name, description] of SEED_CATEGORIES) {
    const slug = slugify(name);
    const existing = await dbGet("SELECT id FROM categories WHERE slug = ? OR name = ?", [slug, name]);
    if (existing) continue;
    await dbRun(`
      INSERT INTO categories (name, slug, description, active, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `, [name, slug, description, now(), now()]);
  }
}

async function seedProductList(products) {
  for (const product of products) {
    const sku = cleanText(product.sku);
    const name = cleanText(product.name);
    const image = cleanText(product.image);
    const categorySlug = slugify(product.category);
    if (!sku || !name || !image || !categorySlug) continue;

    const existing = await dbGet("SELECT id FROM products WHERE sku = ?", [sku]);
    if (existing) continue;

    const category = await dbGet("SELECT id FROM categories WHERE slug = ?", [categorySlug]);
    await dbRun(`
      INSERT INTO products (
        category_id, name, brand_name, slug, description, price, cost_price, compare_price, stock, sku, image_url,
        image_fit, image_position_x, image_position_y, image_zoom,
        sizes_json, colors_json, promo_type, promo_label, active, featured, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      category ? category.id : null,
      name,
      cleanText(product.brand || product.brandName || ""),
      await ensureUniqueSlug("products", name),
      cleanText(product.description),
      money(product.price),
      money(product.costPrice),
      money(product.comparePrice),
      Number.isInteger(Number(product.stock)) ? Number(product.stock) : 0,
      sku,
      image,
      "cover",
      50,
      50,
      1,
      JSON.stringify(Array.isArray(product.sizes) ? product.sizes : []),
      JSON.stringify(Array.isArray(product.colors) ? product.colors : []),
      normalizePromoType(product.promoType),
      promoLabelFor(product.promoType, product.promoLabel),
      boolToInt(product.active ?? true),
      boolToInt(product.featured),
      now(),
      now()
    ]);
  }
}

async function seedData() {
  const categoryCount = await dbGet("SELECT COUNT(*) AS count FROM categories");
  if (Number(categoryCount?.count || 0) === 0) {
    for (const [name, description] of [
      ["Ropa", "Prendas importadas para looks de diario y salidas especiales."],
      ["Zapatos", "Pares seleccionados para combinar con pocas piezas y verse bien."],
      ["Carteras", "Carteras y bolsos fáciles de usar, cuidar y regalar."],
      ["Accesorios", "Detalles pequeños que terminan el outfit."]
    ]) {
      await dbRun(`
        INSERT INTO categories (name, slug, description, active, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
      `, [name, await ensureUniqueSlug("categories", name), description, now(), now()]);
    }
  }

  await ensureSeedCategories();

  const importedProducts = loadImportedProducts();
  const productCount = await dbGet("SELECT COUNT(*) AS count FROM products");
  if (Number(productCount?.count || 0) === 0 && importedProducts.length === 0) {
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

    for (const product of products) {
      const category = await dbGet("SELECT id FROM categories WHERE slug = ?", [product.category]);
      await dbRun(`
        INSERT INTO products (
          category_id, name, brand_name, slug, description, price, cost_price, compare_price, stock, sku, image_url,
          image_fit, image_position_x, image_position_y, image_zoom,
          sizes_json, colors_json, promo_type, promo_label, active, featured, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `, [
        category ? category.id : null,
        product.name,
        cleanText(product.brand || product.brandName || ""),
        await ensureUniqueSlug("products", product.name),
        product.description,
        product.price,
        product.costPrice,
        product.comparePrice,
        product.stock,
        product.sku,
        product.image,
        "cover",
        50,
        50,
        1,
        JSON.stringify(product.sizes),
        JSON.stringify(product.colors),
        product.promoType,
        product.promoLabel,
        product.featured,
        now(),
        now()
      ]);
    }
  }
  await seedProductList(importedProducts);
}

async function getProducts({ includeInactive = false, includePrivate = false } = {}) {
  const sql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${includeInactive ? "" : "WHERE p.active = 1"}
    ORDER BY p.featured DESC, p.updated_at DESC, p.id DESC
  `;
  const rows = await dbAll(sql);
  return rows.map((row) => productFromRow(row, { includePrivate }));
}

async function getProductPrivateIndex() {
  const rows = await dbAll(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
  `);
  const index = new Map();
  rows.forEach((row) => {
    index.set(Number(row.id), productFromRow(row, { includePrivate: true }));
  });
  return index;
}

async function getProductById(id, options = {}) {
  return productFromRow(await dbGet(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = ?
  `, [id]), options);
}

async function getOrderByCode(code) {
  return dbGet("SELECT * FROM orders WHERE order_code = ?", [code]);
}

async function getOrderById(id) {
  return dbGet("SELECT * FROM orders WHERE id = ?", [id]);
}

function createOrderCode() {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = crypto.randomBytes(8).toString("hex").toUpperCase();
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
    email: normalizeEmail(input.email),
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

async function calculateCart(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw httpError(400, "El carrito está vacío.");
  }

  const items = [];
  for (const item of rawItems) {
    const product = productFromRow(await dbGet(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ? AND p.active = 1
    `, [Number(item.productId || item.id)]), { includePrivate: true });
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
    items.push({
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
    });
  }

  const subtotal = money(items.reduce((sum, item) => sum + item.line_total, 0));
  const shipping = money(process.env.DEFAULT_SHIPPING || 0);
  return {
    items,
    subtotal,
    shipping,
    total: money(subtotal + shipping)
  };
}

async function decrementStock(items) {
  for (const item of items) {
    await dbRun(`
      UPDATE products
      SET stock = GREATEST(stock - ?, 0),
          updated_at = ?
      WHERE id = ?
    `, [item.quantity, now(), item.product_id]);
  }
}

async function insertOrder({ customer, cart, deliveryMethod, paymentMethod, paymentStatus, status, source, paypalOrderId = "" }) {
  const code = createOrderCode();
  const result = await dbRun(`
    INSERT INTO orders (
      order_code, customer_name, customer_phone, customer_email, customer_address, customer_city, delivery_method,
      notes, items_json, subtotal, shipping, total, payment_method, payment_status, status,
      source, paypal_order_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
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
  ]);

  return getOrderById(result.insertId);
}

async function syncCustomerFromOrder(order) {
  if (!order) return null;
  const email = normalizeEmail(order.customer_email);
  if (!email) return null;

  const latest = await dbGet(`
    SELECT *
    FROM orders
    WHERE LOWER(customer_email) = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `, [email]);
  const totals = await dbGet(`
    SELECT
      COUNT(*) AS order_count,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) AS total_spent,
      MIN(created_at) AS first_order_at,
      MAX(created_at) AS last_order_at
    FROM orders
    WHERE LOWER(customer_email) = ?
  `, [email]);

  if (!latest) return null;
  await dbRun(`
    INSERT INTO customers (
      name, phone, email, city, address, notes, marketing_status, order_count, total_spent,
      last_order_code, first_order_at, last_order_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      phone = VALUES(phone),
      city = VALUES(city),
      address = VALUES(address),
      notes = VALUES(notes),
      marketing_status = VALUES(marketing_status),
      order_count = VALUES(order_count),
      total_spent = VALUES(total_spent),
      last_order_code = VALUES(last_order_code),
      first_order_at = VALUES(first_order_at),
      last_order_at = VALUES(last_order_at),
      updated_at = VALUES(updated_at)
  `, [
    cleanText(latest.customer_name),
    normalizePhone(latest.customer_phone),
    email,
    cleanText(latest.customer_city),
    cleanText(latest.customer_address),
    cleanText(latest.notes),
    "cliente con pedido",
    Number(totals?.order_count || 0),
    money(totals?.total_spent || 0),
    cleanText(latest.order_code),
    cleanText(totals?.first_order_at),
    cleanText(totals?.last_order_at),
    now(),
    now()
  ]);

  return dbGet("SELECT * FROM customers WHERE email = ?", [email]);
}

async function rebuildCustomersFromOrders() {
  const rows = await dbAll(`
    SELECT MIN(customer_email) AS customer_email
    FROM orders
    WHERE customer_email IS NOT NULL AND customer_email != ''
    GROUP BY LOWER(customer_email)
  `);
  for (const row of rows) {
    await syncCustomerFromOrder({ customer_email: row.customer_email });
  }
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
  if (!phone) throw httpError(503, "WhatsApp no está disponible por ahora.");
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsappMessage(order))}`;
}

function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

async function sendResendEmail({ to, subject, text, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !to) return { skipped: true };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      reply_to: replyTo || undefined,
      subject,
      text
    })
  });

  if (!response.ok) {
    const message = await response.text();
    console.warn("Resend no pudo enviar la notificacion:", message);
    return { ok: false, message };
  }

  return { ok: true, ...(await response.json()) };
}

function orderEmailLines(order) {
  return parseJsonList(order.items_json)
    .map((item) => `${item.quantity} x ${item.name} - $${formatMoney(item.line_total)}`)
    .join("\n");
}

async function sendOrderEmail(order) {
  const ownerEmail = cleanText(process.env.RESEND_TO_EMAIL || process.env.STORE_OWNER_EMAIL);
  const replyToEmail = cleanText(process.env.RESEND_REPLY_TO_EMAIL || order.customer_email);
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    const missing = [
      !process.env.RESEND_API_KEY ? "RESEND_API_KEY" : "",
      !process.env.RESEND_FROM_EMAIL ? "RESEND_FROM_EMAIL" : ""
    ].filter(Boolean).join(", ");
    await updateOrderEmailStatus(order.id, {
      admin: "skipped",
      customer: "skipped",
      error: `Correo no configurado: falta ${missing}.`
    });
    return { skipped: true, reason: missing };
  }

  const items = orderEmailLines(order);

  const adminText = [
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

  const customerText = [
    `Hola ${order.customer_name},`,
    "",
    `Recibimos tu pedido ${order.order_code} en ${STORE_NAME}.`,
    "",
    items,
    "",
    `Total: $${formatMoney(order.total)} ${CURRENCY}`,
    `Entrega: ${normalizeDeliveryMethod(order.delivery_method) === "pickup" ? "Retiro coordinado por WhatsApp" : "Envío a domicilio"}`,
    `Estado de pago: ${order.payment_status === "paid" ? "Pagado" : "Pendiente"}`,
    "",
    "Te contactaremos para confirmar los detalles."
  ].filter(Boolean).join("\n");

  const results = { admin: null, customer: null };
  if (ownerEmail) {
    results.admin = await sendResendEmail({
      to: ownerEmail,
      replyTo: replyToEmail || undefined,
      subject: `${STORE_NAME}: nuevo pedido ${order.order_code}`,
      text: adminText
    });
  } else {
    results.admin = { skipped: true, message: "Falta RESEND_TO_EMAIL o STORE_OWNER_EMAIL." };
  }
  if (order.customer_email) {
    results.customer = await sendResendEmail({
      to: order.customer_email,
      replyTo: ownerEmail || undefined,
      subject: `Confirmación de pedido ${order.order_code}`,
      text: customerText
    });
  } else {
    results.customer = { skipped: true, message: "El pedido no tiene correo de cliente." };
  }

  const adminStatus = emailStatusFromResult(results.admin);
  const customerStatus = emailStatusFromResult(results.customer);
  await updateOrderEmailStatus(order.id, {
    admin: adminStatus,
    customer: customerStatus,
    error: emailErrorSummary(results)
  });

  return { ok: adminStatus !== "failed" && customerStatus !== "failed", results };
}

function emailStatusFromResult(result) {
  if (!result || result.skipped) return "skipped";
  if (result.ok === false) return "failed";
  return "sent";
}

function emailErrorSummary(results) {
  return Object.entries(results || {})
    .map(([kind, result]) => {
      if (!result || result.ok !== false) return "";
      return `${kind}: ${cleanText(result.message).slice(0, 180)}`;
    })
    .filter(Boolean)
    .join(" | ");
}

async function updateOrderEmailStatus(orderId, { admin = "pending", customer = "pending", error = "" } = {}) {
  if (!orderId) return;
  const sentAt = admin === "sent" || customer === "sent" ? now() : "";
  await dbRun(`
    UPDATE orders
    SET admin_email_status = ?,
        customer_email_status = ?,
        email_error = ?,
        email_sent_at = ?,
        updated_at = ?
    WHERE id = ?
  `, [
    cleanText(admin),
    cleanText(customer),
    cleanText(error).slice(0, 1000),
    sentAt,
    now(),
    orderId
  ]);
}

async function markOrderEmailFailed(orderId, error) {
  await updateOrderEmailStatus(orderId, {
    admin: "failed",
    customer: "failed",
    error: cleanText(error?.message || error || "No se pudo enviar el correo.")
  });
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
  if (!paypalConfigured()) throw httpError(503, "PayPal no está disponible por ahora.");
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
        return_url: `${PUBLIC_BASE_URL}/success?paypal=1&order=${encodeURIComponent(order.order_code)}`,
        cancel_url: `${PUBLIC_BASE_URL}/success?cancelled=1&order=${encodeURIComponent(order.order_code)}`
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

async function currentAdminPasswordHash() {
  return cleanText(await getAppSetting("admin_password_hash") || ADMIN_PASSWORD_HASH);
}

async function passwordMatches(value) {
  const storedHash = await currentAdminPasswordHash();
  if (storedHash) {
    return bcrypt.compare(String(value || ""), storedHash);
  }
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
    throw httpError(400, "Falta configurar Cloudinary o un volumen persistente para subir imagenes en produccion.");
  }
  const original = path.basename(file.originalname || "imagen.jpg");
  const ext = path.extname(original).toLowerCase() || ".jpg";
  const safeName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext.replace(/[^.\w]/g, "")}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, safeName), file.buffer);
  return { url: `/uploads/${safeName}`, provider: "local" };
}

function normalizeImageWidth(value) {
  const requested = Math.max(96, Math.min(1400, Number(value) || 420));
  return IMAGE_WIDTHS.reduce((closest, width) => (
    Math.abs(width - requested) < Math.abs(closest - requested) ? width : closest
  ), IMAGE_WIDTHS[0]);
}

function resolveOptimizableLocalImage(value) {
  const src = cleanText(value).split("?")[0];
  if (!src || src.includes("\0")) return null;

  let baseDir = "";
  let relativePath = "";
  if (src.startsWith("/assets/products/")) {
    baseDir = path.join(PUBLIC_DIR, "assets", "products");
    relativePath = src.slice("/assets/products/".length);
  } else if (src.startsWith("/uploads/")) {
    baseDir = UPLOAD_DIR;
    relativePath = src.slice("/uploads/".length);
    if (relativePath.startsWith("_image-cache/")) return null;
  } else {
    return null;
  }

  const extension = path.extname(relativePath).toLowerCase();
  if (!relativePath || !LOCAL_IMAGE_EXTENSIONS.has(extension)) return null;

  const safeBase = path.resolve(baseDir);
  const resolved = path.resolve(safeBase, relativePath);
  if (resolved !== safeBase && !resolved.startsWith(`${safeBase}${path.sep}`)) return null;
  return resolved;
}

async function serveOptimizedLocalImage(req, res, next) {
  const sourcePath = resolveOptimizableLocalImage(req.query.src);
  if (!sourcePath) return next(httpError(404, "Imagen no disponible."));

  let stats;
  try {
    stats = await fs.promises.stat(sourcePath);
  } catch {
    return next(httpError(404, "Imagen no disponible."));
  }
  if (!stats.isFile()) return next(httpError(404, "Imagen no disponible."));

  const width = normalizeImageWidth(req.query.w || req.query.width);
  const cacheKey = crypto
    .createHash("sha1")
    .update(`${sourcePath}:${stats.size}:${stats.mtimeMs}:${width}`)
    .digest("hex");
  const cachePath = path.join(IMAGE_CACHE_DIR, `${cacheKey}-w${width}.webp`);

  try {
    await fs.promises.mkdir(IMAGE_CACHE_DIR, { recursive: true });
    try {
      await fs.promises.access(cachePath, fs.constants.R_OK);
    } catch {
      await sharp(sourcePath, { failOn: "none" })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 88, effort: 4, smartSubsample: true })
        .toFile(cachePath);
    }
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", IS_PRODUCTION ? "public, max-age=31536000, immutable" : "public, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.sendFile(cachePath);
  } catch (error) {
    console.warn("No se pudo optimizar imagen local.", {
      width,
      message: cleanText(error.message || "")
    });
    return next(httpError(500, "No se pudo preparar la imagen."));
  }
}

function parseCloudinaryUrl(value) {
  const text = cleanEnvValue(value);
  if (!text) return {};
  try {
    const url = new URL(text);
    if (url.protocol !== "cloudinary:") return {};
    return {
      cloudName: cleanEnvValue(url.hostname),
      apiKey: cleanEnvValue(decodeURIComponent(url.username || "")),
      apiSecret: cleanEnvValue(decodeURIComponent(url.password || ""))
    };
  } catch {
    return {};
  }
}

function cloudinaryConfig() {
  const fromUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
  return {
    cloudName: cleanEnvValue(process.env.CLOUDINARY_CLOUD_NAME, fromUrl.cloudName),
    apiKey: cleanEnvValue(process.env.CLOUDINARY_API_KEY, fromUrl.apiKey),
    apiSecret: cleanEnvValue(process.env.CLOUDINARY_API_SECRET, fromUrl.apiSecret),
    folder: cleanEnvValue(process.env.CLOUDINARY_FOLDER, "gstore/productos")
  };
}

function cloudinaryWarnings(config = cloudinaryConfig()) {
  const warnings = [];
  if (!config.cloudName) warnings.push("Falta CLOUDINARY_CLOUD_NAME o CLOUDINARY_URL.");
  if (!config.apiKey) warnings.push("Falta CLOUDINARY_API_KEY o CLOUDINARY_URL.");
  if (!config.apiSecret) warnings.push("Falta CLOUDINARY_API_SECRET o CLOUDINARY_URL.");
  if (config.apiKey && config.apiSecret && config.apiKey === config.apiSecret) {
    warnings.push("CLOUDINARY_API_SECRET es igual a CLOUDINARY_API_KEY; debe ser el API Secret real.");
  }
  if (config.apiSecret && config.apiSecret.length < 16) {
    warnings.push("CLOUDINARY_API_SECRET parece demasiado corto; confirma que no pegaste el API Key.");
  }
  if (
    process.env.CLOUDINARY_URL &&
    (cleanText(process.env.CLOUDINARY_CLOUD_NAME) || cleanText(process.env.CLOUDINARY_API_KEY) || cleanText(process.env.CLOUDINARY_API_SECRET))
  ) {
    warnings.push("Tienes CLOUDINARY_URL y variables separadas; el backend usa las variables separadas si existen.");
  }
  ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_FOLDER", "CLOUDINARY_URL"].forEach((name) => {
    if (rawEnvHasOuterWhitespace(name)) warnings.push(`${name} tiene espacios al inicio o al final.`);
    if (rawEnvHasWrappingQuotes(name)) warnings.push(`${name} esta guardada con comillas; quitalas en Railway.`);
  });
  if (process.env.CLOUDINARY_URL && !parseCloudinaryUrl(process.env.CLOUDINARY_URL).cloudName) {
    warnings.push("CLOUDINARY_URL no tiene formato cloudinary://API_KEY:API_SECRET@CLOUD_NAME.");
  }
  return warnings;
}

function signCloudinaryParams(params, apiSecret) {
  const stringToSign = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return {
    stringToSign,
    signature: crypto.createHash("sha1").update(`${stringToSign}${apiSecret}`).digest("hex")
  };
}

function cloudinaryConfigured() {
  const config = cloudinaryConfig();
  return Boolean(config.cloudName && config.apiKey && config.apiSecret);
}

async function uploadToCloudinary(file) {
  const config = cloudinaryConfig();
  if (!cloudinaryConfigured()) return localUpload(file);

  const timestamp = Math.round(Date.now() / 1000);
  const params = { folder: config.folder, timestamp: String(timestamp) };
  const { signature, stringToSign } = signCloudinaryParams(params, config.apiSecret);
  const form = new FormData();

  form.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname || "producto.jpg");
  form.append("api_key", config.apiKey);
  form.append("timestamp", params.timestamp);
  form.append("folder", params.folder);
  form.append("signature", signature);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`, {
      method: "POST",
      body: form,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw httpError(504, "Cloudinary tardo demasiado en responder. Intenta otra vez o sube una imagen mas liviana.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const cloudinaryMessage = cleanText(data.error?.message || "");
    if (/invalid signature/i.test(cloudinaryMessage)) {
      console.warn("Cloudinary rechazo la firma de subida.", {
        cloudName: maskValue(config.cloudName),
        apiKey: maskValue(config.apiKey),
        folder: config.folder,
        stringToSign,
        warnings: cloudinaryWarnings(config)
      });
      throw httpError(
        400,
        "Cloudinary rechazo la firma. En Railway revisa que CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET pertenezcan a la misma cuenta, y que CLOUDINARY_API_SECRET sea el API Secret real, no el API Key."
      );
    }
    throw httpError(502, cloudinaryMessage || "Cloudinary no pudo subir la imagen.");
  }
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
  if (!ADMIN_PASSWORD_HASH) missing.push("ADMIN_PASSWORD_HASH bcrypt");
  if (ADMIN_PASSWORD_HASH && !ADMIN_PASSWORD_HASH.startsWith("$2")) {
    missing.push("ADMIN_PASSWORD_HASH bcrypt valido");
  }
  if (!process.env.PUBLIC_BASE_URL || /localhost|127\.0\.0\.1/.test(process.env.PUBLIC_BASE_URL)) missing.push("PUBLIC_BASE_URL real");
  if (IS_VERCEL && !cloudinaryConfigured()) missing.push("Cloudinary para imagenes persistentes");
  if (!MYSQL_CONNECTION_URL && !process.env.MYSQLHOST && !process.env.MYSQL_HOST) {
    missing.push("MYSQL_URL o variables MYSQL de Railway");
  }
  if (missing.length) {
    throw new Error(`Configuracion de produccion incompleta: ${missing.join(", ")}.`);
  }
}

async function initializeApp() {
  validateProductionConfig();
  await connectDatabase();
  await ensureSchema();
  await seedData();
}

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

app.get("/api/banners", asyncHandler(async (req, res) => {
  res.json({ banners: await getStoreBanners() });
}));

app.get("/api/image", asyncHandler(serveOptimizedLocalImage));

app.get("/api/categories", asyncHandler(async (req, res) => {
  const categories = (await dbAll("SELECT * FROM categories WHERE active = 1 ORDER BY name ASC")).map(categoryFromRow);
  res.json({ categories });
}));

app.get("/api/products", asyncHandler(async (req, res) => {
  res.json({ products: await getProducts({ includeInactive: false }) });
}));

app.get("/api/products/:slug", asyncHandler(async (req, res, next) => {
  const row = await dbGet(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.slug = ? AND p.active = 1
  `, [req.params.slug]);
  const product = productFromRow(row);
  if (!product) return next(httpError(404, "Producto no encontrado."));
  res.json({ product });
}));

app.get("/api/orders/:code", orderLookupLimiter, asyncHandler(async (req, res, next) => {
  const order = await getOrderByCode(req.params.code);
  if (!order) return next(httpError(404, "Pedido no encontrado."));
  res.json({ order: publicOrder(order) });
}));

app.post("/api/orders/whatsapp", checkoutLimiter, asyncHandler(async (req, res) => {
  const deliveryMethod = normalizeDeliveryMethod(req.body.delivery_method);
  const customer = validateCustomer(req.body.customer || {}, deliveryMethod);
  const cart = await calculateCart(req.body.items || []);
  const order = await insertOrder({
    customer,
    cart,
    deliveryMethod,
    paymentMethod: "whatsapp",
    paymentStatus: "pending",
    status: "new",
    source: "storefront"
  });

  await decrementStock(cart.items);
  await syncCustomerFromOrder(order);
  sendOrderEmail(order).catch((error) => {
    console.warn(error.message);
    return markOrderEmailFailed(order.id, error);
  });
  res.status(201).json({
    order: publicOrder(order),
    whatsappUrl: getWhatsappUrl(order)
  });
}));

app.post("/api/paypal/create-order", checkoutLimiter, asyncHandler(async (req, res) => {
  if (!paypalConfigured()) throw httpError(503, "PayPal no está disponible por ahora.");
  const deliveryMethod = normalizeDeliveryMethod(req.body.delivery_method);
  if (deliveryMethod === "pickup") {
    throw httpError(400, "Para retiro, confirma el pedido por WhatsApp para coordinar directamente.");
  }
  const customer = validateCustomer(req.body.customer || {}, deliveryMethod);
  const cart = await calculateCart(req.body.items || []);

  const draftOrder = {
    order_code: createOrderCode(),
    total: cart.total
  };
  const paypalOrder = await createPaypalOrder(draftOrder);

  const order = await insertOrder({
    customer,
    cart,
    deliveryMethod,
    paymentMethod: "paypal",
    paymentStatus: "pending",
    status: "waiting_payment",
    source: "storefront",
    paypalOrderId: paypalOrder.paypalOrderId
  });

  await dbRun("UPDATE orders SET order_code = ?, updated_at = ? WHERE id = ?", [draftOrder.order_code, now(), order.id]);
  const finalOrder = await getOrderById(order.id);
  await syncCustomerFromOrder(finalOrder);

  res.status(201).json({
    order: publicOrder(finalOrder),
    paypalOrderId: paypalOrder.paypalOrderId,
    approvalUrl: paypalOrder.approvalUrl
  });
}));

app.post("/api/paypal/capture", checkoutLimiter, asyncHandler(async (req, res) => {
  const paypalOrderId = cleanText(req.body.paypalOrderId || req.body.token);
  if (!paypalOrderId) throw httpError(400, "Falta el id de la orden PayPal.");

  const order = await dbGet("SELECT * FROM orders WHERE paypal_order_id = ?", [paypalOrderId]);
  if (!order) throw httpError(404, "No encontramos el pedido local de PayPal.");
  if (order.payment_status === "paid") {
    return res.json({ order: publicOrder(order), capture: { status: "ALREADY_CAPTURED" } });
  }

  const capture = await capturePaypalOrder(paypalOrderId);
  const status = capture.status === "COMPLETED" ? "paid" : "pending";
  const nextOrderStatus = status === "paid" ? "paid" : "waiting_payment";

  await dbRun(`
    UPDATE orders
    SET payment_status = ?, status = ?, updated_at = ?
    WHERE id = ?
  `, [status, nextOrderStatus, now(), order.id]);

  if (status === "paid") {
    await decrementStock(parseJsonList(order.items_json));
    const paidOrder = await getOrderById(order.id);
    await syncCustomerFromOrder(paidOrder);
    sendOrderEmail(paidOrder).catch((error) => {
      console.warn(error.message);
      return markOrderEmailFailed(order.id, error);
    });
  }

  res.json({ order: publicOrder(await getOrderById(order.id)), capture });
}));

app.post("/api/admin/password-reset/request", passwordResetLimiter, asyncHandler(async (req, res) => {
  const email = cleanText(req.body.email).toLowerCase();
  const generic = { ok: true, message: "Si el correo está autorizado, enviaremos un enlace de recuperación." };

  if (adminEmailMatches(email) && resendConfigured()) {
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const resetUrl = `${PUBLIC_BASE_URL}/admin?reset=${encodeURIComponent(token)}`;

    await dbRun(`
      INSERT INTO password_reset_tokens (email, token_hash, expires_at, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [email, tokenHash, expiresAt, clientIp(req), now()]);

    await sendResendEmail({
      to: email,
      subject: `${STORE_NAME}: recuperar acceso al panel`,
      text: [
        "Recibimos una solicitud para recuperar el acceso al panel.",
        "",
        `Abre este enlace para crear una nueva clave:`,
        resetUrl,
        "",
        "Este enlace vence en 30 minutos. Si no pediste esto, ignora este correo."
      ].join("\n")
    });

    await auditLog(req, {
      action: "admin.password_reset_requested",
      entityType: "session",
      entityId: email,
      summary: "Solicitud de recuperación enviada por Resend"
    });
  }

  res.json(generic);
}));

app.post("/api/admin/password-reset/confirm", passwordResetLimiter, asyncHandler(async (req, res) => {
  const token = cleanText(req.body.token);
  const password = String(req.body.password || "");
  if (!token || password.length < 12) {
    throw httpError(400, "La nueva clave debe tener mínimo 12 caracteres.");
  }

  const tokenHash = hashResetToken(token);
  const reset = await dbGet(`
    SELECT * FROM password_reset_tokens
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
    ORDER BY id DESC
    LIMIT 1
  `, [tokenHash, now()]);

  if (!reset || !adminEmailMatches(reset.email)) {
    throw httpError(400, "El enlace de recuperación no es válido o ya venció.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await setAppSetting("admin_password_hash", passwordHash);
  await dbRun("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?", [now(), reset.id]);

  await auditLog(req, {
    action: "admin.password_reset_confirmed",
    entityType: "session",
    entityId: reset.email,
    summary: "Clave admin actualizada por enlace de recuperación"
  });

  res.json({ ok: true, message: "Clave actualizada. Ya puedes entrar con la nueva clave." });
}));

app.post("/api/admin/login", loginLimiter, asyncHandler(async (req, res, next) => {
  if (!adminEmailMatches(req.body.email) || !(await passwordMatches(req.body.password))) {
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
  await auditLog(req, {
    action: "admin.login",
    entityType: "session",
    entityId: cleanText(req.body.email).toLowerCase(),
    summary: "Inicio de sesión admin correcto"
  });
  res.json({
    ok: true,
    csrfToken,
    expiresAt
  });
}));

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

app.get("/api/admin/summary", requireAdmin, asyncHandler(async (req, res) => {
  const productCount = await dbGet("SELECT COUNT(*) AS count FROM products");
  const activeProducts = await dbGet("SELECT COUNT(*) AS count FROM products WHERE active = 1");
  const orderCount = await dbGet("SELECT COUNT(*) AS count FROM orders");
  const pendingOrders = await dbGet("SELECT COUNT(*) AS count FROM orders WHERE status IN ('new', 'waiting_payment')");
  const revenue = await dbGet("SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE payment_status = 'paid'");
  res.json({
    productCount: Number(productCount?.count || 0),
    activeProducts: Number(activeProducts?.count || 0),
    orderCount: Number(orderCount?.count || 0),
    pendingOrders: Number(pendingOrders?.count || 0),
    revenue: money(revenue?.total)
  });
}));

app.get("/api/admin/banners", requireAdmin, asyncHandler(async (req, res) => {
  res.json({ banners: await getStoreBanners({ includeInactive: true }) });
}));

app.post("/api/admin/banners", requireAdmin, asyncHandler(async (req, res) => {
  const current = await getStoreBanners({ includeInactive: true });
  if (current.length >= MAX_STORE_BANNERS) {
    throw httpError(400, `Solo puedes tener hasta ${MAX_STORE_BANNERS} banners.`);
  }
  const banner = bannerFromInput(req.body);
  const banners = await saveStoreBanners([banner, ...current]);
  await auditLog(req, {
    action: "banner.create",
    entityType: "banner",
    entityId: banner.id,
    summary: `Banner creado: ${banner.title}`,
    metadata: { banner }
  });
  res.status(201).json({ banner, banners });
}));

app.put("/api/admin/banners/:id", requireAdmin, asyncHandler(async (req, res, next) => {
  const id = cleanText(req.params.id);
  const current = await getStoreBanners({ includeInactive: true });
  const existing = current.find((banner) => banner.id === id);
  if (!existing) return next(httpError(404, "Banner no encontrado."));
  const updated = bannerFromInput(req.body, existing);
  const banners = await saveStoreBanners(current.map((banner) => (banner.id === id ? updated : banner)));
  await auditLog(req, {
    action: "banner.update",
    entityType: "banner",
    entityId: updated.id,
    summary: `Banner actualizado: ${updated.title}`,
    metadata: { before: existing, after: updated }
  });
  res.json({ banner: updated, banners });
}));

app.delete("/api/admin/banners/:id", requireAdmin, asyncHandler(async (req, res, next) => {
  const id = cleanText(req.params.id);
  const current = await getStoreBanners({ includeInactive: true });
  const existing = current.find((banner) => banner.id === id);
  if (!existing) return next(httpError(404, "Banner no encontrado."));
  const banners = await saveStoreBanners(current.filter((banner) => banner.id !== id));
  await auditLog(req, {
    action: "banner.delete",
    entityType: "banner",
    entityId: id,
    summary: `Banner eliminado: ${existing.title}`,
    metadata: { before: existing }
  });
  res.json({ ok: true, banners });
}));

app.get("/api/admin/analytics", requireAdmin, asyncHandler(async (req, res) => {
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
  const productIndex = await getProductPrivateIndex();
  const products = Array.from(productIndex.values());
  const orders = await dbAll("SELECT * FROM orders ORDER BY created_at ASC");
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
}));

app.get("/api/admin/categories", requireAdmin, asyncHandler(async (req, res) => {
  const categories = (await dbAll("SELECT * FROM categories ORDER BY active DESC, name ASC")).map(categoryFromRow);
  res.json({ categories });
}));

app.post("/api/admin/categories", requireAdmin, asyncHandler(async (req, res) => {
  const name = cleanText(req.body.name);
  if (name.length < 2) throw httpError(400, "La categoría necesita nombre.");
  const slug = await ensureUniqueSlug("categories", name);
  const result = await dbRun(`
    INSERT INTO categories (name, slug, description, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [name, slug, cleanText(req.body.description), boolToInt(req.body.active ?? true), now(), now()]);
  const category = categoryFromRow(await dbGet("SELECT * FROM categories WHERE id = ?", [result.insertId]));
  await auditLog(req, {
    action: "category.create",
    entityType: "category",
    entityId: String(category.id),
    summary: `Categoría creada: ${category.name}`,
    metadata: { category }
  });
  res.status(201).json({ category });
}));

app.put("/api/admin/categories/:id", requireAdmin, asyncHandler(async (req, res, next) => {
  const id = Number(req.params.id);
  const current = await dbGet("SELECT * FROM categories WHERE id = ?", [id]);
  if (!current) return next(httpError(404, "Categoría no encontrada."));
  const name = cleanText(req.body.name);
  if (name.length < 2) throw httpError(400, "La categoría necesita nombre.");
  const slug = await ensureUniqueSlug("categories", name, id);
  await dbRun(`
    UPDATE categories
    SET name = ?, slug = ?, description = ?, active = ?, updated_at = ?
    WHERE id = ?
  `, [name, slug, cleanText(req.body.description), boolToInt(req.body.active), now(), id]);
  const category = categoryFromRow(await dbGet("SELECT * FROM categories WHERE id = ?", [id]));
  await auditLog(req, {
    action: "category.update",
    entityType: "category",
    entityId: String(id),
    summary: `Categoría actualizada: ${category.name}`,
    metadata: { before: categoryFromRow(current), after: category }
  });
  res.json({ category });
}));

app.delete("/api/admin/categories/:id", requireAdmin, asyncHandler(async (req, res, next) => {
  const id = Number(req.params.id);
  const category = await dbGet("SELECT * FROM categories WHERE id = ?", [id]);
  if (!category) return next(httpError(404, "Categoría no encontrada."));
  const productCount = await dbGet("SELECT COUNT(*) AS count FROM products WHERE category_id = ?", [id]);
  if (Number(productCount?.count || 0) > 0) {
    return next(httpError(409, "No se puede eliminar una categoría con productos. Mueve o elimina esos productos primero."));
  }
  await dbRun("DELETE FROM categories WHERE id = ?", [id]);
  await auditLog(req, {
    action: "category.delete",
    entityType: "category",
    entityId: String(id),
    summary: `Categoría eliminada: ${category.name}`,
    metadata: { before: categoryFromRow(category) }
  });
  res.json({ ok: true });
}));

async function validateAdminProductInput(body) {
  const name = cleanText(body.name);
  if (name.length < 2) throw httpError(400, "El producto necesita nombre.");
  const brandName = cleanText(body.brand_name || body.brand || "");
  if (brandName.length > 120) throw httpError(400, "La marca debe tener máximo 120 caracteres.");

  const categoryId = Number(body.category_id || 0);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw httpError(400, "Selecciona una categoría para el producto.");
  }
  const category = await dbGet("SELECT id FROM categories WHERE id = ?", [categoryId]);
  if (!category) throw httpError(400, "La categoría seleccionada no existe.");

  const price = money(body.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw httpError(400, "El precio de venta debe ser mayor a 0.");
  }
  if (price > 99999) throw httpError(400, "El precio de venta supera el límite permitido.");

  const costPrice = money(body.cost_price);
  if (!Number.isFinite(costPrice) || costPrice < 0) {
    throw httpError(400, "El precio de compra no puede ser negativo.");
  }

  const stock = Number(body.stock);
  if (!Number.isInteger(stock) || stock < 0 || stock > 999) {
    throw httpError(400, "El stock debe ser un número entero entre 0 y 999.");
  }

  const imageUrl = cleanText(body.image_url);
  if (!imageUrl || imageUrl.includes("product-placeholder.svg")) {
    throw httpError(400, "Sube una foto real del producto.");
  }
  const imageFit = normalizeImageFit(body.image_fit);
  const imagePositionX = clampImagePercent(body.image_position_x, 50);
  const imagePositionY = clampImagePercent(body.image_position_y, 50);
  const imageZoom = clampImageZoom(body.image_zoom);

  const promoType = normalizePromoType(body.promo_type);
  const comparePrice = promoType === "discount" ? money(body.compare_price) : 0;
  if (promoType === "discount" && (!Number.isFinite(comparePrice) || comparePrice <= price)) {
    throw httpError(400, "El precio antes del descuento debe ser mayor al precio de venta.");
  }

  return {
    name,
    brandName,
    categoryId,
    price,
    costPrice,
    comparePrice,
    stock,
    imageUrl,
    imageFit,
    imagePositionX,
    imagePositionY,
    imageZoom,
    promoType
  };
}

app.get("/api/admin/products", requireAdmin, asyncHandler(async (req, res) => {
  res.json({ products: await getProducts({ includeInactive: true, includePrivate: true }) });
}));

app.post("/api/admin/products", requireAdmin, asyncHandler(async (req, res) => {
  const {
    name,
    brandName,
    categoryId,
    price,
    costPrice,
    comparePrice,
    stock,
    imageUrl,
    imageFit,
    imagePositionX,
    imagePositionY,
    imageZoom,
    promoType
  } = await validateAdminProductInput(req.body);
  const slug = await ensureUniqueSlug("products", name);
  const result = await dbRun(`
    INSERT INTO products (
      category_id, name, brand_name, slug, description, price, cost_price, compare_price, stock, sku, image_url,
      image_fit, image_position_x, image_position_y, image_zoom,
      sizes_json, colors_json, promo_type, promo_label, active, featured, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    categoryId,
    name,
    brandName,
    slug,
    cleanText(req.body.description),
    price,
    costPrice,
    comparePrice,
    stock,
    cleanText(req.body.sku),
    imageUrl,
    imageFit,
    imagePositionX,
    imagePositionY,
    imageZoom,
    JSON.stringify(incomingList(req.body.sizes)),
    JSON.stringify(incomingList(req.body.colors)),
    promoType,
    promoLabelFor(promoType, req.body.promo_label),
    boolToInt(req.body.active ?? true),
    boolToInt(req.body.featured),
    now(),
    now()
  ]);
  const product = await getProductById(result.insertId, { includePrivate: true });
  await auditLog(req, {
    action: "product.create",
    entityType: "product",
    entityId: String(product.id),
    summary: `Producto creado: ${product.name}`,
    metadata: { product }
  });
  res.status(201).json({ product });
}));

app.put("/api/admin/products/:id", requireAdmin, asyncHandler(async (req, res, next) => {
  const id = Number(req.params.id);
  const current = await getProductById(id);
  if (!current) return next(httpError(404, "Producto no encontrado."));
  const {
    name,
    brandName,
    categoryId,
    price,
    costPrice,
    comparePrice,
    stock,
    imageUrl,
    imageFit,
    imagePositionX,
    imagePositionY,
    imageZoom,
    promoType
  } = await validateAdminProductInput(req.body);
  const slug = await ensureUniqueSlug("products", name, id);
  await dbRun(`
    UPDATE products
    SET category_id = ?, name = ?, brand_name = ?, slug = ?, description = ?, price = ?, cost_price = ?, compare_price = ?, stock = ?, sku = ?,
        image_url = ?, image_fit = ?, image_position_x = ?, image_position_y = ?, image_zoom = ?,
        sizes_json = ?, colors_json = ?, promo_type = ?, promo_label = ?, active = ?, featured = ?, updated_at = ?
    WHERE id = ?
  `, [
    categoryId,
    name,
    brandName,
    slug,
    cleanText(req.body.description),
    price,
    costPrice,
    comparePrice,
    stock,
    cleanText(req.body.sku),
    imageUrl,
    imageFit,
    imagePositionX,
    imagePositionY,
    imageZoom,
    JSON.stringify(incomingList(req.body.sizes)),
    JSON.stringify(incomingList(req.body.colors)),
    promoType,
    promoLabelFor(promoType, req.body.promo_label),
    boolToInt(req.body.active),
    boolToInt(req.body.featured),
    now(),
    id
  ]);
  const product = await getProductById(id, { includePrivate: true });
  await auditLog(req, {
    action: "product.update",
    entityType: "product",
    entityId: String(id),
    summary: `Producto actualizado: ${product.name}`,
    metadata: {
      before: current,
      after: product,
      changes: {
        price: [current.price, product.price],
        cost_price: [current.cost_price, product.cost_price],
        stock: [current.stock, product.stock],
        active: [current.active, product.active]
      }
    }
  });
  res.json({ product });
}));

app.delete("/api/admin/products/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const product = await getProductById(id, { includePrivate: true });
  await dbRun("DELETE FROM products WHERE id = ?", [id]);
  await auditLog(req, {
    action: "product.delete",
    entityType: "product",
    entityId: String(id),
    summary: `Producto eliminado: ${product?.name || id}`,
    metadata: { before: product }
  });
  res.json({ ok: true });
}));

app.post("/api/admin/upload", requireAdmin, upload.single("image"), asyncHandler(async (req, res) => {
  assertSafeImageUpload(req.file);
  const result = await uploadToCloudinary(req.file);
  await auditLog(req, {
    action: "image.upload",
    entityType: "asset",
    entityId: result.public_id || result.url,
    summary: "Imagen subida desde el panel",
    metadata: { provider: result.provider, url: result.url }
  });
  res.status(201).json(result);
}));

app.get("/api/admin/cloudinary/status", requireAdmin, (req, res) => {
  const config = cloudinaryConfig();
  res.json({
    configured: Boolean(config.cloudName && config.apiKey && config.apiSecret),
    cloudName: maskValue(config.cloudName),
    apiKey: maskValue(config.apiKey),
    apiSecretConfigured: Boolean(config.apiSecret),
    apiSecretLength: config.apiSecret.length,
    folder: config.folder,
    usesCloudinaryUrl: Boolean(cleanEnvValue(process.env.CLOUDINARY_URL)),
    warnings: cloudinaryWarnings(config)
  });
});

app.get("/api/admin/email/status", requireAdmin, (req, res) => {
  res.json({
    configured: resendConfigured(),
    apiKeyConfigured: Boolean(cleanText(process.env.RESEND_API_KEY)),
    fromConfigured: Boolean(cleanText(process.env.RESEND_FROM_EMAIL)),
    ownerConfigured: Boolean(cleanText(process.env.RESEND_TO_EMAIL || process.env.STORE_OWNER_EMAIL)),
    fromEmail: maskValue(process.env.RESEND_FROM_EMAIL, 2, 10),
    ownerEmail: maskValue(process.env.RESEND_TO_EMAIL || process.env.STORE_OWNER_EMAIL, 2, 10)
  });
});

app.get("/api/admin/customers", requireAdmin, asyncHandler(async (req, res) => {
  const customers = (await dbAll(`
    SELECT *
    FROM customers
    ORDER BY last_order_at DESC, updated_at DESC
  `)).map(publicCustomer);
  res.json({ customers });
}));

app.get("/api/admin/customers/export", requireAdmin, asyncHandler(async (req, res) => {
  const customers = (await dbAll(`
    SELECT *
    FROM customers
    ORDER BY last_order_at DESC, updated_at DESC
  `)).map(publicCustomer);
  const filename = `gstore-clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(customersToCsv(customers));
}));

app.get("/api/admin/orders", requireAdmin, asyncHandler(async (req, res) => {
  const orders = (await dbAll("SELECT * FROM orders ORDER BY created_at DESC"))
    .map((order) => publicOrder(order, { includeAdmin: true }));
  res.json({ orders });
}));

app.get("/api/admin/audit-logs", requireAdmin, asyncHandler(async (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));
  const logs = await dbAll(`
    SELECT id, actor_email, action, entity_type, entity_id, summary, metadata_json, ip_address, user_agent, created_at
    FROM audit_logs
    ORDER BY id DESC
    LIMIT ${limit}
  `);
  res.json({
    logs: logs.map((log) => ({
      ...log,
      metadata: parseJsonObject(log.metadata_json)
    }))
  });
}));

app.patch("/api/admin/orders/:id/status", requireAdmin, asyncHandler(async (req, res, next) => {
  const id = Number(req.params.id);
  const allowed = ["new", "waiting_payment", "paid", "preparing", "ready", "sent", "completed", "cancelled"];
  const status = cleanText(req.body.status);
  if (!allowed.includes(status)) throw httpError(400, "Estado no válido.");
  const order = await getOrderById(id);
  if (!order) return next(httpError(404, "Pedido no encontrado."));
  await dbRun("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", [status, now(), id]);
  const updatedOrder = await getOrderById(id);
  await syncCustomerFromOrder(updatedOrder);
  await auditLog(req, {
    action: "order.status_update",
    entityType: "order",
    entityId: String(id),
    summary: `Pedido ${updatedOrder.order_code}: ${order.status} -> ${updatedOrder.status}`,
    metadata: {
      order_code: updatedOrder.order_code,
      before: { status: order.status, payment_status: order.payment_status },
      after: { status: updatedOrder.status, payment_status: updatedOrder.payment_status }
    }
  });
  res.json({ order: publicOrder(updatedOrder, { includeAdmin: true }) });
}));

app.post("/api/admin/orders/:id/email", requireAdmin, asyncHandler(async (req, res, next) => {
  const order = await getOrderById(Number(req.params.id));
  if (!order) return next(httpError(404, "Pedido no encontrado."));
  const email = await sendOrderEmail(order);
  const updatedOrder = await getOrderById(order.id);
  await auditLog(req, {
    action: "order.email_resend",
    entityType: "order",
    entityId: String(order.id),
    summary: `Correo reenviado para ${order.order_code}`,
    metadata: {
      order_code: order.order_code,
      admin_email_status: updatedOrder.admin_email_status,
      customer_email_status: updatedOrder.customer_email_status,
      email_error: updatedOrder.email_error || ""
    }
  });
  res.json({ order: publicOrder(updatedOrder, { includeAdmin: true }), email });
}));

app.get("/api/admin/orders/:id/whatsapp", requireAdmin, asyncHandler(async (req, res, next) => {
  const order = await getOrderById(Number(req.params.id));
  if (!order) return next(httpError(404, "Pedido no encontrado."));
  res.json({ whatsappUrl: getWhatsappUrl(order) });
}));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next(httpError(404, "Ruta no encontrada."));
  }
  res.status(404).sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error({
      message: err.message,
      method: req.method,
      path: req.path,
      stack: err.stack
    });
  }
  const showAdminDetail = req.path.startsWith("/api/admin/") && req.admin;
  const publicMessage = IS_PRODUCTION && status >= 500 && !showAdminDetail
    ? "Algo salio mal en el servidor."
    : err.message || "Algo salio mal.";
  res.status(status).json({ error: publicMessage });
});

if (require.main === module) {
  initializeApp()
    .then(() => {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`${STORE_NAME} listo en 0.0.0.0:${PORT}`);
        console.log(`Tienda publica: ${PUBLIC_BASE_URL}`);
        console.log(`Panel protegido: ${PUBLIC_BASE_URL}/admin`);
      });
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = app;
module.exports.initializeApp = initializeApp;
