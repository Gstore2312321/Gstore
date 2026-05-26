const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const PRODUCTS_FILE = path.join(ROOT_DIR, "data", "imported-products.json");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const CLOUDINARY_IMAGE_RE = /^https:\/\/res\.cloudinary\.com\/.+\/image\/upload\//i;

loadEnvFile(path.join(ROOT_DIR, ".env"));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

function clean(value, fallback = "") {
  let text = String(value || fallback).trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function parseCloudinaryUrl(value) {
  const text = clean(value);
  if (!text) return {};
  try {
    const url = new URL(text);
    if (url.protocol !== "cloudinary:") return {};
    return {
      cloudName: clean(url.hostname),
      apiKey: clean(decodeURIComponent(url.username || "")),
      apiSecret: clean(decodeURIComponent(url.password || ""))
    };
  } catch {
    return {};
  }
}

function cloudinaryConfig() {
  const fromUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
  return {
    cloudName: clean(process.env.CLOUDINARY_CLOUD_NAME, fromUrl.cloudName),
    apiKey: clean(process.env.CLOUDINARY_API_KEY, fromUrl.apiKey),
    apiSecret: clean(process.env.CLOUDINARY_API_SECRET, fromUrl.apiSecret),
    folder: clean(process.env.CLOUDINARY_FOLDER, "gstore/productos")
  };
}

function assertCloudinaryConfig(config) {
  const missing = [];
  if (!config.cloudName) missing.push("CLOUDINARY_CLOUD_NAME");
  if (!config.apiKey) missing.push("CLOUDINARY_API_KEY");
  if (!config.apiSecret) missing.push("CLOUDINARY_API_SECRET");
  if (missing.length) {
    throw new Error(`Faltan credenciales API de Cloudinary: ${missing.join(", ")}. Tambien puedes usar CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME.`);
  }
  if (config.apiKey === config.apiSecret) {
    throw new Error("CLOUDINARY_API_SECRET no puede ser igual a CLOUDINARY_API_KEY.");
  }
}

function signCloudinaryParams(params, apiSecret) {
  const stringToSign = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto.createHash("sha1").update(`${stringToSign}${apiSecret}`).digest("hex");
}

function mimeTypeFor(filePath, buffer) {
  const ext = path.extname(filePath).toLowerCase();
  const isJpg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (isJpg || ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (isPng || ext === ".png") return "image/png";
  if (isWebp || ext === ".webp") return "image/webp";
  throw new Error(`Formato no permitido: ${filePath}`);
}

function localImagePath(image) {
  const cleaned = clean(image);
  if (!cleaned || CLOUDINARY_IMAGE_RE.test(cleaned)) return "";
  const relative = cleaned.replace(/^\/+/, "");
  return path.join(PUBLIC_DIR, relative);
}

function publicIdFor(product, filePath) {
  const sku = clean(product.sku).toLowerCase();
  const baseName = path.basename(filePath, path.extname(filePath)).toLowerCase();
  return `${sku || "producto"}-${baseName}`.replace(/[^a-z0-9_-]+/g, "-").slice(0, 110);
}

async function uploadImage(config, product, filePath) {
  const buffer = fs.readFileSync(filePath);
  const mimeType = mimeTypeFor(filePath, buffer);
  const timestamp = String(Math.round(Date.now() / 1000));
  const params = {
    folder: config.folder,
    overwrite: "true",
    public_id: publicIdFor(product, filePath),
    timestamp
  };
  const signature = signCloudinaryParams(params, config.apiSecret);
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), path.basename(filePath));
  form.append("api_key", config.apiKey);
  Object.entries(params).forEach(([key, value]) => form.append(key, value));
  form.append("signature", signature);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`, {
      method: "POST",
      body: form,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `Cloudinary respondio ${response.status}`);
  }
  return data.secure_url;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const config = cloudinaryConfig();
  if (!dryRun) assertCloudinaryConfig(config);

  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
  if (!Array.isArray(products)) throw new Error("data/imported-products.json debe ser un arreglo.");

  let uploaded = 0;
  let skipped = 0;
  const missing = [];

  for (const product of products) {
    const isCloudinary = CLOUDINARY_IMAGE_RE.test(clean(product.image));
    if (isCloudinary && !force) {
      skipped += 1;
      continue;
    }

    const filePath = localImagePath(product.image);
    if (!filePath || !fs.existsSync(filePath)) {
      missing.push(`${product.sku || product.name}: ${product.image}`);
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${product.sku} -> ${path.relative(ROOT_DIR, filePath)}`);
      skipped += 1;
      continue;
    }

    const url = await uploadImage(config, product, filePath);
    product.image = url;
    uploaded += 1;
    console.log(`[cloudinary] ${product.sku} ${product.name} -> ${url}`);
  }

  if (missing.length) {
    throw new Error(`Imagenes faltantes:\n${missing.join("\n")}`);
  }

  if (!dryRun && uploaded > 0) {
    fs.writeFileSync(PRODUCTS_FILE, `${JSON.stringify(products, null, 2)}\n`);
  }

  console.log(JSON.stringify({
    ok: true,
    uploaded,
    skipped,
    total: products.length,
    folder: config.folder
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
