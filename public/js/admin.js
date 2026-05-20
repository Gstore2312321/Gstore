const ADMIN_TOKEN_KEY = "gstore_admin_token";
const ADMIN_CSRF_KEY = "gstore_admin_csrf";
localStorage.removeItem(ADMIN_TOKEN_KEY);
sessionStorage.removeItem(ADMIN_TOKEN_KEY);

const adminState = {
  csrfToken: sessionStorage.getItem(ADMIN_CSRF_KEY) || "",
  page: document.body.dataset.adminPage || "dashboard",
  products: [],
  categories: [],
  orders: [],
  analytics: null,
  charts: {},
  productSearch: "",
  productStatusFilter: "all",
  productOptions: {
    sizes: [],
    colors: []
  },
  pendingConfirm: null
};

const API_BASE = window.location.protocol === "file:" ? "http://localhost:4321" : "";

const adminEls = {
  loginView: document.querySelector("#loginView"),
  dashboardView: document.querySelector("#dashboardView"),
  loginForm: document.querySelector("#loginForm"),
  loginMessage: document.querySelector("#loginMessage"),
  forgotPasswordButton: document.querySelector("#forgotPasswordButton"),
  resetRequestForm: document.querySelector("#resetRequestForm"),
  resetRequestMessage: document.querySelector("#resetRequestMessage"),
  resetConfirmForm: document.querySelector("#resetConfirmForm"),
  resetConfirmMessage: document.querySelector("#resetConfirmMessage"),
  logoutButton: document.querySelector("#logoutButton"),
  sidebarStatus: document.querySelector("#sidebarStatus"),
  summaryProducts: document.querySelector("#summaryProducts"),
  summaryActive: document.querySelector("#summaryActive"),
  summaryOrders: document.querySelector("#summaryOrders"),
  summaryRevenue: document.querySelector("#summaryRevenue"),
  summaryProfit: document.querySelector("#summaryProfit"),
  summaryMargin: document.querySelector("#summaryMargin"),
  summaryInventoryProfit: document.querySelector("#summaryInventoryProfit"),
  summaryLowStock: document.querySelector("#summaryLowStock"),
  stockActionText: document.querySelector("#stockActionText"),
  dashboardPendingText: document.querySelector("#dashboardPendingText"),
  profitSummaryText: document.querySelector("#profitSummaryText"),
  salesProfitChart: document.querySelector("#salesProfitChart"),
  productProfitChart: document.querySelector("#productProfitChart"),
  categoryProfitChart: document.querySelector("#categoryProfitChart"),
  orderStatusChart: document.querySelector("#orderStatusChart"),
  insightLowStock: document.querySelector("#insightLowStock"),
  insightActiveCategories: document.querySelector("#insightActiveCategories"),
  insightLatestOrderTitle: document.querySelector("#insightLatestOrderTitle"),
  insightLatestOrder: document.querySelector("#insightLatestOrder"),
  productForm: document.querySelector("#productForm"),
  productMessage: document.querySelector("#productMessage"),
  productCategorySelect: document.querySelector("#productCategorySelect"),
  productsTable: document.querySelector("#productsTable"),
  productShelfNotes: document.querySelector("#productShelfNotes"),
  productSearch: document.querySelector("#productSearch"),
  productStatusFilter: document.querySelector("#productStatusFilter"),
  productDrawer: document.querySelector("#productDrawer"),
  productDrawerTitle: document.querySelector("#productDrawerTitle"),
  productDrawerKicker: document.querySelector("#productDrawerKicker"),
  productImagePreview: document.querySelector("#productImagePreview"),
  discountPriceWrap: document.querySelector("#discountPriceWrap"),
  resetProductForm: document.querySelector("#resetProductForm"),
  newProductButton: document.querySelector("#newProductButton"),
  quickProductButton: document.querySelector("#quickProductButton"),
  productCreateButton: document.querySelector("#productCreateButton"),
  closeProductDrawer: document.querySelector("#closeProductDrawer"),
  categoryForm: document.querySelector("#categoryForm"),
  categoryMessage: document.querySelector("#categoryMessage"),
  categoryAdminList: document.querySelector("#categoryAdminList"),
  categoryDrawer: document.querySelector("#categoryDrawer"),
  categoryDrawerTitle: document.querySelector("#categoryDrawerTitle"),
  categoryDrawerKicker: document.querySelector("#categoryDrawerKicker"),
  resetCategoryForm: document.querySelector("#resetCategoryForm"),
  newCategoryButton: document.querySelector("#newCategoryButton"),
  categoryCreateButton: document.querySelector("#categoryCreateButton"),
  closeCategoryDrawer: document.querySelector("#closeCategoryDrawer"),
  ordersList: document.querySelector("#ordersList"),
  ordersNewCount: document.querySelector("#ordersNewCount"),
  ordersPendingCount: document.querySelector("#ordersPendingCount"),
  ordersDoneCount: document.querySelector("#ordersDoneCount"),
  ordersVisibleTotal: document.querySelector("#ordersVisibleTotal"),
  refreshOrdersButton: document.querySelector("#refreshOrdersButton"),
  refreshReportsButton: document.querySelector("#refreshReportsButton"),
  reportsSummaryText: document.querySelector("#reportsSummaryText"),
  reportAverageOrder: document.querySelector("#reportAverageOrder"),
  reportPaidProfit: document.querySelector("#reportPaidProfit"),
  reportSales: document.querySelector("#reportSales"),
  reportProfit: document.querySelector("#reportProfit"),
  reportMargin: document.querySelector("#reportMargin"),
  reportInventoryValue: document.querySelector("#reportInventoryValue"),
  reportSalesChart: document.querySelector("#reportSalesChart"),
  reportCategoryChart: document.querySelector("#reportCategoryChart"),
  reportStatusChart: document.querySelector("#reportStatusChart"),
  reportProductsList: document.querySelector("#reportProductsList"),
  reportCategoriesList: document.querySelector("#reportCategoriesList"),
  reportRecentOrders: document.querySelector("#reportRecentOrders"),
  confirmOverlay: document.querySelector("#confirmOverlay"),
  confirmTitle: document.querySelector("#confirmTitle"),
  confirmMessage: document.querySelector("#confirmMessage"),
  confirmCancel: document.querySelector("#confirmCancel"),
  confirmAccept: document.querySelector("#confirmAccept"),
  toast: document.querySelector("#toast")
};

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

document.addEventListener("DOMContentLoaded", initAdmin);

function initAdmin() {
  bindAdminEvents();
  markActiveNav();
  if (initPasswordResetFromUrl()) return;
  restoreSession().catch(() => showLogin());
}

