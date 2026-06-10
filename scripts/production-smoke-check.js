require("dotenv").config();

const mysql = require("mysql2/promise");

const checks = [];

function clean(value) {
  return String(value || "").trim();
}

function addCheck(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
}

function env(name) {
  return clean(process.env[name]);
}

function publicBaseUrl() {
  return env("PUBLIC_BASE_URL").replace(/\/$/, "");
}

function mysqlUrl() {
  return env("MYSQL_URL") || env("MYSQL_PUBLIC_URL") || env("DATABASE_URL");
}

function mysqlOptions(urlValue) {
  const url = new URL(urlValue);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    decimalNumbers: true,
    charset: "utf8mb4"
  };
}

async function checkMysql() {
  const url = mysqlUrl();
  if (!url) {
    addCheck("mysql", false, "Falta MYSQL_URL, MYSQL_PUBLIC_URL o DATABASE_URL.");
    return;
  }
  let connection;
  try {
    connection = await mysql.createConnection(mysqlOptions(url));
    await connection.execute("SELECT 1 AS ok");
    addCheck("mysql", true, "Conexion MySQL OK.");
  } catch (error) {
    addCheck("mysql", false, `No conecta MySQL: ${error.message}`);
  } finally {
    if (connection) await connection.end();
  }
}

async function checkHealth() {
  const baseUrl = publicBaseUrl();
  if (!baseUrl || /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(baseUrl)) {
    addCheck("domain", false, "PUBLIC_BASE_URL debe ser el dominio final, no localhost.");
    return;
  }
  if (!baseUrl.startsWith("https://")) {
    addCheck("domain", false, "PUBLIC_BASE_URL debe usar https en produccion.");
    return;
  }
  try {
    const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(12000) });
    const data = await response.json().catch(() => ({}));
    addCheck("health", response.ok && data.ok === true, response.ok ? "Health remoto OK." : `HTTP ${response.status}`);
  } catch (error) {
    addCheck("health", false, `No responde /api/health: ${error.message}`);
  }
}

function checkRequiredEnv() {
  [
    "NODE_ENV",
    "PUBLIC_BASE_URL",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD_HASH",
    "ADMIN_SECRET",
    "WHATSAPP_ADMIN_PHONE",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "RESEND_TO_EMAIL",
    "ERROR_ALERT_EMAIL",
    "PAYPAL_MODE",
    "PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET"
  ].forEach((name) => {
    addCheck(`env:${name}`, Boolean(env(name)), env(name) ? "Configurada." : "Falta.");
  });

  addCheck("env:NODE_ENV-production", env("NODE_ENV") === "production", "Debe ser production.");
  addCheck("paypal-mode-live", env("PAYPAL_MODE") === "live", "PAYPAL_MODE debe ser live para prueba real.");
  addCheck("admin-secret", env("ADMIN_SECRET").length >= 32, "ADMIN_SECRET minimo 32 caracteres.");
  addCheck("admin-hash", env("ADMIN_PASSWORD_HASH").startsWith("$2"), "ADMIN_PASSWORD_HASH debe ser bcrypt.");
  addCheck(
    "backup:external",
    Boolean(env("BACKUP_COPY_DIR") || env("EXTERNAL_BACKUP_CONFIGURED") === "1"),
    "Configura BACKUP_COPY_DIR en un job externo o marca EXTERNAL_BACKUP_CONFIGURED=1 cuando ya exista backup fuera de Railway."
  );
  addCheck(
    "cloudinary-secret",
    env("CLOUDINARY_API_SECRET") && env("CLOUDINARY_API_SECRET") !== env("CLOUDINARY_API_KEY"),
    "API secret no debe ser igual al API key."
  );
}

async function main() {
  checkRequiredEnv();
  await checkMysql();
  await checkHealth();

  const failed = checks.filter((check) => !check.ok);
  const result = {
    ok: failed.length === 0,
    checked_at: new Date().toISOString(),
    checks
  };
  console.log(JSON.stringify(result, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
