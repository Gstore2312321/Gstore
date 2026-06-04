const ADMIN_TOKEN_KEY = "gstore_admin_token";
const ADMIN_CSRF_KEY = "gstore_admin_csrf";
const CHART_JS_SRC = "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";
localStorage.removeItem(ADMIN_TOKEN_KEY);
sessionStorage.removeItem(ADMIN_TOKEN_KEY);
let chartJsPromise = null;

const adminState = {
  csrfToken: sessionStorage.getItem(ADMIN_CSRF_KEY) || "",
  page: document.body.dataset.adminPage || "dashboard",
  products: [],
  categories: [],
  orders: [],
  customers: [],
  banners: [],
  emailStatus: null,
  analytics: null,
  charts: {},
  productSearch: "",
  productStatusFilter: "all",
  productCategoryFilter: "all",
  productBrandFilter: "all",
  reportPeriodFilter: "all",
  orderSearch: "",
  orderStatusFilter: "all",
  orderPeriodFilter: "all",
  customerSearch: "",
  productOptions: {
    sizes: [],
    colors: []
  },
  pendingConfirm: null,
  productValidationStarted: false
};

const API_BASE = window.location.protocol === "file:" ? "http://localhost:4321" : "";
const ADMIN_IMAGE_WIDTHS = [96, 140, 180, 260];
const ADMIN_PREVIEW_WIDTHS = [260, 360, 520, 720];

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
  bannerForm: document.querySelector("#bannerForm"),
  bannerMessage: document.querySelector("#bannerMessage"),
  bannerPreview: document.querySelector("#bannerPreview"),
  bannerAdminList: document.querySelector("#bannerAdminList"),
  bannerCountText: document.querySelector("#bannerCountText"),
  resetBannerForm: document.querySelector("#resetBannerForm"),
  salesProfitChart: document.querySelector("#salesProfitChart"),
  productProfitChart: document.querySelector("#productProfitChart"),
  categoryProfitChart: document.querySelector("#categoryProfitChart"),
  orderStatusChart: document.querySelector("#orderStatusChart"),
  insightLowStock: document.querySelector("#insightLowStock"),
  insightActiveCategories: document.querySelector("#insightActiveCategories"),
  insightLatestOrderTitle: document.querySelector("#insightLatestOrderTitle"),
  insightLatestOrder: document.querySelector("#insightLatestOrder"),
  productForm: document.querySelector("#productForm"),
  productFormGuide: document.querySelector("#productFormGuide"),
  productMessage: document.querySelector("#productMessage"),
  productCategorySelect: document.querySelector("#productCategorySelect"),
  productsTable: document.querySelector("#productsTable"),
  productShelfNotes: document.querySelector("#productShelfNotes"),
  productSearch: document.querySelector("#productSearch"),
  productStatusFilter: document.querySelector("#productStatusFilter"),
  productCategoryFilter: document.querySelector("#productCategoryFilter"),
  productBrandFilter: document.querySelector("#productBrandFilter"),
  productDrawer: document.querySelector("#productDrawer"),
  productDrawerTitle: document.querySelector("#productDrawerTitle"),
  productDrawerKicker: document.querySelector("#productDrawerKicker"),
  productImagePreview: document.querySelector("#productImagePreview"),
  resetImageFrame: document.querySelector("#resetImageFrame"),
  discountPriceWrap: document.querySelector("#discountPriceWrap"),
  discountPercentWrap: document.querySelector("#discountPercentWrap"),
  discountSummary: document.querySelector("#discountSummary"),
  discountFinalPrice: document.querySelector("#discountFinalPrice"),
  discountSavingsText: document.querySelector("#discountSavingsText"),
  resetProductForm: document.querySelector("#resetProductForm"),
  newProductButton: document.querySelector("#newProductButton"),
  quickProductButton: document.querySelector("#quickProductButton"),
  productCreateButton: document.querySelector("#productCreateButton"),
  productPrintButton: document.querySelector("#productPrintButton"),
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
  orderSearch: document.querySelector("#orderSearch"),
  orderStatusFilter: document.querySelector("#orderStatusFilter"),
  orderPeriodFilter: document.querySelector("#orderPeriodFilter"),
  orderPrintButton: document.querySelector("#orderPrintButton"),
  customersList: document.querySelector("#customersList"),
  customersTotal: document.querySelector("#customersTotal"),
  customersWithEmail: document.querySelector("#customersWithEmail"),
  customersOrdersTotal: document.querySelector("#customersOrdersTotal"),
  customersTotalSpent: document.querySelector("#customersTotalSpent"),
  customerSearch: document.querySelector("#customerSearch"),
  refreshCustomersButton: document.querySelector("#refreshCustomersButton"),
  exportCustomersButton: document.querySelector("#exportCustomersButton"),
  emailConfigured: document.querySelector("#emailConfigured"),
  emailFrom: document.querySelector("#emailFrom"),
  emailOwner: document.querySelector("#emailOwner"),
  emailHint: document.querySelector("#emailHint"),
  refreshReportsButton: document.querySelector("#refreshReportsButton"),
  reportPeriodFilter: document.querySelector("#reportPeriodFilter"),
  reportPrintButton: document.querySelector("#reportPrintButton"),
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
  prefetchAdminPages();
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
  on(adminEls.refreshCustomersButton, "click", () => refreshCustomers().catch(showErrorToast));
  on(adminEls.exportCustomersButton, "click", exportCustomers);
  on(adminEls.refreshReportsButton, "click", () => refreshAll().catch(showErrorToast));
  on(adminEls.reportPeriodFilter, "change", (event) => {
    adminState.reportPeriodFilter = event.target.value;
    renderReports();
  });
  on(adminEls.reportPrintButton, "click", () => printAdminView("reports"));
  on(adminEls.productPrintButton, "click", () => printAdminView("products"));
  on(adminEls.orderPrintButton, "click", () => printAdminView("orders"));
  on(adminEls.bannerForm, "submit", saveBanner);
  on(adminEls.resetBannerForm, "click", () => resetBannerForm());
  on(adminEls.bannerForm?.elements.imageFile, "change", previewSelectedBannerImage);
  on(adminEls.bannerForm?.elements.image_url, "input", () => {
    const value = adminEls.bannerForm.elements.image_url.value.trim();
    renderBannerPreview(value, currentBannerDraft());
  });
  ["kicker", "title", "text"].forEach((name) => {
    on(adminEls.bannerForm?.elements[name], "input", () => {
      renderBannerPreview(adminEls.bannerPreview?.dataset.previewSrc || adminEls.bannerForm.elements.image_url.value.trim(), currentBannerDraft());
    });
  });

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
  on(adminEls.productCategoryFilter, "change", (event) => {
    adminState.productCategoryFilter = event.target.value;
    renderProductShelfNotes();
    renderProductsTable();
  });
  on(adminEls.productBrandFilter, "change", (event) => {
    adminState.productBrandFilter = event.target.value;
    renderProductShelfNotes();
    renderProductsTable();
  });
  on(adminEls.productStatusFilter, "change", (event) => {
    adminState.productStatusFilter = event.target.value;
    renderProductShelfNotes();
    renderProductsTable();
  });
  on(adminEls.productShelfNotes, "click", handleProductFilterClick);
  on(adminEls.orderSearch, "input", (event) => {
    adminState.orderSearch = event.target.value.trim().toLowerCase();
    renderOrders();
  });
  on(adminEls.orderStatusFilter, "change", (event) => {
    adminState.orderStatusFilter = event.target.value;
    renderOrders();
  });
  on(adminEls.orderPeriodFilter, "change", (event) => {
    adminState.orderPeriodFilter = event.target.value;
    renderOrders();
  });
  on(adminEls.customerSearch, "input", (event) => {
    adminState.customerSearch = event.target.value.trim().toLowerCase();
    renderCustomers();
  });

  if (adminEls.productForm) {
    on(adminEls.productForm.elements.imageFile, "change", previewSelectedImage);
    on(adminEls.productForm.elements.image_url, "input", () => {
      const value = adminEls.productForm.elements.image_url.value.trim();
      if (value) setProductPreview(value);
    });
    ["image_fit", "image_zoom", "image_position_x", "image_position_y"].forEach((name) => {
      const field = adminEls.productForm.elements[name];
      if (!field) return;
      on(field, "input", applyProductImageFrame);
      on(field, "change", applyProductImageFrame);
    });
    on(adminEls.resetImageFrame, "click", resetProductImageFrame);
    on(adminEls.productForm.elements.has_discount, "change", renderDiscountState);
    on(adminEls.productForm.elements.compare_price, "input", () => applyDiscountCalculator("compare"));
    on(adminEls.productForm.elements.discount_percent, "input", () => applyDiscountCalculator("percent"));
    on(adminEls.productForm.elements.price, "input", () => renderDiscountState());
    on(adminEls.productForm, "input", () => {
      renderDiscountSummary();
      if (adminState.productValidationStarted) validateProductForm({ focus: false });
    });
    on(adminEls.productForm, "change", () => {
      renderDiscountSummary();
      if (adminState.productValidationStarted) validateProductForm({ focus: false });
    });
  }

  on(adminEls.confirmCancel, "click", () => settleConfirm(false));
  on(adminEls.confirmAccept, "click", () => settleConfirm(true));
  on(adminEls.confirmOverlay, "click", (event) => {
    if (event.target === adminEls.confirmOverlay) settleConfirm(false);
  });

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("change", handleDocumentChange);
  document.addEventListener("keydown", handleKeydown);
  bindAdminNavigation();
}