function bindAdminEvents() {
  on(adminEls.loginForm, "submit", login);
  on(adminEls.forgotPasswordButton, "click", () => showResetRequest());
  on(adminEls.resetRequestForm, "submit", requestPasswordReset);
  on(adminEls.resetConfirmForm, "submit", confirmPasswordReset);
  document.querySelectorAll("[data-show-login]").forEach((button) => {
    on(button, "click", showLoginForm);
  });
  on(adminEls.logoutButton, "click", logout);
  on(adminEls.productForm, "submit", saveProduct);
  on(adminEls.categoryForm, "submit", saveCategory);
  on(adminEls.resetProductForm, "click", () => resetProductForm());
  on(adminEls.resetCategoryForm, "click", () => resetCategoryForm());
  on(adminEls.refreshOrdersButton, "click", () => refreshOrders().catch(showErrorToast));
  on(adminEls.refreshReportsButton, "click", () => refreshAll().catch(showErrorToast));

  [adminEls.newProductButton, adminEls.quickProductButton, adminEls.productCreateButton].forEach((button) => {
    on(button, "click", () => openProductDrawer());
  });

  [adminEls.newCategoryButton, adminEls.categoryCreateButton].forEach((button) => {
    on(button, "click", () => openCategoryDrawer());
  });

  on(adminEls.closeProductDrawer, "click", closeProductDrawer);
  on(adminEls.closeCategoryDrawer, "click", closeCategoryDrawer);
  on(adminEls.productDrawer, "click", (event) => {
    if (event.target === adminEls.productDrawer) closeProductDrawer();
  });
  on(adminEls.categoryDrawer, "click", (event) => {
    if (event.target === adminEls.categoryDrawer) closeCategoryDrawer();
  });

  on(adminEls.productSearch, "input", (event) => {
    adminState.productSearch = event.target.value.trim().toLowerCase();
    renderProductsTable();
  });
  on(adminEls.productStatusFilter, "change", (event) => {
    adminState.productStatusFilter = event.target.value;
    renderProductsTable();
  });

  if (adminEls.productForm) {
    on(adminEls.productForm.elements.imageFile, "change", previewSelectedImage);
    on(adminEls.productForm.elements.image_url, "input", () => {
      const value = adminEls.productForm.elements.image_url.value.trim();
      if (value) setProductPreview(value);
    });
    on(adminEls.productForm.elements.has_discount, "change", renderDiscountState);
  }

  on(adminEls.confirmCancel, "click", () => settleConfirm(false));
  on(adminEls.confirmAccept, "click", () => settleConfirm(true));
  on(adminEls.confirmOverlay, "click", (event) => {
    if (event.target === adminEls.confirmOverlay) settleConfirm(false);
  });

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("change", handleDocumentChange);
  document.addEventListener("keydown", handleKeydown);
}

function on(element, eventName, handler) {
  if (element) element.addEventListener(eventName, handler);
}

async function restoreSession() {
  try {
    const session = await publicApi("/api/admin/session");
    adminState.csrfToken = session.csrfToken || "";
    if (adminState.csrfToken) sessionStorage.setItem(ADMIN_CSRF_KEY, adminState.csrfToken);
    showDashboard();
    await refreshAll();
  } catch {
    adminState.csrfToken = "";
    sessionStorage.removeItem(ADMIN_CSRF_KEY);
    showLogin();
  }
}

function markActiveNav() {
  document.querySelectorAll("[data-nav-page]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.navPage === adminState.page);
  });
}

function handleDocumentClick(event) {
  const optionButton = event.target.closest("[data-option-kind][data-option-value]");
  if (optionButton) {
    toggleProductOption(optionButton.dataset.optionKind, optionButton.dataset.optionValue);
    return;
  }

  const addOptionButton = event.target.closest("[data-add-option]");
  if (addOptionButton) {
    addCustomProductOption(addOptionButton.dataset.addOption);
    return;
  }

  const removeOptionButton = event.target.closest("[data-remove-option]");
  if (removeOptionButton) {
    removeProductOption(removeOptionButton.dataset.removeOption, removeOptionButton.dataset.optionValue);
    return;
  }

  const editProduct = event.target.closest("[data-edit-product]");
  if (editProduct) {
    openProductDrawer(Number(editProduct.dataset.editProduct));
    return;
  }

  const deleteProduct = event.target.closest("[data-delete-product]");
  if (deleteProduct) {
    removeProduct(Number(deleteProduct.dataset.deleteProduct));
    return;
  }

  const editCategory = event.target.closest("[data-edit-category]");
  if (editCategory) {
    openCategoryDrawer(Number(editCategory.dataset.editCategory));
    return;
  }

  const deleteCategory = event.target.closest("[data-delete-category]");
  if (deleteCategory) {
    removeCategory(Number(deleteCategory.dataset.deleteCategory));
    return;
  }

  const whatsappOrder = event.target.closest("[data-order-whatsapp]");
  if (whatsappOrder) {
    openOrderWhatsapp(Number(whatsappOrder.dataset.orderWhatsapp));
    return;
  }

  const nextOrderStatus = event.target.closest("[data-order-next-status]");
  if (nextOrderStatus) {
    updateOrderStatus(Number(nextOrderStatus.dataset.orderId), nextOrderStatus.dataset.orderNextStatus);
  }
}

function handleDocumentChange(event) {
  const statusSelect = event.target.closest("[data-order-status]");
  if (statusSelect) {
    updateOrderStatus(Number(statusSelect.dataset.orderStatus), statusSelect.value);
  }
}

function handleKeydown(event) {
  const customOptionInput = event.target.closest("[data-custom-option]");
  if (customOptionInput && event.key === "Enter") {
    event.preventDefault();
    addCustomProductOption(customOptionInput.dataset.customOption);
    return;
  }

  if (event.key !== "Escape") return;
  if (!isHidden(adminEls.confirmOverlay)) settleConfirm(false);
  else if (!isHidden(adminEls.productDrawer)) closeProductDrawer();
  else if (!isHidden(adminEls.categoryDrawer)) closeCategoryDrawer();
}

async function login(event) {
  event.preventDefault();
  setMessage(adminEls.loginMessage, "Entrando...");
  try {
    const form = new FormData(adminEls.loginForm);
    const data = await publicApi("/api/admin/login", {
      method: "POST",
      body: {
        email: form.get("email"),
        password: form.get("password")
      }
    });
    adminState.csrfToken = data.csrfToken || "";
    if (adminState.csrfToken) sessionStorage.setItem(ADMIN_CSRF_KEY, adminState.csrfToken);
    setMessage(adminEls.loginMessage, "");
    showDashboard();
    await refreshAll();
  } catch (error) {
    setMessage(adminEls.loginMessage, error.message, true);
  }
}

function logout() {
  const csrfToken = adminState.csrfToken;
  if (csrfToken) {
    fetch(`${API_BASE}/api/admin/logout`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      credentials: "same-origin"
    }).catch(() => {});
  }
  adminState.csrfToken = "";
  sessionStorage.removeItem(ADMIN_CSRF_KEY);
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  showLogin();
}

function showLogin() {
  document.body.classList.remove("is-auth-checking");
  if (adminEls.loginView) adminEls.loginView.hidden = false;
  if (adminEls.dashboardView) adminEls.dashboardView.hidden = true;
  showLoginForm();
}

function showDashboard() {
  document.body.classList.remove("is-auth-checking");
  if (adminEls.loginView) adminEls.loginView.hidden = true;
  if (adminEls.dashboardView) adminEls.dashboardView.hidden = false;
  if (window.gsap && !prefersReducedMotion()) {
    gsap.fromTo(".dashboard-brief, .daily-action, .summary-grid article, .chart-panel, .decision-card, .ops-panel, .admin-section", { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.32, ease: "power3.out", stagger: 0.025 });
  }
}

function initPasswordResetFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("reset");
  if (!token || !adminEls.resetConfirmForm) return false;
  showLogin();
  showResetConfirm(token);
  return true;
}

function showLoginForm() {
  if (adminEls.loginForm) adminEls.loginForm.hidden = false;
  if (adminEls.resetRequestForm) adminEls.resetRequestForm.hidden = true;
  if (adminEls.resetConfirmForm) adminEls.resetConfirmForm.hidden = true;
}

function showResetRequest() {
  if (adminEls.loginForm) adminEls.loginForm.hidden = true;
  if (adminEls.resetRequestForm) adminEls.resetRequestForm.hidden = false;
  if (adminEls.resetConfirmForm) adminEls.resetConfirmForm.hidden = true;
  setMessage(adminEls.resetRequestMessage, "");
  adminEls.resetRequestForm?.elements.email?.focus();
}

function showResetConfirm(token) {
  if (adminEls.loginForm) adminEls.loginForm.hidden = true;
  if (adminEls.resetRequestForm) adminEls.resetRequestForm.hidden = true;
  if (adminEls.resetConfirmForm) {
    adminEls.resetConfirmForm.hidden = false;
    adminEls.resetConfirmForm.elements.token.value = token;
    adminEls.resetConfirmForm.elements.password.focus();
  }
  setMessage(adminEls.resetConfirmMessage, "");
}

