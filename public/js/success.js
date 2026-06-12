const params = new URLSearchParams(window.location.search);
const title = document.querySelector("#successTitle");
const text = document.querySelector("#successText");
const eyebrow = document.querySelector("#successEyebrow");
const details = document.querySelector("#successDetails");
const API_BASE = window.location.protocol === "file:" ? "http://localhost:4321" : "";
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

document.addEventListener("DOMContentLoaded", initSuccess);

async function initSuccess() {
  const code = params.get("order");
  const token = params.get("token");
  const cancelled = params.get("cancelled");

  if (cancelled) {
    eyebrow.textContent = "Pago cancelado";
    title.textContent = "El pago no se completó.";
    text.textContent = "Tu pedido queda pendiente. Puedes volver a la tienda y elegir WhatsApp si prefieres coordinar directo.";
    if (code) await loadOrder(code);
    return;
  }

  if (token) {
    eyebrow.textContent = "PayPal";
    title.textContent = "Confirmando el pago...";
    text.textContent = "Estamos verificando PayPal.";
    try {
      const response = await fetch(`${API_BASE}/api/paypal/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paypalOrderId: token })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo confirmar PayPal.");
      renderPaidOrder(data.order);
    } catch (error) {
      title.textContent = "No pudimos confirmar el pago.";
      text.textContent = error.message;
    }
    return;
  }

  if (code) {
    await loadOrder(code);
  }
}

async function loadOrder(code) {
  try {
    const response = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(code)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No encontramos el pedido.");
    renderOrder(data.order);
  } catch (error) {
    details.innerHTML = "";
    text.textContent = error.message;
  }
}

function renderPaidOrder(order) {
  eyebrow.textContent = "Pago confirmado";
  title.textContent = "Tu pedido quedó pagado.";
  text.textContent = "GStore ya puede preparar la entrega o coordinar los detalles contigo.";
  renderDetails(order);
}

function renderOrder(order) {
  eyebrow.textContent = "Pedido recibido";
  title.textContent = "Tu pedido quedó registrado.";
  text.textContent = order.payment_method === "paypal"
    ? "El pago está pendiente de confirmación."
    : "La conversación de WhatsApp queda lista para confirmar disponibilidad y entrega.";
  renderDetails(order);
}

function renderDetails(order) {
  const orderCode = String(order.order_code || "").trim();
  details.innerHTML = `
    <div><span>Pedido</span><strong>${escapeHtml(orderCode ? `#${orderCode}` : "#")}</strong></div>
    <div><span>Estado</span><strong>${escapeHtml(statusLabels[order.status] || order.status)}</strong></div>
    <div><span>Total</span><strong>${formatCurrency(order.total)}</strong></div>
  `;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
