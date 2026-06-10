require("dotenv").config();

function clean(value) {
  return String(value || "").trim();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function healthUrl() {
  const explicit = clean(process.env.GSTORE_HEALTH_URL);
  const base = clean(process.env.PUBLIC_BASE_URL);
  const value = explicit || base;
  if (!value) fail("Falta GSTORE_HEALTH_URL o PUBLIC_BASE_URL.");
  if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(value) && process.env.ALLOW_LOCAL_HEALTH !== "1") {
    fail("El monitoreo externo no debe apuntar a localhost. Usa el dominio final.");
  }
  if (value.endsWith("/api/health")) return value;
  return `${value.replace(/\/$/, "")}/api/health`;
}

async function main() {
  const url = healthUrl();
  const started = Date.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(Number(process.env.HEALTH_TIMEOUT_MS || 12000)) });
  const elapsedMs = Date.now() - started;
  const data = await response.json().catch(() => ({}));
  const ok = response.ok && data.ok === true;
  const result = {
    ok,
    url,
    status: response.status,
    elapsedMs,
    checkedAt: new Date().toISOString(),
    service: data.service || data.name || "gstore"
  };
  console.log(JSON.stringify(result, null, 2));
  if (!ok) process.exit(1);
}

main().catch((error) => fail(error.message));