async function requestPasswordReset(event) {
  event.preventDefault();
  const form = adminEls.resetRequestForm;
  const submitButton = form.querySelector('button[type="submit"]');
  setButtonLoading(submitButton, true);
  setMessage(adminEls.resetRequestMessage, "Enviando enlace...");
  try {
    const data = new FormData(form);
    await publicApi("/api/admin/password-reset/request", {
      method: "POST",
      body: { email: data.get("email") }
    });
    setMessage(adminEls.resetRequestMessage, "Si el correo está autorizado, enviaremos un enlace de recuperación.", false, true);
  } catch (error) {
    setMessage(adminEls.resetRequestMessage, error.message, true);
  } finally {
    setButtonLoading(submitButton, false);
  }
}

async function confirmPasswordReset(event) {
  event.preventDefault();
  const form = adminEls.resetConfirmForm;
  const submitButton = form.querySelector('button[type="submit"]');
  const password = String(form.elements.password.value || "");
  const confirmation = String(form.elements.password_confirm.value || "");
  if (password !== confirmation) {
    setMessage(adminEls.resetConfirmMessage, "Las claves no coinciden.", true);
    return;
  }
  setButtonLoading(submitButton, true);
  setMessage(adminEls.resetConfirmMessage, "Actualizando clave...");
  try {
    await publicApi("/api/admin/password-reset/confirm", {
      method: "POST",
      body: {
        token: form.elements.token.value,
        password
      }
    });
    window.history.replaceState({}, document.title, window.location.pathname);
    form.reset();
    showLoginForm();
    setMessage(adminEls.loginMessage, "Clave actualizada. Ya puedes entrar con la nueva clave.", false, true);
  } catch (error) {
    setMessage(adminEls.resetConfirmMessage, error.message, true);
  } finally {
    setButtonLoading(submitButton, false);
  }
}

async function refreshAll() {
  await Promise.all([
    refreshSummary(),
    refreshAnalytics(),
    refreshCategories(),
    refreshProducts(),
    refreshOrders(false)
  ]);
  renderInsights();
  renderReports();
}

async function refreshSummary() {
  const summary = await adminApi("/api/admin/summary");
  setText(adminEls.summaryProducts, summary.productCount);
  setText(adminEls.summaryActive, summary.activeProducts);
  setText(adminEls.summaryOrders, summary.orderCount);
  if (adminState.page !== "dashboard") {
    setText(adminEls.summaryRevenue, formatCurrency(summary.revenue));
  }
}

async function refreshAnalytics() {
  if (!["dashboard", "reports"].includes(adminState.page)) return;
  const analytics = await adminApi("/api/admin/analytics");
  adminState.analytics = analytics;
  if (adminState.page === "dashboard") renderDashboardAnalytics();
  if (adminState.page === "reports") renderReports();
}

async function refreshCategories() {
  const data = await adminApi("/api/admin/categories");
  adminState.categories = data.categories || [];
  renderCategorySelect();
  renderCategories();
  renderInsights();
}

async function refreshProducts() {
  const data = await adminApi("/api/admin/products");
  adminState.products = data.products || [];
  renderProductsTable();
  renderProductShelfNotes();
  renderInsights();
}

async function refreshOrders(updateSummary = true) {
  const data = await adminApi("/api/admin/orders");
  adminState.orders = data.orders || [];
  renderOrders();
  renderInsights();
  if (updateSummary) await refreshSummary();
}

function renderInsights() {
  const activeCategories = adminState.categories.filter((category) => category.active).length;
  const lowStock = adminState.products.filter((product) => Number(product.stock || 0) <= 2);
  const featured = adminState.products.filter((product) => product.featured).length;
  const latestOrder = adminState.orders[0];
  const lowStockText = lowStock.length
    ? `${lowStock.length} producto${lowStock.length === 1 ? "" : "s"} con 2 unidades o menos: ${lowStock.slice(0, 3).map((product) => product.name).join(", ")}.`
    : "Sin productos críticos. El inventario está tranquilo.";

  setText(adminEls.insightLowStock, lowStockText);
  setText(adminEls.summaryLowStock, lowStock.length);
  setText(
    adminEls.stockActionText,
    lowStock.length
      ? `${lowStock.slice(0, 2).map((product) => product.name).join(", ")}`
      : "Inventario bajo control"
  );

  setText(adminEls.insightActiveCategories, `${activeCategories} activa${activeCategories === 1 ? "" : "s"} de ${adminState.categories.length || 0}. ${featured} producto${featured === 1 ? "" : "s"} destacado${featured === 1 ? "" : "s"}.`);

  if (latestOrder) {
    setText(adminEls.insightLatestOrderTitle, latestOrder.order_code);
    setText(adminEls.insightLatestOrder, `${latestOrder.customer_name}, ${formatCurrency(latestOrder.total)}, ${statusLabels[latestOrder.status] || latestOrder.status}.`);
  } else {
    setText(adminEls.insightLatestOrderTitle, "Sin pedidos aún");
    setText(adminEls.insightLatestOrder, "Cuando entre una orden aparecerá aquí.");
  }

  setText(adminEls.sidebarStatus, lowStock.length ? `${lowStock.length} stock bajo` : "Lista");
}

function renderDashboardAnalytics() {
  const analytics = adminState.analytics || {};
  const totals = analytics.totals || {};
  const sales = Number(totals.sales || 0);
  const profit = Number(totals.estimatedProfit || 0);
  const paidProfit = Number(totals.paidProfit || 0);
  const pendingProfit = Number(totals.pendingProfit || 0);

  setText(adminEls.summaryRevenue, formatCurrency(sales));
  setText(adminEls.summaryProfit, formatCurrency(profit));
  setText(adminEls.summaryMargin, formatPercent(totals.margin));
  setText(adminEls.summaryInventoryProfit, formatCurrency(totals.inventoryPotentialProfit));
  setText(adminEls.dashboardPendingText, `Pendiente por cobrar: ${formatCurrency(pendingProfit)}`);
  setText(
    adminEls.profitSummaryText,
    sales > 0
      ? `${formatCurrency(sales)} en ventas, ${formatCurrency(profit)} de ganancia estimada y ${formatCurrency(pendingProfit)} pendiente por cobrar.`
      : "Aún no hay ventas registradas. Cuando entren pedidos, aquí verás utilidad, margen y tendencia."
  );

  renderDashboardCharts(analytics);
}

