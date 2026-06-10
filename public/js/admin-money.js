(function attachAdminMoney(global) {
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

  function normalizeMoneyTypingValue(value) {
    const raw = String(value ?? "");
    if (raw.includes(",") && raw.includes(".")) {
      return normalizeLocalizedDecimalString(raw);
    }
    const text = raw
      .replace(/,/g, ".")
      .replace(/[^\d.]/g, "");
    const parts = text.split(".");
    if (parts.length <= 2) return text;
    return `${parts.shift()}.${parts.join("")}`;
  }

  function parseMoneyInput(value) {
    if (typeof value === "number") return value;
    const normalized = normalizeLocalizedDecimalString(value);
    if (!normalized) return 0;
    return Number(normalized);
  }

  function formatMoneyInput(value) {
    const amount = Math.max(0, parseMoneyInput(value) || 0);
    return (Math.round(amount * 100) / 100).toFixed(2);
  }

  function normalizeMoneyField(field) {
    if (!field || !String(field.value || "").trim()) return;
    const amount = parseMoneyInput(field.value);
    if (Number.isFinite(amount) && amount >= 0) {
      field.value = formatMoneyInput(amount);
    }
  }

  function moneyPayloadValue(value) {
    const amount = parseMoneyInput(value);
    return Number.isFinite(amount) ? formatMoneyInput(amount) : "";
  }

  global.GStoreAdminMoney = {
    formatMoneyInput,
    moneyPayloadValue,
    normalizeLocalizedDecimalString,
    normalizeMoneyField,
    normalizeMoneyTypingValue,
    parseMoneyInput
  };
})(window);