function on(element, eventName, handler) {
  if (element) element.addEventListener(eventName, handler);
}

function bindAdminNavigation() {
  const links = Array.from(document.querySelectorAll(".admin-sidebar nav a, .topbar-actions a, .brief-actions a, .daily-action"));
  links.forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!href || href.startsWith("#") || link.target) return;
    on(link, "pointerenter", () => prefetchAdminPage(link.href));
    on(link, "focus", () => prefetchAdminPage(link.href));
    on(link, "click", () => {
      if (link.dataset.navPage === adminState.page) return;
      document.body.classList.add("is-admin-navigating");
      link.classList.add("is-pending");
    });
  });
}

function prefetchAdminPages() {
  if (window.location.protocol === "file:") return;
  const run = () => {
    document.querySelectorAll(".admin-sidebar nav a, .topbar-actions a, .brief-actions a").forEach((link) => {
      prefetchAdminPage(link.href);
    });
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 1800 });
  } else {
    window.setTimeout(run, 700);
  }
}

function prefetchAdminPage(href) {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || document.querySelector(`link[data-prefetch="${url.pathname}"]`)) return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url.pathname;
    link.dataset.prefetch = url.pathname;
    document.head.appendChild(link);
  } catch {
    // Ignore malformed URLs; normal navigation still works.
  }
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
  let activeLink = null;
  const activePage = adminState.page;
  document.querySelectorAll("[data-nav-page]").forEach((link) => {
    const isActive = link.dataset.navPage === activePage;
    link.classList.toggle("is-active", isActive);
    if (isActive) activeLink = link;
  });
  if (activeLink && window.innerWidth < 1080) {
    requestAnimationFrame(() => {
      activeLink.scrollIntoView({ block: "nearest", inline: "center" });
    });
  }
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

  const editBanner = event.target.closest("[data-edit-banner]");
  if (editBanner) {
    editBannerForm(editBanner.dataset.editBanner);
    return;
  }

  const toggleBanner = event.target.closest("[data-toggle-banner]");
  if (toggleBanner) {
    toggleBannerVisibility(toggleBanner.dataset.toggleBanner);
    return;
  }

  const deleteBanner = event.target.closest("[data-delete-banner]");
  if (deleteBanner) {
    removeBanner(deleteBanner.dataset.deleteBanner);
    return;
  }

  const whatsappOrder = event.target.closest("[data-order-whatsapp]");
  if (whatsappOrder) {
    openOrderWhatsapp(Number(whatsappOrder.dataset.orderWhatsapp));
    return;
  }

  const emailOrder = event.target.closest("[data-order-email]");
  if (emailOrder) {
    resendOrderEmail(Number(emailOrder.dataset.orderEmail));
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
  const tasks = [];
  if (["dashboard", "reports"].includes(adminState.page)) tasks.push(refreshSummary());
  if (["dashboard", "reports"].includes(adminState.page)) tasks.push(refreshAnalytics());
  if (adminState.page === "dashboard") tasks.push(refreshBanners());
  if (["dashboard", "products", "categories"].includes(adminState.page)) tasks.push(refreshCategories());
  if (["dashboard", "products"].includes(adminState.page)) tasks.push(refreshProducts());
  if (["dashboard", "reports", "orders"].includes(adminState.page)) tasks.push(refreshOrders(false));
  if (adminState.page === "customers") tasks.push(refreshCustomers(false));
  if (["orders", "customers"].includes(adminState.page)) tasks.push(refreshEmailStatus());
  await Promise.all(tasks);
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
  renderProductFilterControls();
  renderCategories();
  renderInsights();
}

async function refreshProducts() {
  const data = await adminApi("/api/admin/products");
  adminState.products = data.products || [];
  renderProductFilterControls();
  renderProductsTable();
  renderProductShelfNotes();
  renderInsights();
}

async function refreshBanners() {
  if (adminState.page !== "dashboard") return;
  const data = await adminApi("/api/admin/banners");
  adminState.banners = data.banners || [];
  renderBannerAdmin();
}

async function refreshOrders(updateSummary = true) {
  const data = await adminApi("/api/admin/orders");
  adminState.orders = data.orders || [];
  renderOrders();
  renderInsights();
  if (updateSummary) await refreshSummary();
}

async function refreshCustomers(updateSummary = true) {
  const data = await adminApi("/api/admin/customers");
  adminState.customers = data.customers || [];
  renderCustomers();
  if (updateSummary) await refreshEmailStatus();
}

async function refreshEmailStatus() {
  const data = await adminApi("/api/admin/email/status");
  adminState.emailStatus = data;
  renderEmailStatus();
}

function renderInsights() {
  const activeCategories = adminState.categories.filter((category) => category.active).length;
  const noStock = adminState.products.filter((product) => Number(product.stock || 0) <= 0);
  const featured = adminState.products.filter((product) => product.featured).length;
  const latestOrder = adminState.orders[0];
  const noStockText = noStock.length
    ? `${noStock.length} producto${noStock.length === 1 ? "" : "s"} sin stock: ${noStock.slice(0, 3).map((product) => product.name).join(", ")}.`
    : "Sin productos agotados.";

  setText(adminEls.insightLowStock, noStockText);
  setText(adminEls.summaryLowStock, noStock.length);
  setText(
    adminEls.stockActionText,
    noStock.length
      ? `${noStock.slice(0, 2).map((product) => product.name).join(", ")}`
      : "Sin alertas"
  );

  setText(adminEls.insightActiveCategories, `${activeCategories} activa${activeCategories === 1 ? "" : "s"} de ${adminState.categories.length || 0}. ${featured} producto${featured === 1 ? "" : "s"} destacado${featured === 1 ? "" : "s"}.`);

  if (latestOrder) {
    setText(adminEls.insightLatestOrderTitle, latestOrder.order_code);
    setText(adminEls.insightLatestOrder, `${latestOrder.customer_name}, ${formatCurrency(latestOrder.total)}, ${statusLabels[latestOrder.status] || latestOrder.status}.`);
  } else {
    setText(adminEls.insightLatestOrderTitle, "Sin pedidos aún");
    setText(adminEls.insightLatestOrder, "Cuando entre una orden aparecerá aquí.");
  }

  setText(adminEls.sidebarStatus, noStock.length ? `${noStock.length} sin stock` : "Lista");
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
      ? `${formatCurrency(sales)} en ventas netas, ${formatCurrency(profit)} de utilidad bruta estimada y ${formatCurrency(pendingProfit)} pendiente por cobrar.`
      : "Sin ventas activas todavía. Cuando entren pedidos, aquí verás utilidad, margen y tendencia."
  );

  renderDashboardCharts(analytics);
}

function renderDashboardCharts(analytics) {
  if (!window.Chart) {
    loadChartJs().then(() => renderDashboardCharts(analytics)).catch(() => {});
    return;
  }
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
          label: "Utilidad",
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
        label: "Utilidad",
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
        label: "Utilidad potencial",
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
            font: { family: "Outfit", weight: "700" }
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
      ? `Lectura actual: ${orderCount} pedido${orderCount === 1 ? "" : "s"} activo${orderCount === 1 ? "" : "s"}, ${formatCurrency(sales)} en ventas netas, ${formatCurrency(profit)} de utilidad bruta y ${formatPercent(margin)} de margen.`
      : "Sin ventas activas todavía. El reporte ya puede leer inventario, inversión privada y utilidad potencial por categoría."
  );

  renderReportCharts(analytics);
  renderReportProducts(analytics.topProducts || []);
  renderReportCategories(analytics.categoryProfit || []);
  renderReportRecentOrders();
}

function renderReportCharts(analytics) {
  if (!window.Chart) {
    loadChartJs().then(() => renderReportCharts(analytics)).catch(() => {});
    return;
  }
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
          label: "Utilidad",
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
        label: "Utilidad potencial",
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
  adminEls.reportProductsList.innerHTML = products.slice(0, 6).map((product, index) => {
    const sales = Number(product.sales || 0);
    const profit = Number(product.profit || 0);
    const margin = sales > 0 ? (profit / sales) * 100 : 0;
    const quantity = Number(product.quantity || 0);

    return `
    <div class="report-row report-product-row">
      <span class="report-rank">${index + 1}</span>
      <div class="report-row-main">
        <strong>${escapeHtml(product.name)}</strong>
        <small>SKU: ${escapeHtml(product.sku || "no registrado")}</small>
        <div class="report-row-meta">
          <span>${quantity} unidad${quantity === 1 ? "" : "es"} vendida${quantity === 1 ? "" : "s"}</span>
          <span>${formatPercent(margin)} margen</span>
        </div>
      </div>
      <div class="report-row-number">
        <small>Utilidad</small>
        <strong>${formatCurrency(product.profit)}</strong>
        <span>Venta ${formatCurrency(product.sales)}</span>
      </div>
    </div>
  `;
  }).join("") || emptyAdminState("Sin ventas por producto.", "Cuando entren pedidos activos, este ranking mostrará producto, unidades, venta y utilidad.");
}

