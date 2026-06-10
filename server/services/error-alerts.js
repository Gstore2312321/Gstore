function createErrorAlerter(options = {}) {
  const {
    cleanText,
    clientIp,
    errorAlertEmail,
    isProduction,
    minMinutes = 15,
    now,
    resendApiKey,
    sendEmail,
    shortUserAgent,
    storeName,
    fallbackEmail
  } = options;
  let lastAlertAt = 0;

  return async function sendServerErrorAlert(error, req, status) {
    if (!isProduction || status < 500 || !resendApiKey) return { skipped: true };
    const to = cleanText(errorAlertEmail || fallbackEmail);
    if (!to) return { skipped: true };
    const nowMs = Date.now();
    if (nowMs - lastAlertAt < minMinutes * 60 * 1000) return { skipped: true, throttled: true };
    lastAlertAt = nowMs;

    const text = [
      `${storeName}: error ${status}`,
      "",
      `Fecha: ${now()}`,
      `Metodo: ${req.method}`,
      `Ruta: ${req.originalUrl || req.path}`,
      `IP: ${clientIp(req)}`,
      `User-Agent: ${shortUserAgent(req)}`,
      "",
      `Mensaje: ${cleanText(error.message || "Error sin mensaje")}`,
      "",
      cleanText(error.stack || "").slice(0, 1800)
    ].filter(Boolean).join("\n");

    return sendEmail({
      to,
      subject: `${storeName}: alerta de error ${status}`,
      text
    });
  };
}

module.exports = { createErrorAlerter };