function renderDashboardCharts(analytics) {
  const days = analytics.salesProfitByDay || [];
  const products = analytics.topProducts || [];
  const categories = analytics.categoryProfit || [];
  const statuses = analytics.orderStatus || [];
  const gridColor = "rgba(139, 100, 27, 0.14)";
  const textColor = "#746a5c";
  const ink = "#17130a";
  const gold = "#c7962f";
  const green = "#789276";
  const red = "#a33a2d";

  renderChart("salesProfit", adminEls.salesProfitChart, {
    type: "bar",
    data: {
      labels: days.map((item) => item.label),
      datasets: [
        {
          label: "Ventas",
          data: days.map((item) => item.sales),
          backgroundColor: "rgba(199, 150, 47, 0.34)",
          borderColor: "rgba(199, 150, 47, 0.7)",
          borderWidth: 1,
          borderRadius: 10,
          maxBarThickness: 34
        },
        {
          type: "line",
          label: "Ganancia",
          data: days.map((item) => item.profit),
          borderColor: ink,
          backgroundColor: "rgba(23, 19, 10, 0.08)",
          pointBackgroundColor: gold,
          pointBorderColor: ink,
          pointRadius: 4,
          tension: 0.32
        }
      ]
    },
    options: cartesianChartOptions(gridColor, textColor)
  });

  renderChart("productProfit", adminEls.productProfitChart, {
    type: "bar",
    data: {
      labels: (products.length ? products : [{ name: "Sin ventas" }]).map((item) => item.name),
      datasets: [{
        label: "Ganancia",
        data: (products.length ? products : [{ profit: 0 }]).map((item) => item.profit),
        backgroundColor: "rgba(120, 146, 118, 0.42)",
        borderColor: green,
        borderWidth: 1,
        borderRadius: 10
      }]
    },
    options: horizontalCurrencyChartOptions(gridColor, textColor)
  });

  renderChart("categoryProfit", adminEls.categoryProfitChart, {
    type: "bar",
    data: {
      labels: (categories.length ? categories : [{ category: "Sin inventario" }]).map((item) => item.category),
      datasets: [{
        label: "Ganancia potencial",
        data: (categories.length ? categories : [{ potentialProfit: 0 }]).map((item) => item.potentialProfit),
        backgroundColor: ["rgba(199, 150, 47, 0.42)", "rgba(120, 146, 118, 0.36)", "rgba(23, 19, 10, 0.16)", "rgba(163, 58, 45, 0.18)"],
        borderColor: [gold, green, ink, red],
        borderWidth: 1,
        borderRadius: 10
      }]
    },
    options: cartesianChartOptions(gridColor, textColor)
  });

  renderChart("orderStatus", adminEls.orderStatusChart, {
    type: "doughnut",
    data: {
      labels: (statuses.length ? statuses : [{ label: "Sin pedidos" }]).map((item) => item.label),
      datasets: [{
        data: (statuses.length ? statuses : [{ count: 1 }]).map((item) => item.count),
        backgroundColor: [
          "rgba(199, 150, 47, 0.72)",
          "rgba(120, 146, 118, 0.7)",
          "rgba(23, 19, 10, 0.72)",
          "rgba(163, 58, 45, 0.58)",
          "rgba(230, 191, 101, 0.62)"
        ],
        borderColor: "#fffdf8",
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "66%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: textColor,
            boxWidth: 10,
            usePointStyle: true,
            font: { family: "Jost", weight: "700" }
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${context.parsed}`
          }
        }
      }
    }
  });
}

function renderReports() {
  if (adminState.page !== "reports") return;
  const analytics = adminState.analytics || {};
  const totals = analytics.totals || {};
  const sales = Number(totals.sales || 0);
  const profit = Number(totals.estimatedProfit || 0);
  const margin = Number(totals.margin || 0);
  const orderCount = Number(totals.orderCount || 0);
  const paidProfit = Number(totals.paidProfit || 0);

  setText(adminEls.reportSales, formatCurrency(sales));
  setText(adminEls.reportProfit, formatCurrency(profit));
  setText(adminEls.reportMargin, formatPercent(margin));
  setText(adminEls.reportInventoryValue, formatCurrency(totals.inventoryValue));
  setText(adminEls.reportAverageOrder, formatCurrency(totals.averageOrder));
  setText(adminEls.reportPaidProfit, formatCurrency(paidProfit));
  setText(
    adminEls.reportsSummaryText,
    orderCount
      ? `${orderCount} pedido${orderCount === 1 ? "" : "s"} activo${orderCount === 1 ? "" : "s"}, ${formatCurrency(profit)} de ganancia estimada y ${formatPercent(margin)} de margen.`
      : "Aún no hay pedidos activos. Cuando entren ventas, este panel mostrará utilidad, margen y movimiento."
  );

  renderReportCharts(analytics);
  renderReportProducts(analytics.topProducts || []);
  renderReportCategories(analytics.categoryProfit || []);
  renderReportRecentOrders();
}

function renderReportCharts(analytics) {
  const days = analytics.salesProfitByDay || [];
  const categories = analytics.categoryProfit || [];
  const statuses = analytics.orderStatus || [];
  const gridColor = "rgba(139, 100, 27, 0.14)";
  const textColor = "#746a5c";
  const gold = "#c7962f";
  const ink = "#17130a";
  const green = "#789276";
  const red = "#a33a2d";

  renderChart("reportSales", adminEls.reportSalesChart, {
    type: "bar",
    data: {
      labels: days.map((item) => item.label),
      datasets: [
        {
          label: "Ventas",
          data: days.map((item) => item.sales),
          backgroundColor: "rgba(199, 150, 47, 0.32)",
          borderColor: gold,
          borderWidth: 1,
          borderRadius: 10,
          maxBarThickness: 38
        },
        {
          type: "line",
          label: "Ganancia",
          data: days.map((item) => item.profit),
          borderColor: ink,
          pointBackgroundColor: gold,
          pointBorderColor: ink,
          pointRadius: 4,
          tension: 0.32
        }
      ]
    },
    options: cartesianChartOptions(gridColor, textColor)
  });

  renderChart("reportCategory", adminEls.reportCategoryChart, {
    type: "bar",
    data: {
      labels: (categories.length ? categories : [{ category: "Sin inventario" }]).map((item) => item.category),
      datasets: [{
        label: "Ganancia potencial",
        data: (categories.length ? categories : [{ potentialProfit: 0 }]).map((item) => item.potentialProfit),
        backgroundColor: ["rgba(199, 150, 47, 0.42)", "rgba(120, 146, 118, 0.36)", "rgba(23, 19, 10, 0.16)", "rgba(163, 58, 45, 0.18)"],
        borderColor: [gold, green, ink, red],
        borderWidth: 1,
        borderRadius: 10
      }]
    },
    options: cartesianChartOptions(gridColor, textColor)
  });

  renderChart("reportStatus", adminEls.reportStatusChart, {
    type: "doughnut",
    data: {
      labels: (statuses.length ? statuses : [{ label: "Sin pedidos" }]).map((item) => item.label),
      datasets: [{
        data: (statuses.length ? statuses : [{ count: 1 }]).map((item) => item.count),
        backgroundColor: [
          "rgba(199, 150, 47, 0.72)",
          "rgba(120, 146, 118, 0.7)",
          "rgba(23, 19, 10, 0.72)",
          "rgba(163, 58, 45, 0.58)",
          "rgba(230, 191, 101, 0.62)"
        ],
        borderColor: "#fffdf8",
        borderWidth: 3
      }]
    },
    options: doughnutReportOptions(textColor)
  });
}

function renderReportProducts(products) {
  if (!adminEls.reportProductsList) return;
  adminEls.reportProductsList.innerHTML = products.slice(0, 6).map((product, index) => `
    <div class="report-row">
      <span class="report-rank">${index + 1}</span>
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <small>${escapeHtml(product.sku || "Sin SKU")} · ${product.quantity} vendido${product.quantity === 1 ? "" : "s"}</small>
      </div>
      <div class="report-row-number">
        <strong>${formatCurrency(product.profit)}</strong>
        <small>${formatCurrency(product.sales)} venta</small>
      </div>
    </div>
  `).join("") || emptyAdminState("Sin productos vendidos.", "Cuando existan pedidos, verás aquí las piezas que más utilidad dejan.");
}

function renderReportCategories(categories) {
  if (!adminEls.reportCategoriesList) return;
  adminEls.reportCategoriesList.innerHTML = categories.map((category) => `
    <div class="report-row">
      <span class="report-rank">${Number(category.stock || 0)}</span>
      <div>
        <strong>${escapeHtml(category.category)}</strong>
        <small>${formatCurrency(category.inventoryCost)} costo privado · ${formatCurrency(category.inventoryValue)} venta potencial</small>
      </div>
      <div class="report-row-number">
        <strong>${formatCurrency(category.potentialProfit)}</strong>
        <small>ganancia posible</small>
      </div>
    </div>
  `).join("") || emptyAdminState("Sin categorías con inventario.", "Agrega productos con precio y costo para medir utilidad.");
}

function renderReportRecentOrders() {
  if (!adminEls.reportRecentOrders) return;
  adminEls.reportRecentOrders.innerHTML = adminState.orders.slice(0, 5).map((order) => `
    <div class="report-row">
      <span class="status-pill ${orderStatusClass(order.status)}">${escapeHtml(statusLabels[order.status] || order.status)}</span>
      <div>
        <strong>${escapeHtml(order.order_code)}</strong>
        <small>${escapeHtml(order.customer_name)} · ${formatDate(order.created_at)}</small>
      </div>
      <div class="report-row-number">
        <strong>${formatCurrency(order.total)}</strong>
        <small>${escapeHtml(paymentLabel(order.payment_method, order.payment_status))}</small>
      </div>
    </div>
  `).join("") || emptyAdminState("Sin pedidos recientes.", "Cuando entre una compra, aparecerá en este reporte.");
}

function renderChart(key, canvas, config) {
  if (!canvas || !window.Chart) return;
  if (adminState.charts[key]) {
    adminState.charts[key].destroy();
  }
  adminState.charts[key] = new Chart(canvas, config);
}

function cartesianChartOptions(gridColor, textColor) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: textColor,
          boxWidth: 12,
          usePointStyle: true,
          font: { family: "Jost", weight: "700" }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.chart?.options?.indexAxis === "y" ? context.parsed.x : context.parsed.y;
            return `${context.dataset.label}: ${formatCurrency(value)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { family: "Jost", weight: "700" } }
      },
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          callback: (value) => shortCurrency(value),
          font: { family: "Jost", weight: "700" }
        }
      }
    }
  };
}

