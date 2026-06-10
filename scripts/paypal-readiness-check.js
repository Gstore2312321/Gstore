require("dotenv").config();

function clean(value) {
  return String(value || "").trim();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function paypalMode() {
  return clean(process.env.PAYPAL_MODE) === "live" ? "live" : "sandbox";
}

function paypalBaseUrl() {
  return paypalMode() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function requireEnv(name) {
  const value = clean(process.env[name]);
  if (!value) fail(`Falta ${name}.`);
  return value;
}

async function main() {
  const clientId = requireEnv("PAYPAL_CLIENT_ID");
  const clientSecret = requireEnv("PAYPAL_CLIENT_SECRET");
  const publicBaseUrl = clean(process.env.PUBLIC_BASE_URL);
  const mode = paypalMode();

  if (!publicBaseUrl) fail("Falta PUBLIC_BASE_URL para los return/cancel URLs.");
  if (mode === "live" && !publicBaseUrl.startsWith("https://")) {
    fail("En live, PUBLIC_BASE_URL debe usar https.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(Number(process.env.PAYPAL_CHECK_TIMEOUT_MS || 15000))
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    fail(data.error_description || data.message || `PayPal respondio HTTP ${response.status}.`);
  }

  console.log(JSON.stringify({
    ok: true,
    mode,
    baseUrl: paypalBaseUrl(),
    publicBaseUrl,
    tokenType: data.token_type || "Bearer",
    expiresIn: data.expires_in || null,
    checkedAt: new Date().toISOString()
  }, null, 2));
}

main().catch((error) => fail(error.message));
