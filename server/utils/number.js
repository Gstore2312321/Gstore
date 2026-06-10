function normalizeLocalizedDecimalString(value) {
  let text = String(value ?? "").trim().replace(/\s+/g, "");
  if (!text) return "";
  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  if (hasComma && hasDot) {
    const commaIndex = text.lastIndexOf(",");
    const dotIndex = text.lastIndexOf(".");
    text = commaIndex > dotIndex
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  } else if (hasComma) {
    text = text.replace(",", ".");
  }
  return text.replace(/[^\d.-]/g, "");
}

function numericValue(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const normalized = normalizeLocalizedDecimalString(value);
  if (!normalized) return fallback;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

function money(value) {
  return Math.round(numericValue(value, 0) * 100) / 100;
}

function moneyInput(value, fallback = 0) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const normalized = normalizeLocalizedDecimalString(raw);
  if (!normalized) return Number.NaN;
  const number = Number(normalized);
  return Number.isFinite(number) ? money(number) : Number.NaN;
}

function formatMoney(value) {
  return money(value).toFixed(2);
}

module.exports = {
  formatMoney,
  money,
  moneyInput,
  normalizeLocalizedDecimalString,
  numericValue
};