function horizontalCurrencyChartOptions(gridColor, textColor) {
  return {
    ...cartesianChartOptions(gridColor, textColor),
    indexAxis: "y",
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          callback: (value) => shortCurrency(value),
          font: { family: "Jost", weight: "700" }
        }
      },
      y: {
        grid: { display: false },
        ticks: {
          color: textColor,
          font: { family: "Jost", weight: "700" }
        }
      }
    }
  };
}

function doughnutReportOptions(textColor) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "66%",
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: textColor,
          boxWidth: 10,
          usePointStyle: true,
          font: { family: "Jost", weight: "700" }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.parsed}`
        }
      }
    }
  };
}

function renderCategorySelect() {
  if (!adminEls.productCategorySelect) return;
  adminEls.productCategorySelect.innerHTML = [
    `<option value="">Sin categoría</option>`,
    ...adminState.categories.map((category) => (
      `<option value="${category.id}">${escapeHtml(category.name)}${category.active ? "" : " (inactiva)"}</option>`
    ))
  ].join("");
}

function renderCategories() {
  if (!adminEls.categoryAdminList) return;
  adminEls.categoryAdminList.innerHTML = adminState.categories.map((category) => `
    <article class="category-admin-item">
      <div>
        <h3>${escapeHtml(category.name)}</h3>
        <p>${escapeHtml(category.description || "Sin descripción")}</p>
      </div>
      <div class="row-actions">
        <span class="status-pill ${category.active ? "" : "off"}">${category.active ? "Activa" : "Inactiva"}</span>
        <button class="small-button" data-edit-category="${category.id}" type="button">Editar</button>
        <button class="small-button danger" data-delete-category="${category.id}" type="button">Eliminar</button>
      </div>
    </article>
  `).join("") || emptyAdminState("No hay categorías todavía.", "Crea categorías para ordenar el catálogo.");
}

function renderProductShelfNotes() {
  if (!adminEls.productShelfNotes) return;
  const lowStock = adminState.products.filter((product) => Number(product.stock || 0) <= 2).length;
  const hidden = adminState.products.filter((product) => !product.active).length;
  const promos = adminState.products.filter((product) => (product.promo_type || "none") !== "none" || product.promo_label).length;
  adminEls.productShelfNotes.innerHTML = [
    `<span class="shelf-note">${adminState.products.length} productos cargados</span>`,
    `<span class="shelf-note">${lowStock} con stock bajo</span>`,
    `<span class="shelf-note">${promos} con promo</span>`,
    hidden ? `<span class="shelf-note">${hidden} ocultos</span>` : ""
  ].filter(Boolean).join("");
}

function renderProductsTable() {
  if (!adminEls.productsTable) return;
  const products = filteredProducts();
  adminEls.productsTable.innerHTML = products.map((product) => `
    <tr>
      <td data-label="Producto">
        <div class="table-product">
          <img src="${escapeAttr(assetUrl(product.image_url))}" alt="${escapeAttr(product.name)}">
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <span>${escapeHtml(product.sku || "Sin SKU")}</span>
          </div>
        </div>
      </td>
      <td data-label="Categoría">${escapeHtml(product.category?.name || "Sin categoría")}</td>
      <td data-label="Precio">${productPriceAdmin(product)}</td>
      <td data-label="Compra">${productCostAdmin(product)}</td>
      <td data-label="Ganancia">${productProfitAdmin(product)}</td>
      <td data-label="Stock">${Number(product.stock || 0)}</td>
      <td data-label="Estado">
        <div class="status-stack">
          <span class="status-pill ${product.active ? "" : "off"}">${product.active ? "Activo" : "Oculto"}</span>
          ${productPromoAdmin(product)}
        </div>
      </td>
      <td data-label="Acciones">
        <div class="row-actions">
          <button class="small-button" data-edit-product="${product.id}" type="button">Editar</button>
          <button class="small-button danger" data-delete-product="${product.id}" type="button">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="8">${emptyAdminState("No hay productos para este filtro.", "Ajusta la búsqueda o agrega una pieza nueva.")}</td></tr>`;
}

function filteredProducts() {
  const query = adminState.productSearch;
  const filter = adminState.productStatusFilter;
  return adminState.products.filter((product) => {
    const text = [
      product.name,
      product.sku,
      product.category?.name,
      product.promo_label
    ].join(" ").toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && product.active) ||
      (filter === "hidden" && !product.active) ||
      (filter === "low" && Number(product.stock || 0) <= 2);
    return matchesQuery && matchesFilter;
  });
}

function productPriceAdmin(product) {
  const hasDiscount = Number(product.compare_price || 0) > Number(product.price || 0);
  return `
    <span class="admin-price-stack">
      <small>Venta</small>
      <strong>${formatCurrency(product.price)}</strong>
      ${hasDiscount ? `<small>Antes ${formatCurrency(product.compare_price)}</small>` : ""}
    </span>
  `;
}

function productCostAdmin(product) {
  const cost = Number(product.cost_price || 0);
  return `
    <span class="admin-price-stack private-price">
      <small>Privado</small>
      <strong>${cost > 0 ? formatCurrency(cost) : "-"}</strong>
    </span>
  `;
}

function productProfitAdmin(product) {
  const price = Number(product.price || 0);
  const cost = Number(product.cost_price || 0);
  const profit = price - cost;
  const margin = price > 0 && cost > 0 ? Math.round((profit / price) * 100) : 0;
  return `
    <span class="admin-price-stack ${profit < 0 ? "negative-profit" : "profit-price"}">
      <small>${cost > 0 ? `${margin}% margen` : "Sin costo"}</small>
      <strong>${cost > 0 ? formatCurrency(profit) : "-"}</strong>
    </span>
  `;
}

function productPromoAdmin(product) {
  const type = product.promo_type || "none";
  const label = product.promo_label || (Number(product.stock || 0) <= 2 ? "Últimas unidades" : "");
  if (type === "none" && !label) return "";
  return `<span class="status-pill promo-status">${escapeHtml(label || promoTypeLabel(type))}</span>`;
}

function promoTypeLabel(type) {
  if (type === "discount") return "Descuento";
  if (type === "last_units") return "Últimas unidades";
  if (type === "new_arrival") return "Recién llegado";
  return "";
}

function renderOrders() {
  if (!adminEls.ordersList) return;
  renderOrdersOverview();
  adminEls.ordersList.innerHTML = adminState.orders.map((order) => `
    ${renderOrderCard(order)}
  `).join("") || emptyAdminState("Todavía no hay pedidos.", "Cuando una clienta complete checkout, la orden aparecerá aquí.");
}

function renderOrdersOverview() {
  const orders = adminState.orders || [];
  const newCount = orders.filter((order) => order.status === "new").length;
  const pendingCount = orders.filter((order) => ["new", "waiting_payment", "paid", "preparing", "ready", "sent"].includes(order.status)).length;
  const doneCount = orders.filter((order) => ["completed", "cancelled"].includes(order.status)).length;
  const visibleTotal = orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  setText(adminEls.ordersNewCount, newCount);
  setText(adminEls.ordersPendingCount, pendingCount);
  setText(adminEls.ordersDoneCount, doneCount);
  setText(adminEls.ordersVisibleTotal, formatCurrency(visibleTotal));
}

function renderOrderCard(order) {
  const nextAction = orderNextAction(order);
  return `
    <article class="order-card order-status-${escapeAttr(order.status || "new")}">
      <div class="order-head">
        <div class="order-title-block">
          <span class="order-kicker">${escapeHtml(formatDate(order.created_at))}</span>
          <h3>${escapeHtml(order.order_code)}</h3>
          <p>${escapeHtml(order.customer_name)} · ${escapeHtml(order.customer_phone)}</p>
        </div>
        <div class="order-total">
          <span class="status-pill ${orderStatusClass(order.status)}">${escapeHtml(statusLabels[order.status] || order.status)}</span>
          <strong>${formatCurrency(order.total)}</strong>
          <small>${escapeHtml(paymentLabel(order.payment_method, order.payment_status))}</small>
        </div>
      </div>

      <div class="order-next-step">
        <span>Siguiente paso</span>
        <strong>${escapeHtml(nextAction.text)}</strong>
      </div>

      <div class="order-info-grid">
        <div class="order-info-card">
          <span>Cliente</span>
          <strong>${escapeHtml(order.customer_name)}</strong>
          <small>${escapeHtml(order.customer_email || "Sin correo registrado")}</small>
        </div>
        <div class="order-info-card">
          <span>Entrega</span>
          <strong>${escapeHtml(orderDeliveryLabel(order))}</strong>
          <small>${escapeHtml([order.customer_city, order.customer_address].filter(Boolean).join(" · ") || "Sin dirección adicional")}</small>
        </div>
        <div class="order-info-card">
          <span>Pago</span>
          <strong>${escapeHtml(paymentLabel(order.payment_method, order.payment_status))}</strong>
          <small>${escapeHtml(order.payment_status === "paid" ? "Pago confirmado" : "Pendiente de confirmación")}</small>
        </div>
      </div>

      <div class="order-items-panel">
        <div class="order-items-heading">
          <span>Productos</span>
          <strong>${order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} unidad${order.items.length === 1 ? "" : "es"}</strong>
        </div>
        <div class="order-items-list">
          ${order.items.map((item) => renderOrderItem(item)).join("")}
        </div>
      </div>

      ${order.notes ? `
        <div class="order-note">
          <span>Nota</span>
          <p>${escapeHtml(order.notes)}</p>
        </div>
      ` : ""}

      <div class="order-actions">
        <label class="order-status-control">
          Estado del pedido
          <select data-order-status="${order.id}">
            ${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${order.status === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <div class="order-action-buttons">
          ${nextAction.status ? `<button class="button ghost" data-order-id="${order.id}" data-order-next-status="${escapeAttr(nextAction.status)}" type="button">${escapeHtml(nextAction.label)}</button>` : ""}
          <button class="button primary" data-order-whatsapp="${order.id}" type="button">Coordinar por WhatsApp</button>
        </div>
      </div>
    </article>
  `;
}

function renderOrderItem(item) {
  const variants = [item.size && `Talla ${item.size}`, item.color && `Color ${item.color}`].filter(Boolean).join(" · ");
  return `
    <div class="order-item-row">
      <span class="order-item-qty">${Number(item.quantity || 0)}</span>
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(variants || item.sku || "Sin variante")}</small>
      </div>
      <strong>${formatCurrency(item.line_total || Number(item.price || 0) * Number(item.quantity || 0))}</strong>
    </div>
  `;
}

function orderDeliveryLabel(order) {
  return order.delivery_method === "pickup" ? "Retiro coordinado" : "Envío a domicilio";
}

function orderStatusClass(status) {
  if (status === "cancelled") return "off";
  if (["completed", "sent", "ready"].includes(status)) return "success";
  if (["waiting_payment", "paid", "preparing"].includes(status)) return "warning";
  return "";
}

function orderNextAction(order) {
  const delivery = order.delivery_method === "pickup" ? "retiro" : "envío";
  const map = {
    new: { status: "preparing", label: "Confirmar y preparar", text: `Confirmar con la clienta y preparar el ${delivery}.` },
    waiting_payment: { status: "paid", label: "Marcar pagado", text: "Revisar el pago antes de preparar." },
    paid: { status: "preparing", label: "Preparar pedido", text: `Preparar productos para ${delivery}.` },
    preparing: { status: "ready", label: "Marcar listo", text: "Dejar el pedido listo para entrega." },
    ready: { status: order.delivery_method === "pickup" ? "completed" : "sent", label: order.delivery_method === "pickup" ? "Completar retiro" : "Marcar enviado", text: order.delivery_method === "pickup" ? "Coordinar retiro y cerrar el pedido." : "Enviar o coordinar entrega." },
    sent: { status: "completed", label: "Marcar completado", text: "Confirmar entrega y cerrar el pedido." },
    completed: { status: "", label: "", text: "Pedido cerrado correctamente." },
    cancelled: { status: "", label: "", text: "Pedido cancelado. No requiere acción." }
  };
  return map[order.status] || map.new;
}

function openProductDrawer(id) {
  if (!adminEls.productDrawer || !adminEls.productForm) {
    window.location.href = "admin-productos.html";
    return;
  }
  const product = id ? adminState.products.find((item) => item.id === id) : null;
  resetProductForm({ silent: true });

  if (product) {
    const form = adminEls.productForm;
    form.elements.id.value = product.id;
    form.elements.name.value = product.name;
    form.elements.category_id.value = product.category?.id || "";
    form.elements.price.value = product.price;
    form.elements.cost_price.value = product.cost_price || "";
    form.elements.compare_price.value = product.compare_price || "";
    form.elements.has_discount.checked = Number(product.compare_price || 0) > Number(product.price || 0) || product.promo_type === "discount";
    form.elements.stock.value = product.stock;
    form.elements.sku.value = product.sku || "";
    form.elements.image_url.value = product.image_url || "";
    setProductOptions("sizes", product.sizes);
    setProductOptions("colors", product.colors);
    form.elements.promo_type.value = product.promo_type || "none";
    form.elements.promo_label.value = product.promo_label || "";
    form.elements.description.value = product.description || "";
    form.elements.active.checked = Boolean(product.active);
    form.elements.featured.checked = Boolean(product.featured);
    renderDiscountState();
    setProductPreview(product.image_url || "/assets/product-placeholder.svg");
    setText(adminEls.productDrawerKicker, "Editar producto");
    setText(adminEls.productDrawerTitle, product.name);
  } else {
    setText(adminEls.productDrawerKicker, "Nuevo producto");
    setText(adminEls.productDrawerTitle, "Agregar mercadería");
  }

  openDrawer(adminEls.productDrawer, adminEls.productForm.elements.name);
}

function closeProductDrawer() {
  closeDrawer(adminEls.productDrawer);
}

function resetProductForm(options = {}) {
  if (!adminEls.productForm) return;
  adminEls.productForm.reset();
  adminEls.productForm.elements.id.value = "";
  adminEls.productForm.elements.active.checked = true;
  adminEls.productForm.elements.featured.checked = false;
  adminEls.productForm.elements.promo_type.value = "none";
  adminEls.productForm.elements.cost_price.value = "";
  adminEls.productForm.elements.has_discount.checked = false;
  adminEls.productForm.elements.compare_price.value = "";
  adminEls.productForm.elements.promo_label.value = "";
  renderDiscountState();
  setProductOptions("sizes", []);
  setProductOptions("colors", []);
  setProductPreview("/assets/product-placeholder.svg");
  if (!options.silent) setMessage(adminEls.productMessage, "");
}

function renderDiscountState() {
  if (!adminEls.productForm) return;
  const isDiscount = Boolean(adminEls.productForm.elements.has_discount?.checked);
  if (adminEls.discountPriceWrap) adminEls.discountPriceWrap.hidden = !isDiscount;
  if (adminEls.productForm.elements.compare_price) {
    adminEls.productForm.elements.compare_price.required = isDiscount;
    if (!isDiscount) adminEls.productForm.elements.compare_price.value = "";
  }
  if (adminEls.productForm.elements.promo_type) {
    adminEls.productForm.elements.promo_type.disabled = isDiscount;
    if (isDiscount) adminEls.productForm.elements.promo_type.value = "none";
  }
}

async function saveProduct(event) {
  event.preventDefault();
  const form = adminEls.productForm;
  const submitButton = form.querySelector('button[type="submit"]');
  setMessage(adminEls.productMessage, "Guardando producto...");
  setButtonLoading(submitButton, true);
  let savedProductId = "";
  let savedProductWasEdit = false;

  try {
    const formData = new FormData(form);
    const hasDiscount = form.elements.has_discount.checked;
    const salePrice = Number(formData.get("price") || 0);
    const comparePrice = Number(formData.get("compare_price") || 0);
    if (hasDiscount && comparePrice <= salePrice) {
      throw new Error("El precio antes del descuento debe ser mayor al precio de venta.");
    }
    let imageUrl = String(formData.get("image_url") || "").trim();
    const imageFile = form.elements.imageFile.files[0];

    if (imageFile) {
      const uploadForm = new FormData();
      uploadForm.append("image", imageFile);
      const uploaded = await adminApi("/api/admin/upload", {
        method: "POST",
        body: uploadForm
      });
      imageUrl = uploaded.url;
    }

    const payload = {
      name: formData.get("name"),
      category_id: formData.get("category_id"),
      price: formData.get("price"),
      cost_price: formData.get("cost_price"),
      compare_price: hasDiscount ? formData.get("compare_price") : "",
      stock: formData.get("stock"),
      sku: formData.get("sku"),
      image_url: imageUrl || "/assets/product-placeholder.svg",
      sizes: formData.get("sizes"),
      colors: formData.get("colors"),
      promo_type: hasDiscount ? "discount" : formData.get("promo_type"),
      promo_label: formData.get("promo_label"),
      description: formData.get("description"),
      active: form.elements.active.checked,
      featured: form.elements.featured.checked
    };

    const id = formData.get("id");
    savedProductId = id;
    savedProductWasEdit = Boolean(id);
    await adminApi(id ? `/api/admin/products/${id}` : "/api/admin/products", {
      method: id ? "PUT" : "POST",
      body: payload
    });

    closeProductDrawer();
    resetProductForm({ silent: true });
    setMessage(adminEls.productMessage, "");
    showToast(id ? "Producto actualizado." : "Producto creado.");
  } catch (error) {
    setMessage(adminEls.productMessage, error.message, true);
    return;
  } finally {
    setButtonLoading(submitButton, false);
  }

  try {
    await Promise.all([refreshProducts(), refreshSummary()]);
  } catch (refreshError) {
    console.warn(refreshError);
    showToast(`${savedProductWasEdit || savedProductId ? "Producto guardado" : "Producto creado"}. Recarga el panel para ver los datos actualizados.`);
  }
}

async function removeProduct(id) {
  const product = adminState.products.find((item) => item.id === id);
  const ok = await askConfirm({
    title: "Eliminar producto",
    message: `Se eliminará ${product?.name || "este producto"} del catálogo. Esta acción no se puede deshacer.`,
    actionLabel: "Eliminar"
  });
  if (!ok) return;

  try {
    await adminApi(`/api/admin/products/${id}`, { method: "DELETE" });
    await Promise.all([refreshProducts(), refreshSummary()]);
    showToast("Producto eliminado.");
  } catch (error) {
    showErrorToast(error);
  }
}

function openCategoryDrawer(id) {
  if (!adminEls.categoryDrawer || !adminEls.categoryForm) {
    window.location.href = "admin-categorias.html";
    return;
  }
  const category = id ? adminState.categories.find((item) => item.id === id) : null;
  resetCategoryForm({ silent: true });

  if (category) {
    const form = adminEls.categoryForm;
    form.elements.id.value = category.id;
    form.elements.name.value = category.name;
    form.elements.description.value = category.description || "";
    form.elements.active.checked = Boolean(category.active);
    setText(adminEls.categoryDrawerKicker, "Editar categoría");
    setText(adminEls.categoryDrawerTitle, category.name);
  } else {
    setText(adminEls.categoryDrawerKicker, "Nueva categoría");
    setText(adminEls.categoryDrawerTitle, "Ordenar catálogo");
  }

  openDrawer(adminEls.categoryDrawer, adminEls.categoryForm.elements.name);
}

function closeCategoryDrawer() {
  closeDrawer(adminEls.categoryDrawer);
}

function resetCategoryForm(options = {}) {
  if (!adminEls.categoryForm) return;
  adminEls.categoryForm.reset();
  adminEls.categoryForm.elements.id.value = "";
  adminEls.categoryForm.elements.active.checked = true;
  if (!options.silent) setMessage(adminEls.categoryMessage, "");
}

async function saveCategory(event) {
  event.preventDefault();
  const form = adminEls.categoryForm;
  const data = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  setMessage(adminEls.categoryMessage, "Guardando categoría...");
  setButtonLoading(submitButton, true);

  try {
    const payload = {
      name: data.get("name"),
      description: data.get("description"),
      active: form.elements.active.checked
    };
    const id = data.get("id");
    await adminApi(id ? `/api/admin/categories/${id}` : "/api/admin/categories", {
      method: id ? "PUT" : "POST",
      body: payload
    });
    closeCategoryDrawer();
    resetCategoryForm({ silent: true });
    await Promise.all([refreshCategories(), refreshProducts()]);
    showToast(id ? "Categoría actualizada." : "Categoría creada.");
  } catch (error) {
    setMessage(adminEls.categoryMessage, error.message, true);
  } finally {
    setButtonLoading(submitButton, false);
  }
}

async function removeCategory(id) {
  const category = adminState.categories.find((item) => item.id === id);
  const ok = await askConfirm({
    title: "Eliminar categoría",
    message: `Se eliminará ${category?.name || "esta categoría"}. Los productos relacionados quedarán sin categoría.`,
    actionLabel: "Eliminar"
  });
  if (!ok) return;

  try {
    await adminApi(`/api/admin/categories/${id}`, { method: "DELETE" });
    await Promise.all([refreshCategories(), refreshProducts()]);
    showToast("Categoría eliminada.");
  } catch (error) {
    showErrorToast(error);
  }
}

async function updateOrderStatus(id, status) {
  try {
    await adminApi(`/api/admin/orders/${id}/status`, {
      method: "PATCH",
      body: { status }
    });
    await refreshOrders();
    showToast("Estado actualizado.");
  } catch (error) {
    showErrorToast(error);
  }
}

async function openOrderWhatsapp(id) {
  try {
    const data = await adminApi(`/api/admin/orders/${id}/whatsapp`);
    window.open(data.whatsappUrl, "_blank", "noopener");
  } catch (error) {
    showErrorToast(error);
  }
}

function openDrawer(drawer, focusTarget) {
  if (!drawer) return;
  drawer.hidden = false;
  document.body.classList.add("drawer-open");
  const panel = drawer.querySelector(".drawer-panel");
  const isMobile = window.innerWidth <= 760;
  if (panel && isMobile) {
    panel.style.transform = "translate3d(0, 0, 0)";
    panel.style.opacity = "1";
  } else if (panel && window.gsap && !prefersReducedMotion()) {
    gsap.fromTo(panel, { x: 36, opacity: 0.9 }, { x: 0, opacity: 1, duration: 0.22, ease: "power3.out" });
  }
  setTimeout(() => focusTarget?.focus(), 40);
}

function closeDrawer(drawer) {
  if (!drawer) return;
  drawer.hidden = true;
  if (isHidden(adminEls.productDrawer) && isHidden(adminEls.categoryDrawer) && isHidden(adminEls.confirmOverlay)) {
    document.body.classList.remove("drawer-open");
  }
}

function previewSelectedImage() {
  const file = adminEls.productForm?.elements.imageFile.files[0];
  if (!file) return;
  const objectUrl = URL.createObjectURL(file);
  setProductPreview(objectUrl, true);
}

function setProductPreview(src, revokeLater = false) {
  if (!adminEls.productImagePreview) return;
  adminEls.productImagePreview.src = assetUrl(src || "/assets/product-placeholder.svg");
  if (revokeLater) {
    adminEls.productImagePreview.onload = () => URL.revokeObjectURL(src);
  }
}

function toggleProductOption(kind, value) {
  if (!isProductOptionKind(kind)) return;
  const cleanValue = normalizeOptionValue(value);
  if (!cleanValue) return;
  const options = adminState.productOptions[kind];
  const exists = options.some((item) => sameOption(item, cleanValue));
  adminState.productOptions[kind] = exists
    ? options.filter((item) => !sameOption(item, cleanValue))
    : [...options, cleanValue];
  syncProductOptionPicker(kind);
}

function addCustomProductOption(kind) {
  if (!isProductOptionKind(kind)) return;
  const input = document.querySelector(`[data-custom-option="${kind}"]`);
  const cleanValue = normalizeOptionValue(input?.value);
  if (!cleanValue) return;
  if (!adminState.productOptions[kind].some((item) => sameOption(item, cleanValue))) {
    adminState.productOptions[kind] = [...adminState.productOptions[kind], cleanValue];
  }
  if (input) input.value = "";
  syncProductOptionPicker(kind);
}

function removeProductOption(kind, value) {
  if (!isProductOptionKind(kind)) return;
  const cleanValue = normalizeOptionValue(value);
  adminState.productOptions[kind] = adminState.productOptions[kind].filter((item) => !sameOption(item, cleanValue));
  syncProductOptionPicker(kind);
}

function setProductOptions(kind, values) {
  if (!isProductOptionKind(kind)) return;
  const normalized = normalizeOptionList(values);
  adminState.productOptions[kind] = normalized;
  syncProductOptionPicker(kind);
}

function syncProductOptionPicker(kind) {
  if (!isProductOptionKind(kind) || !adminEls.productForm) return;
  const options = adminState.productOptions[kind];
  const hiddenInput = adminEls.productForm.elements[kind];
  if (hiddenInput) hiddenInput.value = options.join(", ");

  document.querySelectorAll(`[data-option-kind="${kind}"][data-option-value]`).forEach((button) => {
    button.classList.toggle("is-selected", options.some((item) => sameOption(item, button.dataset.optionValue)));
  });

  const selectedWrap = document.querySelector(`[data-selected-options="${kind}"]`);
  if (!selectedWrap) return;
  selectedWrap.innerHTML = options.length
    ? options.map((item) => `
      <button class="selected-option-chip" data-remove-option="${kind}" data-option-value="${escapeAttr(item)}" type="button" aria-label="Quitar ${escapeAttr(item)}">
        <span>${escapeHtml(item)}</span>
        <strong aria-hidden="true">x</strong>
      </button>
    `).join("")
    : `<span class="option-empty">${kind === "sizes" ? "Sin tallas específicas" : "Sin colores específicos"}</span>`;
}

function isProductOptionKind(kind) {
  return kind === "sizes" || kind === "colors";
}

function normalizeOptionList(value) {
  const rawList = Array.isArray(value)
    ? value
    : String(value || "").split(",");
  return rawList
    .map(normalizeOptionValue)
    .filter(Boolean)
    .reduce((items, item) => (
      items.some((existing) => sameOption(existing, item)) ? items : [...items, item]
    ), []);
}

function normalizeOptionValue(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function sameOption(left, right) {
  return normalizeOptionValue(left).toLowerCase() === normalizeOptionValue(right).toLowerCase();
}

function askConfirm({ title, message, actionLabel }) {
  if (!adminEls.confirmOverlay) return Promise.resolve(false);
  setText(adminEls.confirmTitle, title);
  setText(adminEls.confirmMessage, message);
  setText(adminEls.confirmAccept, actionLabel || "Confirmar");
  adminEls.confirmOverlay.hidden = false;
  document.body.classList.add("drawer-open");
  adminEls.confirmAccept?.focus();

  return new Promise((resolve) => {
    adminState.pendingConfirm = resolve;
  });
}

function settleConfirm(value) {
  if (!adminState.pendingConfirm) return;
  const resolve = adminState.pendingConfirm;
  adminState.pendingConfirm = null;
  if (adminEls.confirmOverlay) adminEls.confirmOverlay.hidden = true;
  if (isHidden(adminEls.productDrawer) && isHidden(adminEls.categoryDrawer)) {
    document.body.classList.remove("drawer-open");
  }
  resolve(value);
}

async function publicApi(url, options = {}) {
  return request(url, options, false);
}

async function adminApi(url, options = {}) {
  return request(url, options, true);
}

async function request(url, options = {}, needsAuth) {
  const headers = { ...(options.headers || {}) };
  const isForm = options.body instanceof FormData;
  const method = options.method || "GET";
  let body = options.body;
  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs || (isForm ? 45000 : 25000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (needsAuth && method !== "GET" && method !== "HEAD") {
    headers["X-CSRF-Token"] = adminState.csrfToken || "";
  }
  if (body && !isForm) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${url}`, {
      method,
      headers,
      body,
      credentials: needsAuth ? "include" : "same-origin",
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("El servidor tardó demasiado. Revisa la conexión o intenta con una imagen más liviana.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && needsAuth) logout();
    throw new Error(data.error || "Solicitud no disponible.");
  }
  return data;
}

function assetUrl(value) {
  const url = String(value || "");
  if (window.location.protocol === "file:" && url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function setMessage(element, message, isError = false, isSuccess = false) {
  if (!element) return;
  element.textContent = message || "";
  element.classList.toggle("is-error", Boolean(isError));
  element.classList.toggle("is-success", Boolean(isSuccess));
}

function setButtonLoading(button, isLoading) {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = "Guardando...";
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function showToast(message) {
  if (!adminEls.toast) return;
  adminEls.toast.textContent = message;
  adminEls.toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => adminEls.toast.classList.remove("is-visible"), 2800);
}

function showErrorToast(error) {
  showToast(error.message || "No se pudo completar la acción.");
}

function emptyAdminState(title, message = "Cuando guardes información aparecerá aquí.") {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></div>`;
}

function paymentLabel(method, paymentStatus) {
  const methodLabel = method === "paypal" ? "PayPal" : "WhatsApp";
  const status = paymentStatus === "paid" ? "pagado" : "pendiente";
  return `${methodLabel}, ${status}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function formatPercent(value) {
  const number = Number(value || 0);
  return `${number.toFixed(number % 1 === 0 ? 0 : 1)}%`;
}

function shortCurrency(value) {
  const number = Number(value || 0);
  if (Math.abs(number) >= 1000) return `$${(number / 1000).toFixed(1)}k`;
  return `$${number.toFixed(0)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function asList(value) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value || "");
}

function isHidden(element) {
  return !element || element.hidden;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