function renderReportCategories(categories) {
  if (!adminEls.reportCategoriesList) return;
  adminEls.reportCategoriesList.innerHTML = categories.map((category) => {
    const stock = Number(category.stock || 0);
    const inventoryCost = Number(category.inventoryCost || 0);
    const inventoryValue = Number(category.inventoryValue || 0);
    const potentialProfit = Number(category.potentialProfit || 0);
    const margin = inventoryValue > 0 ? (potentialProfit / inventoryValue) * 100 : 0;
    const progress = Math.max(0, Math.min(100, margin));
    const rowClass = potentialProfit < 0 ? " is-negative" : "";

    return `
    <div class="report-row report-category-row${rowClass}">
      <div class="report-category-header">
        <span class="report-rank">${stock}</span>
        <div class="report-row-main">
          <strong>${escapeHtml(category.category)}</strong>
          <small>${stock} unidad${stock === 1 ? "" : "es"} en inventario</small>
        </div>
        <div class="report-row-number">
          <small>Utilidad potencial</small>
          <strong>${formatCurrency(potentialProfit)}</strong>
          <span>${formatPercent(margin)} margen</span>
        </div>
      </div>
      <div class="report-money-grid">
        <div>
          <span>Costo privado</span>
          <strong>${formatCurrency(inventoryCost)}</strong>
        </div>
        <div>
          <span>Venta potencial</span>
          <strong>${formatCurrency(inventoryValue)}</strong>
        </div>
        <div>
          <span>Utilidad</span>
          <strong>${formatCurrency(potentialProfit)}</strong>
        </div>
        <div>
          <span>Margen</span>
          <strong>${formatPercent(margin)}</strong>
        </div>
      </div>
      <div class="report-progress" aria-label="Margen estimado">
        <span style="--progress: ${escapeAttr(progress)}%"></span>
      </div>
    </div>
  `;
  }).join("") || emptyAdminState("Sin inventario medible.", "Agrega productos con stock, precio de venta y costo privado para calcular utilidad por categoría.");
}

function renderReportRecentOrders() {
  if (!adminEls.reportRecentOrders) return;
  const orders = filteredReportOrders();
  adminEls.reportRecentOrders.innerHTML = orders.slice(0, 8).map((order) => `
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

function loadChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (chartJsPromise) return chartJsPromise;
  chartJsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CHART_JS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Chart), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = CHART_JS_SRC;
    script.async = true;
    script.onload = () => resolve(window.Chart);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return chartJsPromise;
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
          font: { family: "Outfit", weight: "700" }
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
        ticks: { color: textColor, font: { family: "Outfit", weight: "700" } }
      },
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          callback: (value) => shortCurrency(value),
          font: { family: "Outfit", weight: "700" }
        }
      }
    }
  };
}

function horizontalCurrencyChartOptions(gridColor, textColor) {
  const compactAxis = window.matchMedia("(max-width: 760px)").matches;
  return {
    ...cartesianChartOptions(gridColor, textColor),
    indexAxis: "y",
    layout: {
      padding: { left: 14, right: 6 }
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          callback: (value) => shortCurrency(value),
          font: { family: "Outfit", weight: "700" }
        }
      },
      y: {
        grid: { display: false },
        ticks: {
          display: !compactAxis,
          color: textColor,
          callback: function(value) {
            const label = String(this.getLabelForValue ? this.getLabelForValue(value) : value || "");
            return label.length > 20 ? `${label.slice(0, 18)}...` : label;
          },
          font: { family: "Outfit", weight: "700" }
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
          font: { family: "Outfit", weight: "700" }
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
  const total = adminState.products.length;
  const noStock = adminState.products.filter((product) => Number(product.stock || 0) <= 0).length;
  const hidden = adminState.products.filter((product) => !product.active).length;
  const promos = adminState.products.filter(isPromoProduct).length;
  const categoryCounts = productCategoryCounts();
  const brandCounts = productBrandCounts();
  const activeStatus = adminState.productStatusFilter;
  const activeCategory = adminState.productCategoryFilter;
  const activeBrand = adminState.productBrandFilter;
  const filterButton = ({ kind, value, label, count, alert = false }) => {
    const active = (
      (kind === "status" && activeStatus === value) ||
      (kind === "category" && activeCategory === value) ||
      (kind === "brand" && activeBrand === value)
    );
    return `
      <button class="shelf-note filter-chip ${active ? "is-active" : ""} ${alert ? "is-alert" : ""}" data-product-filter="${kind}" data-filter-value="${escapeAttr(value)}" type="button" aria-pressed="${active ? "true" : "false"}">
        <span>${escapeHtml(label)}</span>
        <b>${count}</b>
      </button>
    `;
  };

  const statusFilters = [
    filterButton({ kind: "status", value: "all", label: "Todos", count: total }),
    filterButton({ kind: "status", value: "no_stock", label: "Sin stock", count: noStock, alert: noStock > 0 }),
    filterButton({ kind: "status", value: "promo", label: "Con promo", count: promos }),
    filterButton({ kind: "status", value: "hidden", label: "Ocultos", count: hidden })
  ].join("");

  const categoryFilters = [
    filterButton({ kind: "category", value: "all", label: "Todas", count: total }),
    ...categoryCounts.map((item) => filterButton({ kind: "category", value: item.value, label: item.label, count: item.count }))
  ].join("");

  const brandFilters = [
    filterButton({ kind: "brand", value: "all", label: "Todas", count: total }),
    ...brandCounts.map((item) => filterButton({ kind: "brand", value: item.value, label: item.label, count: item.count }))
  ].join("");

  adminEls.productShelfNotes.innerHTML = `
    <div class="product-filter-group">
      <span>Vista</span>
      <div>${statusFilters}</div>
    </div>
    <div class="product-filter-group">
      <span>Categorías</span>
      <div>${categoryFilters}</div>
    </div>
    <div class="product-filter-group">
      <span>Marcas</span>
      <div>${brandFilters}</div>
    </div>
  `;
}

function renderProductFilterControls() {
  syncProductFilterSelect(adminEls.productCategoryFilter, [
    { value: "all", label: "Todas las categorías" },
    ...productCategoryCounts().map((item) => ({
      value: item.value,
      label: `${item.label} (${item.count})`
    }))
  ], "productCategoryFilter");
  syncProductFilterSelect(adminEls.productBrandFilter, [
    { value: "all", label: "Todas las marcas" },
    ...productBrandCounts().map((item) => ({
      value: item.value,
      label: `${item.label} (${item.count})`
    }))
  ], "productBrandFilter");
  syncProductFilterSelect(adminEls.productStatusFilter, [
    { value: "all", label: `Todos los productos (${adminState.products.length})` },
    { value: "active", label: `Activos (${adminState.products.filter((product) => product.active).length})` },
    { value: "hidden", label: `Ocultos (${adminState.products.filter((product) => !product.active).length})` },
    { value: "no_stock", label: `Sin stock (${adminState.products.filter((product) => Number(product.stock || 0) <= 0).length})` },
    { value: "promo", label: `Con promo (${adminState.products.filter(isPromoProduct).length})` }
  ], "productStatusFilter");
}

function syncProductFilterSelect(select, options, stateKey) {
  if (!select) return;
  const current = adminState[stateKey] || "all";
  const hasCurrent = options.some((item) => item.value === current);
  if (!hasCurrent) adminState[stateKey] = "all";
  select.innerHTML = options.map((item) => `
    <option value="${escapeAttr(item.value)}">${escapeHtml(item.label)}</option>
  `).join("");
  select.value = adminState[stateKey] || "all";
}

function productCategoryCounts() {
  const counts = new Map();
  adminState.products.forEach((product) => {
    const value = productCategoryFilterValue(product);
    const label = product.category?.name || "Sin categoría";
    const current = counts.get(value) || { value, label, count: 0 };
    current.count += 1;
    counts.set(value, current);
  });
  adminState.categories.forEach((category) => {
    const value = String(category.id);
    if (!counts.has(value)) counts.set(value, { value, label: category.name, count: 0 });
  });
  return Array.from(counts.values()).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function productBrandCounts() {
  const counts = new Map();
  adminState.products.forEach((product) => {
    const value = productBrandFilterValue(product);
    const label = productBrandLabel(product);
    const current = counts.get(value) || { value, label, count: 0 };
    current.count += 1;
    counts.set(value, current);
  });
  return Array.from(counts.values()).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function handleProductFilterClick(event) {
  const button = event.target.closest("[data-product-filter]");
  if (!button) return;
  const kind = button.dataset.productFilter;
  const value = button.dataset.filterValue || "all";

  if (kind === "status") adminState.productStatusFilter = value;
  if (kind === "category") adminState.productCategoryFilter = value;
  if (kind === "brand") adminState.productBrandFilter = value;

  renderProductFilterControls();
  renderProductShelfNotes();
  renderProductsTable();
}

function productCategoryFilterValue(product) {
  return product.category?.id ? String(product.category.id) : "__none";
}

function productBrandRaw(product) {
  return String(product.brand_name || product.brand || "").trim();
}

function productBrandLabel(product) {
  return productBrandRaw(product) || "Sin marca";
}

function productBrandFilterValue(product) {
  const brand = productBrandRaw(product);
  return brand ? normalizeProductFilterValue(brand) : "__none";
}

function normalizeProductFilterValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "__none";
}

function isPromoProduct(product) {
  const type = product.promo_type || "none";
  const label = String(product.promo_label || "").trim();
  const hasDiscount = Number(product.compare_price || 0) > Number(product.price || 0);
  return type !== "none" || Boolean(label) || hasDiscount;
}

function renderProductsTable() {
  if (!adminEls.productsTable) return;
  const products = filteredProducts();
  adminEls.productsTable.innerHTML = products.map((product) => `
    <tr class="product-admin-card">
      <td data-label="Producto">
        <div class="table-product">
          <img ${imageAttrs(product.image_url, { width: 180, sizes: "68px" })} ${imageFrameAttrs(product, { includeZoom: false })} alt="${escapeAttr(product.name)}">
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <span>${escapeHtml(product.sku || "Sin SKU")}</span>
            ${productBrandRaw(product) ? `<span class="product-brand">Marca: ${escapeHtml(productBrandRaw(product))}</span>` : ""}
          </div>
        </div>
      </td>
      <td data-label="Categoría">${escapeHtml(product.category?.name || "Sin categoría")}</td>
      <td data-label="Precio">${productPriceAdmin(product)}</td>
      <td data-label="Compra">${productCostAdmin(product)}</td>
      <td data-label="Utilidad">${productProfitAdmin(product)}</td>
      <td data-label="Stock">${Number(product.stock || 0)}</td>
      <td data-label="Estado">
        <div class="status-stack">
          <span class="status-pill ${product.active ? "" : "off"}">${product.active ? "Activo" : "Oculto"}</span>
          ${productStockAlertAdmin(product)}
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

function renderBannerAdmin() {
  if (!adminEls.bannerAdminList) return;
  const activeCount = adminState.banners.filter((banner) => banner.active).length;
  setText(adminEls.bannerCountText, `${activeCount} activo${activeCount === 1 ? "" : "s"}`);

  adminEls.bannerAdminList.innerHTML = adminState.banners.map((banner) => `
    <article class="banner-admin-card ${banner.active ? "" : "is-hidden-banner"}">
      <img ${imageAttrs(banner.image_url, { width: 520, widths: ADMIN_PREVIEW_WIDTHS, sizes: "(max-width: 760px) 100vw, 320px" })} alt="${escapeAttr(banner.title)}">
      <div class="banner-admin-card-copy">
        <span>
          <b>${escapeHtml(banner.kicker || "Promo")}</b>
          <em>${banner.active ? "Visible" : "Oculto"}</em>
        </span>
        <strong>${escapeHtml(banner.title)}</strong>
        <small>${escapeHtml(banner.text || (banner.active ? "Visible en la tienda." : "Oculto de la tienda."))}</small>
      </div>
      <div class="row-actions">
        <button class="small-button" data-edit-banner="${escapeAttr(banner.id)}" type="button">Editar</button>
        <button class="small-button" data-toggle-banner="${escapeAttr(banner.id)}" type="button">${banner.active ? "Ocultar" : "Activar"}</button>
        <button class="small-button danger" data-delete-banner="${escapeAttr(banner.id)}" type="button">Eliminar</button>
      </div>
    </article>
  `).join("") || emptyAdminState("No hay banners todavía.", "Sube una imagen y se verá en la cabecera de la tienda.");
}

function editBannerForm(id) {
  const banner = adminState.banners.find((item) => item.id === id);
  const form = adminEls.bannerForm;
  if (!banner || !form) return;
  form.elements.id.value = banner.id;
  form.elements.kicker.value = banner.kicker || "";
  form.elements.title.value = banner.title || "";
  form.elements.text.value = banner.text || "";
  form.elements.link_url.value = banner.link_url || "";
  form.elements.image_url.value = banner.image_url || "";
  form.elements.active.checked = Boolean(banner.active);
  renderBannerPreview(banner.image_url, banner);
  setMessage(adminEls.bannerMessage, "Editando banner existente.");
  form.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  setTimeout(() => form.elements.title?.focus({ preventScroll: true }), 180);
}

function resetBannerForm(options = {}) {
  const form = adminEls.bannerForm;
  if (!form) return;
  form.reset();
  form.elements.id.value = "";
  form.elements.image_url.value = "";
  form.elements.active.checked = true;
  renderBannerPreview("");
  if (!options.silent) setMessage(adminEls.bannerMessage, "");
}

function currentBannerDraft() {
  const form = adminEls.bannerForm;
  if (!form) return {};
  return {
    kicker: form.elements.kicker?.value,
    title: form.elements.title?.value,
    text: form.elements.text?.value
  };
}

function renderBannerPreview(src, banner = {}) {
  if (!adminEls.bannerPreview) return;
  const imageUrl = src || banner.image_url || "";
  adminEls.bannerPreview.dataset.previewSrc = imageUrl;
  const kicker = cleanDisplayText(banner.kicker || "Vista previa");
  const title = cleanDisplayText(banner.title || "Banner de tienda");
  const text = cleanDisplayText(banner.text || "Sube una imagen para ver la pieza final.");
  if (!imageUrl) {
    adminEls.bannerPreview.innerHTML = `
      <div class="banner-preview-copy">
        <span>${escapeHtml(kicker)}</span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(text)}</small>
      </div>
    `;
    return;
  }
  adminEls.bannerPreview.innerHTML = `
    <img ${imageAttrs(imageUrl, { width: 720, widths: ADMIN_PREVIEW_WIDTHS, sizes: "360px", loading: "eager", fetchPriority: "high" })} alt="${escapeAttr(banner.title || "Banner de tienda")}">
    <div class="banner-preview-copy">
      <span>${escapeHtml(kicker)}</span>
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(text)}</small>
    </div>
  `;
}

function previewSelectedBannerImage() {
  const file = adminEls.bannerForm?.elements.imageFile.files[0];
  if (!file) return;
  const objectUrl = URL.createObjectURL(file);
  renderBannerPreview(objectUrl, {
    kicker: adminEls.bannerForm.elements.kicker.value,
    title: adminEls.bannerForm.elements.title.value
  });
}

function cleanDisplayText(value) {
  return String(value || "").trim();
}

function filteredProducts() {
  const query = adminState.productSearch;
  const filter = adminState.productStatusFilter;
  const categoryFilter = adminState.productCategoryFilter || "all";
  const brandFilter = adminState.productBrandFilter || "all";
  return adminState.products.filter((product) => {
    const text = [
      product.name,
      product.sku,
      productBrandRaw(product),
      product.category?.name,
      product.promo_label
    ].join(" ").toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesCategory = categoryFilter === "all" || productCategoryFilterValue(product) === categoryFilter;
    const matchesBrand = brandFilter === "all" || productBrandFilterValue(product) === brandFilter;
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && product.active) ||
      (filter === "hidden" && !product.active) ||
      (filter === "no_stock" && Number(product.stock || 0) <= 0) ||
      (filter === "promo" && isPromoProduct(product));
    return matchesQuery && matchesCategory && matchesBrand && matchesFilter;
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

function productStockAlertAdmin(product) {
  if (Number(product.stock || 0) > 0) return "";
  return `<span class="status-pill stock-alert">Sin stock</span>`;
}

function productPromoAdmin(product) {
  const type = product.promo_type || "none";
  if (!isPromoProduct(product)) return "";
  return `<span class="status-pill promo-status">${escapeHtml(product.promo_label || promoTypeLabel(type))}</span>`;
}

function promoTypeLabel(type) {
  if (type === "discount") return "Descuento";
  if (type === "last_units") return "Últimas unidades";
  if (type === "new_arrival") return "Recién llegado";
  return "";
}

function renderOrders() {
  if (!adminEls.ordersList) return;
  const orders = filteredOrders();
  renderOrdersOverview(orders);
  adminEls.ordersList.innerHTML = orders.map((order) => `
    ${renderOrderCard(order)}
  `).join("") || emptyAdminState("Todavía no hay pedidos.", "Cuando una clienta complete checkout, la orden aparecerá aquí.");
}

function renderOrdersOverview(orders = filteredOrders()) {
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

function filteredOrders() {
  const orders = adminState.orders || [];
  const query = adminState.orderSearch;
  const status = adminState.orderStatusFilter || "all";
  const period = adminState.orderPeriodFilter || "all";
  return orders.filter((order) => {
    const matchesStatus = status === "all" || order.status === status;
    const matchesPeriod = orderMatchesPeriod(order, period);
    const text = [
      order.order_code,
      order.customer_name,
      order.customer_phone,
      order.customer_email,
      order.customer_city,
      order.customer_address,
      statusLabels[order.status],
      paymentLabel(order.payment_method, order.payment_status)
    ].join(" ").toLowerCase();
    const matchesQuery = !query || text.includes(query);
    return matchesStatus && matchesPeriod && matchesQuery;
  });
}

function filteredReportOrders() {
  const period = adminState.reportPeriodFilter || "all";
  return (adminState.orders || []).filter((order) => orderMatchesPeriod(order, period));
}

function orderMatchesPeriod(order, period) {
  if (period === "all") return true;
  const orderDate = new Date(order.created_at);
  if (Number.isNaN(orderDate.getTime())) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "today") return orderDate >= today;
  const days = period === "30d" ? 30 : 7;
  const start = new Date(today);
  start.setDate(today.getDate() - (days - 1));
  return orderDate >= start;
}

function printAdminView(kind) {
  const data = kind === "reports"
    ? buildReportsPrintData()
    : kind === "products"
      ? buildProductsPrintData()
      : buildOrdersPrintData();
  const printWindow = window.open("", "_blank", "width=1120,height=760");
  if (!printWindow) {
    showToast("Activa las ventanas emergentes para imprimir.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(buildPrintDocument(data));
  printWindow.document.close();
  printWindow.focus();
  printWindow.onafterprint = () => printWindow.close();
  setTimeout(() => printWindow.print(), 240);
}

function buildReportsPrintData() {
  const analytics = adminState.analytics || {};
  const totals = analytics.totals || {};
  const orders = filteredReportOrders();
  const orderSummary = summarizeOrders(orders);
  return {
    title: "Reporte de negocio",
    subtitle: "Ventas, utilidad, inventario y pedidos del periodo seleccionado.",
    filters: [
      ["Periodo", periodLabel(adminState.reportPeriodFilter)],
      ["Generado", formatPrintDate(new Date())]
    ],
    metrics: [
      ["Pedidos del periodo", orders.length],
      ["Total visible del periodo", formatCurrency(orderSummary.sales)],
      ["Ticket promedio del periodo", formatCurrency(orderSummary.averageOrder)],
      ["Ventas netas del panel", formatCurrency(totals.sales)],
      ["Utilidad estimada del panel", formatCurrency(totals.estimatedProfit)],
      ["Inventario valorizado", formatCurrency(totals.inventoryValue)]
    ],
    sections: [
      {
        title: "Pedidos del periodo",
        headers: ["Fecha", "Pedido", "Cliente", "Estado", "Pago", "Total"],
        rows: orders.map((order) => [
          formatPrintDate(order.created_at),
          order.order_code,
          order.customer_name,
          statusLabels[order.status] || order.status,
          paymentLabel(order.payment_method, order.payment_status),
          formatCurrency(order.total)
        ]),
        empty: "No hay pedidos dentro del periodo seleccionado."
      },
      {
        title: "Productos con mejor utilidad",
        headers: ["Producto", "SKU", "Unidades", "Venta", "Utilidad"],
        rows: (analytics.topProducts || []).slice(0, 12).map((product) => [
          product.name,
          product.sku || "Sin SKU",
          Number(product.quantity || 0),
          formatCurrency(product.sales),
          formatCurrency(product.profit)
        ]),
        empty: "No hay ventas por producto registradas."
      },
      {
        title: "Inventario por categoria",
        headers: ["Categoria", "Stock", "Costo privado", "Venta potencial", "Utilidad potencial"],
        rows: (analytics.categoryProfit || []).map((category) => [
          category.category,
          Number(category.stock || 0),
          formatCurrency(category.inventoryCost),
          formatCurrency(category.inventoryValue),
          formatCurrency(category.potentialProfit)
        ]),
        empty: "No hay inventario medible por categoria."
      }
    ]
  };
}

function buildProductsPrintData() {
  const products = filteredProducts();
  const inventoryValue = products.reduce((sum, product) => sum + Number(product.price || 0) * Number(product.stock || 0), 0);
  const inventoryCost = products.reduce((sum, product) => sum + Number(product.cost_price || 0) * Number(product.stock || 0), 0);
  const noStock = products.filter((product) => Number(product.stock || 0) <= 0).length;
  return {
    title: "Inventario de productos",
    subtitle: "Catalogo filtrado listo para revisar en papel.",
    filters: [
      ["Busqueda", adminState.productSearch || "Sin busqueda"],
      ["Categoria", selectedText(adminEls.productCategoryFilter)],
      ["Marca", selectedText(adminEls.productBrandFilter)],
      ["Estado", selectedText(adminEls.productStatusFilter)],
      ["Generado", formatPrintDate(new Date())]
    ],
    metrics: [
      ["Productos visibles", products.length],
      ["Activos", products.filter((product) => product.active).length],
      ["Sin stock", noStock],
      ["Unidades visibles", products.reduce((sum, product) => sum + Number(product.stock || 0), 0)],
      ["Costo privado visible", formatCurrency(inventoryCost)],
      ["Venta potencial visible", formatCurrency(inventoryValue)]
    ],
    sections: [{
      title: "Detalle de inventario",
      headers: ["Producto", "Marca", "Categoria", "SKU", "Venta", "Compra", "Stock", "Estado"],
      rows: products.map((product) => [
        product.name,
        productBrandRaw(product) || "Sin marca",
        product.category?.name || "Sin categoria",
        product.sku || "Sin SKU",
        formatCurrency(product.price),
        formatCurrency(product.cost_price),
        Number(product.stock || 0),
        product.active ? "Activo" : "Oculto"
      ]),
      empty: "No hay productos con los filtros aplicados."
    }]
  };
}

function buildOrdersPrintData() {
  const orders = filteredOrders();
  const summary = summarizeOrders(orders);
  return {
    title: "Pedidos",
    subtitle: "Listado operativo segun filtros de busqueda, periodo y estado.",
    filters: [
      ["Busqueda", adminState.orderSearch || "Sin busqueda"],
      ["Periodo", selectedText(adminEls.orderPeriodFilter)],
      ["Estado", selectedText(adminEls.orderStatusFilter)],
      ["Generado", formatPrintDate(new Date())]
    ],
    metrics: [
      ["Pedidos visibles", orders.length],
      ["Total no cancelado", formatCurrency(summary.sales)],
      ["Total pagado", formatCurrency(summary.paidSales)],
      ["Ticket promedio", formatCurrency(summary.averageOrder)],
      ["Unidades", summary.units],
      ["Pendientes", orders.filter((order) => ["new", "waiting_payment", "paid", "preparing", "ready", "sent"].includes(order.status)).length]
    ],
    sections: [{
      title: "Detalle de pedidos",
      headers: ["Fecha", "Pedido", "Cliente", "Telefono", "Estado", "Pago", "Entrega", "Productos", "Total"],
      rows: orders.map((order) => [
        formatPrintDate(order.created_at),
        order.order_code,
        order.customer_name,
        order.customer_phone,
        statusLabels[order.status] || order.status,
        paymentLabel(order.payment_method, order.payment_status),
        orderDeliveryLabel(order),
        orderItemsSummary(order),
        formatCurrency(order.total)
      ]),
      empty: "No hay pedidos con los filtros aplicados."
    }]
  };
}

function buildPrintDocument({ title, subtitle, filters, metrics, sections }) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} | GStore</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 28px; color: #17130a; background: #fffdf8; font-family: Arial, sans-serif; font-size: 12px; }
    header { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: start; padding-bottom: 16px; border-bottom: 2px solid #17130a; }
    h1 { margin: 0; font-size: 28px; line-height: 1; }
    h2 { margin: 22px 0 10px; font-size: 16px; }
    p { margin: 7px 0 0; color: #5f574b; line-height: 1.45; }
    .brand { text-align: right; font-weight: 800; }
    .filters, .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
    .chip, .metric { border: 1px solid #ded1b8; border-radius: 8px; padding: 8px 10px; background: #fbf6ea; }
    .chip span, .metric span { display: block; color: #746a5c; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
    .chip strong, .metric strong { display: block; margin-top: 3px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; page-break-inside: auto; }
    th, td { padding: 7px 8px; border: 1px solid #ded1b8; text-align: left; vertical-align: top; }
    th { background: #efe4cf; color: #5d4a22; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    .empty { padding: 12px; border: 1px dashed #ded1b8; border-radius: 8px; color: #746a5c; }
    footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #ded1b8; color: #746a5c; font-size: 10px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
    </div>
    <div class="brand">GStore<br><span>Panel privado</span></div>
  </header>
  <section class="filters">
    ${filters.map(([label, value]) => `<div class="chip"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
  </section>
  <section class="metrics">
    ${metrics.map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
  </section>
  ${sections.map((section) => `
    <section>
      <h2>${escapeHtml(section.title)}</h2>
      ${section.rows.length ? `
        <table>
          <thead><tr>${section.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
          <tbody>${section.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      ` : `<div class="empty">${escapeHtml(section.empty)}</div>`}
    </section>
  `).join("")}
  <footer>Documento generado desde el panel privado de GStore.</footer>
</body>
</html>`;
}

function summarizeOrders(orders) {
  const active = orders.filter((order) => order.status !== "cancelled");
  const sales = active.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const paidSales = active
    .filter((order) => order.payment_status === "paid")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const units = orders.reduce((sum, order) => sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0);
  return {
    sales,
    paidSales,
    units,
    averageOrder: active.length ? sales / active.length : 0
  };
}

function orderItemsSummary(order) {
  return (order.items || [])
    .map((item) => `${Number(item.quantity || 0)} ${item.name}`)
    .join(", ") || "Sin productos";
}

function selectedText(select) {
  return select?.selectedOptions?.[0]?.textContent?.trim() || "Todos";
}

function periodLabel(value) {
  const labels = {
    all: "Todo el historial",
    today: "Hoy",
    "7d": "Ultimos 7 dias",
    "30d": "Ultimos 30 dias"
  };
  return labels[value] || labels.all;
}

function formatPrintDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function renderEmailStatus() {
  const status = adminState.emailStatus;
  if (!status) return;
  const configured = Boolean(status.configured && status.ownerConfigured);
  setText(adminEls.emailConfigured, configured ? "Activo" : "Falta configurar");
  setText(adminEls.emailFrom, status.fromConfigured ? `Remitente: ${status.fromEmail || "configurado"}` : "Falta RESEND_FROM_EMAIL");
  setText(adminEls.emailOwner, status.ownerConfigured ? `Admin: ${status.ownerEmail || "configurado"}` : "Falta RESEND_TO_EMAIL o STORE_OWNER_EMAIL");
  if (adminEls.emailHint) {
    adminEls.emailHint.innerHTML = configured
      ? "<strong>Correo</strong> Resend listo para confirmaciones"
      : "<strong>Correo</strong> Faltan variables de Resend";
  }
}

function renderCustomers() {
  if (!adminEls.customersList) return;
  renderCustomersOverview();
  const customers = filteredCustomers();
  adminEls.customersList.innerHTML = customers.map(renderCustomerCard).join("")
    || emptyAdminState("Todavia no hay clientes guardados.", "Cuando entren pedidos con correo, la ficha del cliente aparecera aqui.");
}

function renderCustomersOverview() {
  const customers = adminState.customers || [];
  const withEmail = customers.filter((customer) => customer.email).length;
  const ordersTotal = customers.reduce((sum, customer) => sum + Number(customer.order_count || 0), 0);
  const totalSpent = customers.reduce((sum, customer) => sum + Number(customer.total_spent || 0), 0);
  setText(adminEls.customersTotal, customers.length);
  setText(adminEls.customersWithEmail, withEmail);
  setText(adminEls.customersOrdersTotal, ordersTotal);
  setText(adminEls.customersTotalSpent, formatCurrency(totalSpent));
}

function filteredCustomers() {
  const query = adminState.customerSearch;
  const customers = adminState.customers || [];
  if (!query) return customers;
  return customers.filter((customer) => [
    customer.name,
    customer.phone,
    customer.email,
    customer.city,
    customer.address,
    customer.last_order_code
  ].join(" ").toLowerCase().includes(query));
}

function renderCustomerCard(customer) {
  const whatsappPhone = String(customer.phone || "").replace(/[^\d]/g, "");
  const lastOrder = customer.last_order_code || "Sin codigo";
  const lastOrderDate = customer.last_order_at ? formatDate(customer.last_order_at) : "Sin fecha";
  return `
    <article class="customer-card">
      <div class="customer-card-head">
        <div>
          <span class="customer-kicker">${escapeHtml(customer.marketing_status || "cliente")}</span>
          <h3>${escapeHtml(customer.name || "Cliente sin nombre")}</h3>
          <p>${escapeHtml(customer.email || "Sin correo")} - ${escapeHtml(customer.phone || "Sin telefono")}</p>
        </div>
        <div class="customer-value">
          <strong>${formatCurrency(customer.total_spent)}</strong>
          <small>${Number(customer.order_count || 0)} pedido${Number(customer.order_count || 0) === 1 ? "" : "s"}</small>
        </div>
      </div>

      <div class="customer-contact-grid">
        <div>
          <span>Ciudad</span>
          <strong>${escapeHtml(customer.city || "Sin ciudad")}</strong>
        </div>
        <div>
          <span>Direccion</span>
          <strong>${escapeHtml(customer.address || "Sin direccion")}</strong>
        </div>
        <div>
          <span>Ultimo pedido</span>
          <strong>${escapeHtml(lastOrder)}</strong>
          <small>${escapeHtml(lastOrderDate)}</small>
        </div>
      </div>

      ${customer.notes ? `
        <div class="customer-note">
          <span>Notas</span>
          <p>${escapeHtml(customer.notes)}</p>
        </div>
      ` : ""}

      <div class="customer-actions">
        ${customer.email ? `<a class="small-button" href="mailto:${escapeAttr(customer.email)}">Enviar email</a>` : ""}
        ${whatsappPhone ? `<a class="small-button" href="https://wa.me/${escapeAttr(whatsappPhone)}" target="_blank" rel="noreferrer">WhatsApp</a>` : ""}
      </div>
    </article>
  `;
}

function renderOrderCard(order) {
  const nextAction = orderNextAction(order);
  const adminEmailStatus = emailStatusLabel(order.admin_email_status);
  const customerEmailStatus = emailStatusLabel(order.customer_email_status);
  const emailDetail = order.email_error
    ? `Error: ${order.email_error}`
    : order.email_sent_at
      ? `Ultimo intento: ${formatDate(order.email_sent_at)}`
      : "Sin intento registrado";
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
        <div class="order-info-card email-info-card">
          <span>Correos</span>
          <strong>
            <span class="status-pill ${emailStatusClass(order.customer_email_status)}">Cliente: ${escapeHtml(customerEmailStatus)}</span>
          </strong>
          <small>Admin: ${escapeHtml(adminEmailStatus)} - ${escapeHtml(emailDetail)}</small>
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
          <button class="button ghost" data-order-email="${order.id}" type="button">Reenviar correo</button>
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

function emailStatusLabel(status) {
  const labels = {
    sent: "Enviado",
    failed: "Fallido",
    skipped: "Omitido",
    pending: "Pendiente"
  };
  return labels[status] || labels.pending;
}

function emailStatusClass(status) {
  if (status === "sent") return "success";
  if (status === "failed") return "email-failed";
  if (status === "skipped") return "warning";
  return "off";
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
    window.location.href = pagePath("admin-productos");
    return;
  }
  const product = id ? adminState.products.find((item) => item.id === id) : null;
  resetProductForm({ silent: true });

  if (product) {
    const form = adminEls.productForm;
    form.elements.id.value = product.id;
    form.elements.name.value = product.name;
    if (form.elements.brand_name) form.elements.brand_name.value = product.brand_name || "";
    form.elements.category_id.value = product.category?.id || "";
    form.elements.price.value = product.price;
    form.elements.cost_price.value = product.cost_price || "";
    form.elements.compare_price.value = product.compare_price || "";
    form.elements.has_discount.checked = Number(product.compare_price || 0) > Number(product.price || 0) || product.promo_type === "discount";
    form.elements.discount_percent.value = discountPercentFromPrices(product.compare_price, product.price) || "";
    form.elements.stock.value = product.stock;
    form.elements.sku.value = product.sku || "";
    form.elements.image_url.value = product.image_url || "";
    setProductImageFrame(product);
    setProductOptions("sizes", product.sizes);
    setProductOptions("colors", product.colors);
    form.elements.promo_type.value = product.promo_type || "none";
    form.elements.promo_label.value = product.promo_label || "";
    if (form.elements.description) form.elements.description.value = product.description || "";
    form.elements.active.checked = Boolean(product.active);
    form.elements.featured.checked = Boolean(product.featured);
    renderDiscountState();
    setProductPreview(product.image_url || "/assets/product-placeholder.svg");
    setText(adminEls.productDrawerKicker, "Editar producto");
    setText(adminEls.productDrawerTitle, product.name);
  } else {
    setText(adminEls.productDrawerKicker, "Nuevo producto");
    setText(adminEls.productDrawerTitle, "Agregar producto");
  }

  adminState.productValidationStarted = false;
  clearProductValidation();
  updateProductGuide();
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
  if (adminEls.productForm.elements.brand_name) adminEls.productForm.elements.brand_name.value = "";
  adminEls.productForm.elements.has_discount.checked = false;
  adminEls.productForm.elements.compare_price.value = "";
  adminEls.productForm.elements.discount_percent.value = "";
  adminEls.productForm.elements.promo_label.value = "";
  setProductImageFrame();
  renderDiscountState();
  setProductOptions("sizes", []);
  setProductOptions("colors", []);
  setProductPreview("/assets/product-placeholder.svg");
  adminState.productValidationStarted = false;
  clearProductValidation();
  updateProductGuide();
  if (!options.silent) setMessage(adminEls.productMessage, "");
}

function renderDiscountState() {
  if (!adminEls.productForm) return;
  const isDiscount = Boolean(adminEls.productForm.elements.has_discount?.checked);
  if (adminEls.discountPriceWrap) adminEls.discountPriceWrap.hidden = !isDiscount;
  if (adminEls.discountPercentWrap) adminEls.discountPercentWrap.hidden = !isDiscount;
  if (adminEls.discountSummary) adminEls.discountSummary.hidden = !isDiscount;
  if (adminEls.productForm.elements.compare_price) {
    adminEls.productForm.elements.compare_price.required = isDiscount;
    if (!isDiscount) {
      adminEls.productForm.elements.compare_price.value = "";
      if (adminEls.productForm.elements.discount_percent) adminEls.productForm.elements.discount_percent.value = "";
    }
  }
  if (adminEls.productForm.elements.promo_type) {
    adminEls.productForm.elements.promo_type.disabled = isDiscount;
    if (isDiscount) adminEls.productForm.elements.promo_type.value = "none";
  }
  renderDiscountSummary();
  if (adminState.productValidationStarted) validateProductForm({ focus: false });
}

function applyDiscountCalculator(source = "") {
  const form = adminEls.productForm;
  if (!form || !form.elements.has_discount?.checked) return;
  const comparePrice = Number(form.elements.compare_price?.value || 0);
  const percent = Number(form.elements.discount_percent?.value || 0);
  if (["compare", "percent"].includes(source) && comparePrice > 0 && percent > 0 && percent < 100) {
    form.elements.price.value = formatMoneyInput(comparePrice * (1 - percent / 100));
  }
  renderDiscountSummary();
}

function renderDiscountSummary() {
  const form = adminEls.productForm;
  if (!form || !adminEls.discountSummary) return;
  const enabled = Boolean(form.elements.has_discount?.checked);
  adminEls.discountSummary.hidden = !enabled;
  if (!enabled) return;

  const comparePrice = Number(form.elements.compare_price?.value || 0);
  const salePrice = Number(form.elements.price?.value || 0);
  const savings = comparePrice - salePrice;
  const percent = discountPercentFromPrices(comparePrice, salePrice);

  if (adminEls.discountFinalPrice) {
    setText(adminEls.discountFinalPrice, salePrice > 0 ? formatCurrency(salePrice) : "$0.00");
  }

  if (!comparePrice || !salePrice || savings <= 0 || !percent) {
    setText(adminEls.discountSavingsText, "Agrega precio anterior y descuento para ver el ahorro.");
    adminEls.discountSummary.classList.remove("is-ready");
    return;
  }

  setText(adminEls.discountSavingsText, `La clienta ahorra ${formatCurrency(savings)} · ${percent}% menos.`);
  adminEls.discountSummary.classList.add("is-ready");
}

function discountPercentFromPrices(comparePrice, salePrice) {
  const compare = Number(comparePrice || 0);
  const sale = Number(salePrice || 0);
  if (!compare || !sale || compare <= sale) return 0;
  return Math.round(((compare - sale) / compare) * 100);
}

function formatMoneyInput(value) {
  const amount = Math.max(0, Number(value) || 0);
  return (Math.round(amount * 100) / 100).toFixed(2);
}

function validateProductForm({ focus = false } = {}) {
  const form = adminEls.productForm;
  if (!form) return { ok: true, errors: [] };
  clearProductValidation();

  const errors = [];
  const addError = (name, message) => {
    errors.push({ name, message });
    setProductFieldError(name, message);
  };

  const name = String(form.elements.name?.value || "").trim();
  const categoryId = String(form.elements.category_id?.value || "").trim();
  const priceRaw = String(form.elements.price?.value || "").trim();
  const costRaw = String(form.elements.cost_price?.value || "").trim();
  const stockRaw = String(form.elements.stock?.value || "").trim();
  const compareRaw = String(form.elements.compare_price?.value || "").trim();
  const discountPercentRaw = String(form.elements.discount_percent?.value || "").trim();
  const salePrice = Number(priceRaw);
  const comparePrice = Number(compareRaw);
  const discountPercent = Number(discountPercentRaw);
  const stock = Number(stockRaw);
  const imageFile = form.elements.imageFile?.files?.[0];
  const imageUrl = String(form.elements.image_url?.value || "").trim();
  const brandName = String(form.elements.brand_name?.value || "").trim();

  if (name.length < 2) addError("name", "Escribe el nombre del producto.");
  if (brandName.length > 120) addError("brand_name", "Usa una marca mas corta.");
  if (!adminState.categories.length) {
    addError("category_id", "Crea una categoría antes de guardar.");
  } else if (!categoryId) {
    addError("category_id", "Selecciona una categoría.");
  }
  if (!priceRaw || !Number.isFinite(salePrice) || salePrice <= 0) {
    addError("price", "Escribe un precio de venta mayor a 0.");
  } else if (salePrice > 99999) {
    addError("price", "Usa un precio menor a 99,999.");
  }
  if (costRaw && (!Number.isFinite(Number(costRaw)) || Number(costRaw) < 0)) {
    addError("cost_price", "El costo privado no puede ser negativo.");
  }
  if (stockRaw === "" || !Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
    addError("stock", "Escribe un stock entero: 0, 1, 2...");
  } else if (stock > 999) {
    addError("stock", "Usa un stock menor a 1,000.");
  }

  const hasProductImage = Boolean(imageFile || (imageUrl && !imageUrl.includes("product-placeholder.svg")));
  if (!hasProductImage) {
    addError("image", "Sube una foto del producto.");
  }
  if (imageFile && !["image/jpeg", "image/png", "image/webp"].includes(imageFile.type)) {
    addError("image", "Usa una imagen JPG, PNG o WebP.");
  }
  if (imageFile && imageFile.size > 8 * 1024 * 1024) {
    addError("image", "La imagen debe pesar máximo 8 MB.");
  }

  if (form.elements.has_discount?.checked) {
    if (!compareRaw || !Number.isFinite(comparePrice) || comparePrice <= salePrice) {
      addError("compare_price", "El precio anterior debe ser mayor al precio de venta.");
    }
    if (discountPercentRaw && (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 95)) {
      addError("discount_percent", "Usa un descuento entre 1% y 95%.");
    }
  }

  updateProductGuide(errors);

  if (focus && errors.length) {
    focusProductField(errors[0].name);
  }

  return { ok: errors.length === 0, errors };
}

function clearProductValidation() {
  const form = adminEls.productForm;
  if (!form) return;
  form.querySelectorAll(".field-has-error").forEach((element) => element.classList.remove("field-has-error"));
  form.querySelectorAll(".field-error").forEach((element) => {
    element.textContent = "";
  });
  form.querySelectorAll("[aria-invalid='true']").forEach((element) => element.removeAttribute("aria-invalid"));
}

function setProductFieldError(name, message) {
  const form = adminEls.productForm;
  if (!form) return;
  const wrap = form.querySelector(`[data-field-wrap="${name}"]`);
  wrap?.classList.add("field-has-error");
  const error = form.querySelector(`[data-error-for="${name}"]`);
  if (error) error.textContent = message;
  const field = name === "image" ? form.elements.imageFile : form.elements[name];
  field?.setAttribute("aria-invalid", "true");
}

function focusProductField(name) {
  const form = adminEls.productForm;
  if (!form) return;
  const wrap = form.querySelector(`[data-field-wrap="${name}"]`);
  const field = name === "image" ? form.elements.imageFile : form.elements[name];
  wrap?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  setTimeout(() => field?.focus({ preventScroll: true }), 160);
}

function updateProductGuide(errors = []) {
  if (!adminEls.productFormGuide) return;
  const title = adminEls.productFormGuide.querySelector("strong");
  const copy = adminEls.productFormGuide.querySelector("span");
  adminEls.productFormGuide.classList.toggle("is-error", errors.length > 0);
  adminEls.productFormGuide.classList.toggle("is-ready", adminState.productValidationStarted && errors.length === 0);

  if (errors.length) {
    setText(title, `Faltan ${errors.length} dato${errors.length === 1 ? "" : "s"}`);
    setText(copy, errors.slice(0, 3).map((error) => error.message).join(" "));
    return;
  }
  if (adminState.productValidationStarted) {
    setText(title, "Listo para guardar");
    setText(copy, "La ficha tiene los datos importantes completos.");
    return;
  }
  setText(title, "Completa lo básico");
  setText(copy, "Nombre, categoría, precio, stock e imagen.");
}

async function saveProduct(event) {
  event.preventDefault();
  const form = adminEls.productForm;
  const submitButton = form.querySelector('button[type="submit"]');
  adminState.productValidationStarted = true;
  const validation = validateProductForm({ focus: true });
  if (!validation.ok) {
    setMessage(adminEls.productMessage, "Completa los campos marcados antes de guardar.", true);
    return;
  }
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
      let uploaded;
      try {
        uploaded = await adminApi("/api/admin/upload", {
          method: "POST",
          body: uploadForm
        });
      } catch (uploadError) {
        throw new Error(`No se pudo subir la imagen: ${uploadError.message}`);
      }
      if (!uploaded?.url) throw new Error("Cloudinary no devolvio una URL de imagen.");
      imageUrl = uploaded.url;
    }

    const payload = {
      name: formData.get("name"),
      brand_name: formData.get("brand_name"),
      category_id: formData.get("category_id"),
      price: formData.get("price"),
      cost_price: formData.get("cost_price"),
      compare_price: hasDiscount ? formData.get("compare_price") : "",
      stock: formData.get("stock"),
      sku: formData.get("sku"),
      image_url: imageUrl || "/assets/product-placeholder.svg",
      image_fit: formData.get("image_fit") || "cover",
      image_position_x: formData.get("image_position_x") || "50",
      image_position_y: formData.get("image_position_y") || "50",
      image_zoom: formData.get("image_zoom") || "1",
      sizes: formData.get("sizes"),
      colors: formData.get("colors"),
      promo_type: hasDiscount ? "discount" : formData.get("promo_type"),
      promo_label: formData.get("promo_label"),
      description: formData.get("description") || "",
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

async function saveBanner(event) {
  event.preventDefault();
  const form = adminEls.bannerForm;
  if (!form) return;
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const title = String(formData.get("title") || "").trim();
  const imageFile = form.elements.imageFile?.files?.[0];
  let imageUrl = String(formData.get("image_url") || "").trim();

  if (title.length < 2) {
    setMessage(adminEls.bannerMessage, "Escribe un título corto para el banner.", true);
    form.elements.title?.focus();
    return;
  }
  if (!imageFile && !imageUrl) {
    setMessage(adminEls.bannerMessage, "Sube una imagen para el banner.", true);
    form.elements.imageFile?.focus();
    return;
  }
  if (imageFile && !["image/jpeg", "image/png", "image/webp"].includes(imageFile.type)) {
    setMessage(adminEls.bannerMessage, "Usa una imagen JPG, PNG o WebP.", true);
    return;
  }
  if (imageFile && imageFile.size > 8 * 1024 * 1024) {
    setMessage(adminEls.bannerMessage, "La imagen debe pesar máximo 8 MB.", true);
    return;
  }

  setMessage(adminEls.bannerMessage, "Guardando banner...");
  setButtonLoading(submitButton, true);
  try {
    if (imageFile) {
      const uploadForm = new FormData();
      uploadForm.append("image", imageFile);
      const uploaded = await adminApi("/api/admin/upload", {
        method: "POST",
        body: uploadForm
      });
      if (!uploaded?.url) throw new Error("No se pudo obtener la URL de la imagen.");
      imageUrl = uploaded.url;
    }

    const id = String(formData.get("id") || "").trim();
    const payload = {
      kicker: formData.get("kicker") || "Promo",
      title,
      text: formData.get("text") || "",
      link_url: formData.get("link_url") || "",
      image_url: imageUrl,
      active: form.elements.active.checked
    };
    const data = await adminApi(id ? `/api/admin/banners/${encodeURIComponent(id)}` : "/api/admin/banners", {
      method: id ? "PUT" : "POST",
      body: payload
    });
    adminState.banners = data.banners || [];
    renderBannerAdmin();
    resetBannerForm({ silent: true });
    setMessage(adminEls.bannerMessage, id ? "Banner actualizado." : "Banner creado.", false, true);
    showToast(id ? "Banner actualizado." : "Banner creado.");
  } catch (error) {
    setMessage(adminEls.bannerMessage, error.message, true);
  } finally {
    setButtonLoading(submitButton, false);
  }
}

async function toggleBannerVisibility(id) {
  const banner = adminState.banners.find((item) => item.id === id);
  if (!banner) return;
  try {
    const data = await adminApi(`/api/admin/banners/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: { ...banner, active: !banner.active }
    });
    adminState.banners = data.banners || [];
    renderBannerAdmin();
    showToast(banner.active ? "Banner oculto." : "Banner activado.");
  } catch (error) {
    showErrorToast(error);
  }
}

async function removeBanner(id) {
  const banner = adminState.banners.find((item) => item.id === id);
  if (!banner) return;
  const ok = await askConfirm({
    title: "Eliminar banner",
    message: `Se quitará "${banner.title}" de la cabecera de la tienda.`,
    actionLabel: "Eliminar"
  });
  if (!ok) return;
  try {
    const data = await adminApi(`/api/admin/banners/${encodeURIComponent(id)}`, { method: "DELETE" });
    adminState.banners = data.banners || [];
    renderBannerAdmin();
    resetBannerForm({ silent: true });
    showToast("Banner eliminado.");
  } catch (error) {
    showErrorToast(error);
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
    window.location.href = pagePath("admin-categorias");
    return;
  }
  const category = id ? adminState.categories.find((item) => item.id === id) : null;
  resetCategoryForm({ silent: true });

  if (category) {
    const form = adminEls.categoryForm;
    form.elements.id.value = category.id;
    form.elements.name.value = category.name;
    if (form.elements.description) form.elements.description.value = category.description || "";
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
      description: data.get("description") || "",
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

async function resendOrderEmail(id) {
  try {
    const data = await adminApi(`/api/admin/orders/${id}/email`, { method: "POST" });
    adminState.orders = adminState.orders.map((order) => (
      Number(order.id) === Number(id) ? data.order : order
    ));
    renderOrders();
    showToast(data.email?.ok === false ? "Correo fallido. Revisa el estado del pedido." : "Correo procesado.");
  } catch (error) {
    showErrorToast(error);
  }
}

function exportCustomers() {
  window.location.href = `${API_BASE}/api/admin/customers/export`;
}

function openDrawer(drawer, focusTarget) {
  if (!drawer) return;
  drawer.hidden = false;
  document.body.classList.add("drawer-open");
  const panel = drawer.querySelector(".drawer-panel");
  if (panel) {
    if (window.gsap) gsap.killTweensOf(panel);
    panel.style.transform = "translate3d(0, 0, 0)";
    panel.style.opacity = "1";
  }
  requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
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
  if (adminState.productValidationStarted) validateProductForm({ focus: false });
}

function currentProductImageFrame() {
  const form = adminEls.productForm;
  if (!form) return normalizedImageFrame();
  return normalizedImageFrame({
    image_fit: form.elements.image_fit?.value,
    image_position_x: form.elements.image_position_x?.value,
    image_position_y: form.elements.image_position_y?.value,
    image_zoom: form.elements.image_zoom?.value
  });
}

function setProductImageFrame(source = {}) {
  const form = adminEls.productForm;
  if (!form) return;
  const frame = normalizedImageFrame(source);
  if (form.elements.image_fit) form.elements.image_fit.value = frame.fit;
  if (form.elements.image_position_x) form.elements.image_position_x.value = String(Math.round(frame.x));
  if (form.elements.image_position_y) form.elements.image_position_y.value = String(Math.round(frame.y));
  if (form.elements.image_zoom) form.elements.image_zoom.value = String(frame.zoom);
  applyProductImageFrame();
}

function resetProductImageFrame() {
  setProductImageFrame();
}

function updateProductImageFrameReadouts(frame) {
  const form = adminEls.productForm;
  if (!form) return;
  const readouts = {
    image_zoom: `${frame.zoom.toFixed(2)}x`,
    image_position_x: `${Math.round(frame.x)}%`,
    image_position_y: `${Math.round(frame.y)}%`
  };
  Object.entries(readouts).forEach(([name, value]) => {
    const readout = form.querySelector(`[data-frame-readout="${name}"]`);
    if (readout) readout.textContent = value;
  });
}

function applyProductImageFrame() {
  const frame = currentProductImageFrame();
  updateProductImageFrameReadouts(frame);
  if (!adminEls.productImagePreview) return;
  adminEls.productImagePreview.style.objectFit = frame.fit;
  adminEls.productImagePreview.style.objectPosition = `${frame.x}% ${frame.y}%`;
  adminEls.productImagePreview.style.transform = `scale(${frame.zoom})`;
  adminEls.productImagePreview.style.transformOrigin = `${frame.x}% ${frame.y}%`;
}

function setProductPreview(src, revokeLater = false) {
  if (!adminEls.productImagePreview) return;
  adminEls.productImagePreview.src = optimizedImageUrl(src || "/assets/product-placeholder.svg", 420);
  applyProductImageFrame();
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

function pagePath(name) {
  return window.location.protocol === "file:" ? `${name}.html` : `/${name}`;
}

function isCloudinaryImage(url) {
  return /res\.cloudinary\.com\/.+\/image\/upload\//.test(url);
}

function localImagePath(value) {
  const raw = String(value || "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw, window.location.protocol === "file:" ? API_BASE : window.location.origin);
    if (!["", window.location.host, "localhost:4321", "127.0.0.1:4321"].includes(parsed.host) && parsed.origin !== window.location.origin) return "";
    const pathname = parsed.pathname;
    return pathname.startsWith("/assets/products/") || pathname.startsWith("/uploads/") ? pathname : "";
  } catch {
    const pathname = raw.split("?")[0];
    return pathname.startsWith("/assets/products/") || pathname.startsWith("/uploads/") ? pathname : "";
  }
}

function isLocalOptimizableImage(url) {
  const path = localImagePath(url);
  return Boolean(path && !path.endsWith(".svg"));
}

function optimizedImageUrl(value, width = 420) {
  const url = assetUrl(value);
  const safeWidth = Math.max(96, Math.min(1400, Number(width) || 420));
  if (!url || url.endsWith(".svg")) return url;
  if (isCloudinaryImage(url)) {
    if (url.includes("/image/upload/f_auto")) return url;
    return url.replace("/image/upload/", `/image/upload/f_auto,q_auto:good,dpr_auto,fl_progressive,c_limit,w_${safeWidth}/`);
  }
  if (isLocalOptimizableImage(url)) {
    return `${API_BASE}/api/image?src=${encodeURIComponent(localImagePath(url))}&w=${safeWidth}`;
  }
  return url;
}

function imageSrcset(value, widths = ADMIN_IMAGE_WIDTHS) {
  const url = assetUrl(value);
  if (!url || url.endsWith(".svg") || (!isCloudinaryImage(url) && !isLocalOptimizableImage(url))) return "";
  return widths.map((width) => `${optimizedImageUrl(url, width)} ${width}w`).join(", ");
}

function imageAttrs(value, options = {}) {
  const {
    width = 180,
    sizes = "68px",
    loading = "lazy",
    fetchPriority = "low",
    widths = ADMIN_IMAGE_WIDTHS
  } = options;
  const src = optimizedImageUrl(value, width);
  const srcset = imageSrcset(value, widths);
  return [
    `src="${escapeAttr(src)}"`,
    srcset ? `srcset="${escapeAttr(srcset)}"` : "",
    `sizes="${escapeAttr(sizes)}"`,
    `loading="${escapeAttr(loading)}"`,
    `decoding="async"`,
    `fetchpriority="${escapeAttr(fetchPriority)}"`
  ].filter(Boolean).join(" ");
}

function clampFrameNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizedImageFrame(source = {}) {
  return {
    fit: source.image_fit === "contain" ? "contain" : "cover",
    x: clampFrameNumber(source.image_position_x, 0, 100, 50),
    y: clampFrameNumber(source.image_position_y, 0, 100, 50),
    zoom: clampFrameNumber(source.image_zoom, 1, 1.8, 1)
  };
}

function imageFrameStyle(source = {}, options = {}) {
  const frame = normalizedImageFrame(source);
  const declarations = [
    `object-fit:${frame.fit}`,
    `object-position:${frame.x}% ${frame.y}%`,
    `transform-origin:${frame.x}% ${frame.y}%`
  ];
  if (options.includeZoom !== false) declarations.push(`transform:scale(${frame.zoom})`);
  return declarations.join(";");
}

function imageFrameAttrs(source = {}, options = {}) {
  return `style="${escapeAttr(imageFrameStyle(source, options))}"`;
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
  if (Math.abs(number) < 1) return "$0";
  if (Math.abs(number) < 10 && number % 1 !== 0) return `$${number.toFixed(1)}`;
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
