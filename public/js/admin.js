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
  settings: { shippingCost: 0 },
  emailStatus: null,
  analytics: null,
  summaries: {
    products: null,
    orders: null,
    customers: null,
    emails: null
  },
  pagination: {
    products: { page: 1, limit: 50, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
    orders: { page: 1, limit: 50, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
    customers: { page: 1, limit: 50, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
    emails: { page: 1, limit: 50, total: 0, totalPages: 1, hasNext: false, hasPrev: false }
  },
  charts: {},
  productSearch: "",
  productStatusFilter: "all",
  productCategoryFilter: "all",
  productBrandFilter: "all",
  productFilters: { categories: [], brands: [] },
  customerSearch: "",
  emailSearch: "",
  emailStatusFilter: "all",
  productOptions: {
    sizes: [],
    colors: []
  },
  pendingConfirm: null,
  productValidationStarted: false
};

const API_BASE = window.location.protocol === "file:" ? "http://localhost:4321" : "";
const ADMIN_PAGE_LIMIT = 50;
const ADMIN_IMAGE_WIDTHS = [96, 140, 180, 260];
const ADMIN_PREVIEW_WIDTHS = [260, 360, 520, 720];
const adminMoney = window.GStoreAdminMoney;
const searchDebounceTimers = {};

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
  resetBannerImageFrame: document.querySelector("#resetBannerImageFrame"),
  bannerCategorySelect: document.querySelector("#bannerCategorySelect"),
  storeSettingsForm: document.querySelector("#storeSettingsForm"),
  storeSettingsMessage: document.querySelector("#storeSettingsMessage"),
  shippingCostBadge: document.querySelector("#shippingCostBadge"),
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
  productPagination: document.querySelector("#productPagination"),
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
  ordersPagination: document.querySelector("#ordersPagination"),
  ordersNewCount: document.querySelector("#ordersNewCount"),
  ordersPendingCount: document.querySelector("#ordersPendingCount"),
  ordersDoneCount: document.querySelector("#ordersDoneCount"),
  ordersVisibleTotal: document.querySelector("#ordersVisibleTotal"),
  refreshOrdersButton: document.querySelector("#refreshOrdersButton"),
  customersList: document.querySelector("#customersList"),
  customersPagination: document.querySelector("#customersPagination"),
  customersTotal: document.querySelector("#customersTotal"),
  customersWithEmail: document.querySelector("#customersWithEmail"),
  customersOrdersTotal: document.querySelector("#customersOrdersTotal"),
  customersTotalSpent: document.querySelector("#customersTotalSpent"),
  customerSearch: document.querySelector("#customerSearch"),
  refreshCustomersButton: document.querySelector("#refreshCustomersButton"),
  exportCustomersButton: document.querySelector("#exportCustomersButton"),
  emailsTable: document.querySelector("#emailsTable"),
  emailPagination: document.querySelector("#emailPagination"),
  emailSearch: document.querySelector("#emailSearch"),
  emailStatusFilter: document.querySelector("#emailStatusFilter"),
  emailFailedCount: document.querySelector("#emailFailedCount"),
  emailPendingCount: document.querySelector("#emailPendingCount"),
  emailSentCount: document.querySelector("#emailSentCount"),
  emailTotalCount: document.querySelector("#emailTotalCount"),
  refreshEmailStatusButton: document.querySelector("#refreshEmailStatusButton"),
  emailConfigured: document.querySelector("#emailConfigured"),
  emailFrom: document.querySelector("#emailFrom"),
  emailOwner: document.querySelector("#emailOwner"),
  emailHint: document.querySelector("#emailHint"),
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
  completed: "Entregado",
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
  on(adminEls.refreshEmailStatusButton, "click", () => refreshEmailModule().catch(showErrorToast));
  on(adminEls.refreshReportsButton, "click", () => refreshAll().catch(showErrorToast));
  on(adminEls.bannerForm, "submit", saveBanner);
  on(adminEls.resetBannerForm, "click", () => resetBannerForm());
  on(adminEls.storeSettingsForm, "submit", saveStoreSettings);
  on(adminEls.bannerCategorySelect, "change", syncBannerCategoryLink);
  on(adminEls.bannerForm?.elements.imageFile, "change", previewSelectedBannerImage);
  on(adminEls.bannerForm?.elements.image_url, "input", () => {
    const value = adminEls.bannerForm.elements.image_url.value.trim();
    renderBannerPreview(value);
  });
  if (adminEls.bannerForm) {
    ["image_fit", "image_zoom", "image_position_x", "image_position_y"].forEach((name) => {
      const field = adminEls.bannerForm.elements[name];
      if (!field) return;
      on(field, "input", applyBannerImageFrame);
      on(field, "change", applyBannerImageFrame);
    });
  }
  on(adminEls.resetBannerImageFrame, "click", resetBannerImageFrame);
  adminEls.storeSettingsForm?.querySelectorAll("[data-money-input]").forEach((field) => {
    on(field, "input", () => {
      if (adminMoney) field.value = adminMoney.normalizeMoneyTypingValue(field.value);
    });
    on(field, "blur", () => adminMoney?.normalizeMoneyField(field));
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
    adminState.pagination.products.page = 1;
    debounceAdminRefresh("products", () => refreshProducts().catch(showErrorToast));
  });
  on(adminEls.productStatusFilter, "change", (event) => {
    adminState.productStatusFilter = event.target.value;
    adminState.pagination.products.page = 1;
    refreshProducts().catch(showErrorToast);
  });
  on(adminEls.productCategoryFilter, "change", (event) => {
    adminState.productCategoryFilter = event.target.value;
    adminState.pagination.products.page = 1;
    refreshProducts().catch(showErrorToast);
  });
  on(adminEls.productBrandFilter, "change", (event) => {
    adminState.productBrandFilter = event.target.value;
    adminState.pagination.products.page = 1;
    refreshProducts().catch(showErrorToast);
  });
  on(adminEls.customerSearch, "input", (event) => {
    adminState.customerSearch = event.target.value.trim().toLowerCase();
    adminState.pagination.customers.page = 1;
    debounceAdminRefresh("customers", () => refreshCustomers(false).catch(showErrorToast));
  });
  on(adminEls.emailSearch, "input", (event) => {
    adminState.emailSearch = event.target.value.trim().toLowerCase();
    adminState.pagination.emails.page = 1;
    debounceAdminRefresh("emails", () => refreshEmailModule().catch(showErrorToast));
  });
  on(adminEls.emailStatusFilter, "change", (event) => {
    adminState.emailStatusFilter = event.target.value;
    adminState.pagination.emails.page = 1;
    refreshEmailModule().catch(showErrorToast);
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
    adminEls.productForm.querySelectorAll("[data-money-input]").forEach((field) => {
      on(field, "input", () => {
        const nextValue = normalizeMoneyTypingValue(field.value);
        if (field.value !== nextValue) field.value = nextValue;
        renderDiscountSummary();
      });
      on(field, "blur", () => {
        normalizeMoneyField(field);
        renderDiscountSummary();
        if (adminState.productValidationStarted) validateProductForm({ focus: false });
      });
    });
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
  const pageButton = event.target.closest("[data-admin-pagination]");
  if (pageButton) {
    changeAdminPage(pageButton.dataset.adminPagination, pageButton.dataset.pageDirection);
    return;
  }

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
    event.preventDefault();
    event.stopPropagation();
    openOrderWhatsapp(Number(whatsappOrder.dataset.orderWhatsapp));
    return;
  }

  const printOrderLabelButton = event.target.closest("[data-order-print-label]");
  if (printOrderLabelButton) {
    event.preventDefault();
    event.stopPropagation();
    printOrderLabel(Number(printOrderLabelButton.dataset.orderPrintLabel));
    return;
  }

  const emailOrder = event.target.closest("[data-order-email]");
  if (emailOrder) {
    event.preventDefault();
    event.stopPropagation();
    resendOrderEmail(Number(emailOrder.dataset.orderEmail));
    return;
  }

  const nextOrderStatus = event.target.closest("[data-order-next-status]");
  if (nextOrderStatus) {
    event.preventDefault();
    event.stopPropagation();
    updateOrderStatus(Number(nextOrderStatus.dataset.orderId), nextOrderStatus.dataset.orderNextStatus);
  }
}

function debounceAdminRefresh(key, callback, delay = 260) {
  window.clearTimeout(searchDebounceTimers[key]);
  searchDebounceTimers[key] = window.setTimeout(callback, delay);
}

function changeAdminPage(kind, direction) {
  const meta = adminState.pagination[kind];
  if (!meta) return;
  const delta = direction === "next" ? 1 : -1;
  const nextPage = Math.max(1, Math.min(Number(meta.totalPages || 1), Number(meta.page || 1) + delta));
  if (nextPage === meta.page) return;
  meta.page = nextPage;
  const refreshers = {
    products: refreshProducts,
    orders: refreshOrders,
    customers: () => refreshCustomers(false),
    emails: refreshEmailModule
  };
  refreshers[kind]?.().catch(showErrorToast);
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
  if (adminState.page === "dashboard") {
    tasks.push(refreshBanners());
    tasks.push(refreshStoreSettings());
  }
  if (["dashboard", "products", "categories"].includes(adminState.page)) tasks.push(refreshCategories());
  if (["dashboard", "products"].includes(adminState.page)) tasks.push(refreshProducts());
  if (["dashboard", "reports", "orders"].includes(adminState.page)) tasks.push(refreshOrders(false));
  if (adminState.page === "customers") tasks.push(refreshCustomers(false));
  if (adminState.page === "emails") tasks.push(refreshEmailModule());
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
  renderProductFilterOptions();
  renderCategories();
  renderInsights();
}

async function refreshProducts() {
  const page = adminState.pagination.products.page || 1;
  const data = await adminApi(buildAdminUrl("/api/admin/products", {
    page,
    limit: ADMIN_PAGE_LIMIT,
    q: adminState.productSearch,
    status: adminState.productStatusFilter,
    category: adminState.productCategoryFilter,
    brand: adminState.productBrandFilter
  }));
  adminState.products = data.products || [];
  adminState.pagination.products = normalizePagination(data.pagination, page);
  adminState.summaries.products = data.summary || null;
  adminState.productFilters = data.filters || adminState.productFilters || { categories: [], brands: [] };
  renderProductFilterOptions();
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

async function refreshStoreSettings() {
  if (adminState.page !== "dashboard" || !adminEls.storeSettingsForm) return;
  const data = await adminApi("/api/admin/store-settings");
  adminState.settings.shippingCost = Number(data.shippingCost || 0);
  renderStoreSettings();
}

async function refreshOrders(updateSummary = true) {
  const page = adminState.pagination.orders.page || 1;
  const data = await adminApi(buildAdminUrl("/api/admin/orders", {
    page,
    limit: ADMIN_PAGE_LIMIT
  }));
  adminState.orders = data.orders || [];
  adminState.pagination.orders = normalizePagination(data.pagination, page);
  adminState.summaries.orders = data.summary || null;
  renderOrders();
  renderInsights();
  if (updateSummary) await refreshSummary();
}

async function refreshCustomers(updateSummary = true) {
  const page = adminState.pagination.customers.page || 1;
  const data = await adminApi(buildAdminUrl("/api/admin/customers", {
    page,
    limit: ADMIN_PAGE_LIMIT,
    q: adminState.customerSearch
  }));
  adminState.customers = data.customers || [];
  adminState.pagination.customers = normalizePagination(data.pagination, page);
  adminState.summaries.customers = data.summary || null;
  renderCustomers();
  if (updateSummary) renderCustomersOverview();
}

async function refreshEmailStatus() {
  const data = await adminApi("/api/admin/email/status");
  adminState.emailStatus = data;
  renderEmailStatus();
}

async function refreshEmailModule() {
  const page = adminState.pagination.emails.page || 1;
  const [ordersData] = await Promise.all([
    adminApi(buildAdminUrl("/api/admin/email/orders", {
      page,
      limit: ADMIN_PAGE_LIMIT,
      q: adminState.emailSearch,
      status: adminState.emailStatusFilter
    })),
    refreshEmailStatus()
  ]);
  adminState.orders = ordersData.orders || [];
  adminState.pagination.emails = normalizePagination(ordersData.pagination, page);
  adminState.summaries.emails = ordersData.summary || null;
  renderEmailModule();
}

function renderInsights() {
  const activeCategories = adminState.categories.filter((category) => category.active).length;
  const lowStock = adminState.products.filter((product) => Number(product.stock || 0) <= 2);
  const productSummary = adminState.summaries.products || {};
  const lowStockCount = Number(productSummary.lowStock ?? lowStock.length);
  const featured = adminState.products.filter((product) => product.featured).length;
  const latestOrder = adminState.orders[0];
  const lowStockText = lowStockCount
    ? `${lowStockCount} producto${lowStockCount === 1 ? "" : "s"} con 2 unidades o menos${lowStock.length ? `: ${lowStock.slice(0, 3).map((product) => product.name).join(", ")}` : ""}.`
    : "Sin productos críticos. El inventario está tranquilo.";

  setText(adminEls.insightLowStock, lowStockText);
  setText(adminEls.summaryLowStock, lowStockCount);
  setText(
    adminEls.stockActionText,
    lowStock.length
      ? `${lowStock.slice(0, 2).map((product) => product.name).join(", ")}`
      : "Inventario bajo control"
  );

  setText(adminEls.insightActiveCategories, `${activeCategories} activa${activeCategories === 1 ? "" : "s"} de ${adminState.categories.length || 0}. ${featured} producto${featured === 1 ? "" : "s"} destacado${featured === 1 ? "" : "s"}.`);

  if (latestOrder) {
    setText(adminEls.insightLatestOrderTitle, orderDisplayTitle(latestOrder));
    setText(adminEls.insightLatestOrder, `${latestOrder.customer_name}, ${formatCurrency(latestOrder.total)}, ${statusLabels[latestOrder.status] || latestOrder.status}.`);
  } else {
    setText(adminEls.insightLatestOrderTitle, "Sin pedidos aún");
    setText(adminEls.insightLatestOrder, "Cuando entre una orden aparecerá aquí.");
  }

  setText(adminEls.sidebarStatus, lowStockCount ? `${lowStockCount} stock bajo` : "Lista");
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
      ? `${orderCount} pedido${orderCount === 1 ? "" : "s"} activo${orderCount === 1 ? "" : "s"}, ${formatCurrency(profit)} de ganancia estimada y ${formatPercent(margin)} de margen.`
      : "Aún no hay pedidos activos. Cuando entren ventas, este panel mostrará utilidad, margen y movimiento."
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
        <strong>${escapeHtml(orderDisplayTitle(order))}</strong>
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
  if (adminEls.productCategorySelect) {
    adminEls.productCategorySelect.innerHTML = [
      `<option value="">Sin categoría</option>`,
      ...adminState.categories.map((category) => (
        `<option value="${category.id}">${escapeHtml(category.name)}${category.active ? "" : " (inactiva)"}</option>`
      ))
    ].join("");
  }
  renderBannerCategorySelect();
}

function renderBannerCategorySelect(selectedSlug = "") {
  if (!adminEls.bannerCategorySelect) return;
  const current = selectedSlug || adminEls.bannerCategorySelect.value || "";
  adminEls.bannerCategorySelect.innerHTML = [
    `<option value="">Sin categoría fija</option>`,
    ...adminState.categories
      .filter((category) => category.active)
      .map((category) => (
        `<option value="${escapeAttr(category.slug)}">${escapeHtml(category.name)}</option>`
      ))
  ].join("");
  adminEls.bannerCategorySelect.value = adminState.categories.some((category) => category.slug === current) ? current : "";
}

function syncBannerCategoryLink() {
  const form = adminEls.bannerForm;
  if (!form?.elements.link_url || !form.elements.category_slug) return;
  const slug = form.elements.category_slug.value;
  const current = String(form.elements.link_url.value || "").trim();
  if (!slug) {
    if (current.startsWith("#categoria-")) form.elements.link_url.value = "";
    return;
  }
  if (!current || current.startsWith("#categoria-")) {
    form.elements.link_url.value = `#categoria-${slug}`;
  }
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

function renderStoreSettings() {
  const amount = Number(adminState.settings?.shippingCost || 0);
  if (adminEls.storeSettingsForm?.elements.shipping_cost) {
    adminEls.storeSettingsForm.elements.shipping_cost.value = amount.toFixed(2);
  }
  setText(adminEls.shippingCostBadge, `${formatCurrency(amount)} envío`);
}

function renderProductFilterOptions() {
  const filters = adminState.productFilters || {};
  const categories = filters.categories?.length ? filters.categories : adminState.categories;
  if (adminEls.productCategoryFilter) {
    const selected = adminState.productCategoryFilter || "all";
    const options = categories
      .filter((category) => category?.slug)
      .map((category) => {
        const count = Number(category.product_count || 0);
        const countText = count ? ` (${count})` : "";
        return `<option value="${escapeAttr(category.slug)}">${escapeHtml(category.name)}${countText}</option>`;
      });
    adminEls.productCategoryFilter.innerHTML = [
      `<option value="all">Todas las categorías</option>`,
      ...options
    ].join("");
    adminEls.productCategoryFilter.value = selected;
    if (adminEls.productCategoryFilter.value !== selected) {
      adminState.productCategoryFilter = "all";
      adminEls.productCategoryFilter.value = "all";
    }
  }
  if (adminEls.productBrandFilter) {
    const selected = adminState.productBrandFilter || "all";
    const brands = filters.brands || [];
    adminEls.productBrandFilter.innerHTML = [
      `<option value="all">Todas las marcas</option>`,
      ...brands.map((brand) => {
        const count = Number(brand.count || 0);
        const countText = count ? ` (${count})` : "";
        return `<option value="${escapeAttr(brand.name)}">${escapeHtml(brand.name)}${countText}</option>`;
      })
    ].join("");
    adminEls.productBrandFilter.value = selected;
    if (adminEls.productBrandFilter.value !== selected) {
      adminState.productBrandFilter = "all";
      adminEls.productBrandFilter.value = "all";
    }
  }
}

function renderProductShelfNotes() {
  if (!adminEls.productShelfNotes) return;
  const summary = adminState.summaries.products || {};
  const lowStock = Number(summary.lowStock ?? adminState.products.filter((product) => Number(product.stock || 0) > 0 && Number(product.stock || 0) <= 2).length);
  const outOfStock = Number(summary.outOfStock ?? adminState.products.filter((product) => Number(product.stock || 0) <= 0).length);
  const hidden = Number(summary.hidden ?? adminState.products.filter((product) => !product.active).length);
  const promos = Number(summary.promos ?? adminState.products.filter((product) => (product.promo_type || "none") !== "none" || product.promo_label).length);
  const active = Number(summary.active ?? adminState.products.filter((product) => product.active).length);
  const total = Number(summary.total ?? adminState.pagination.products.total ?? adminState.products.length);
  adminEls.productShelfNotes.innerHTML = `
    <div class="inventory-summary-grid" aria-label="Totales de inventario">
      ${inventorySummaryCard("Registrados", total, `${active} activos`)}
      ${inventorySummaryCard("Sin stock", outOfStock, "No salen en catálogo", outOfStock ? "is-warning" : "")}
      ${inventorySummaryCard("Stock bajo", lowStock, "Reponer pronto", lowStock ? "is-warning" : "")}
      ${inventorySummaryCard("Con promo", promos, "Ofertas activas")}
      ${inventorySummaryCard("Ocultos", hidden, "Solo admin", hidden ? "is-muted" : "")}
    </div>
  `;
}

function inventorySummaryCard(label, value, detail = "", className = "") {
  return `
    <article class="inventory-summary-card ${className}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </article>
  `;
}

function productStockAdminNote(product) {
  const stock = Number(product.stock || 0);
  if (stock <= 0) return "No hay este artículo en stock";
  if (stock <= 2) return "Stock bajo";
  return "Disponible";
}

function renderProductsTable() {
  if (!adminEls.productsTable) return;
  const products = adminState.products || [];
  adminEls.productsTable.innerHTML = products.length ? `
    <div class="product-list-head" aria-hidden="true">
      <span>Producto</span>
      <span>Categoría / marca</span>
      <span>Precio</span>
      <span>Ganancia</span>
      <span>Stock</span>
      <span>Acciones</span>
    </div>
    ${products.map(renderProductListRow).join("")}
  ` : emptyAdminState("No hay productos para este filtro.", "Ajusta la búsqueda o agrega una pieza nueva.");
  renderAdminPagination("products", adminEls.productPagination);
}

function renderProductListRow(product) {
  const stock = Number(product.stock || 0);
  const hasDiscount = Number(product.compare_price || 0) > Number(product.price || 0);
  const profit = productProfitAmount(product);
  const brand = cleanProductBrand(product);
  const variants = [...(product.sizes || []), ...(product.colors || [])].filter(Boolean).slice(0, 3);
  const stockClass = stock <= 0 ? "is-critical" : stock <= 2 ? "is-warning" : "";
  const rowClass = [
    product.active ? "" : "is-hidden-product",
    stock <= 0 ? "is-out-product" : ""
  ].filter(Boolean).join(" ");
  return `
    <article class="product-list-row ${rowClass}">
      <div class="product-list-main">
        <img ${imageAttrs(product.image_url, { width: 180, sizes: "(max-width: 760px) 72px, 74px" })} ${imageFrameAttrs(product, { includeZoom: false })} alt="${escapeAttr(product.name)}">
        <div>
          <strong>${escapeHtml(product.name)}</strong>
          <span>${escapeHtml(product.sku || "Sin SKU")}</span>
          ${variants.length ? `<div class="product-row-variants">${variants.map((item) => `<small>${escapeHtml(item)}</small>`).join("")}</div>` : ""}
        </div>
      </div>
      <div class="product-list-cell product-list-taxonomy">
        <small>Categoría</small>
        <strong>${escapeHtml(product.category?.name || "Sin categoría")}</strong>
        ${brand ? `<span>${escapeHtml(brand)}</span>` : `<span>Sin marca registrada</span>`}
      </div>
      <div class="product-list-cell">
        <small>Venta</small>
        <strong>${formatCurrency(product.price)}</strong>
        ${hasDiscount ? `<span>Antes ${formatCurrency(product.compare_price)}</span>` : ""}
      </div>
      <div class="product-list-cell ${profit < 0 ? "is-negative" : "is-profit"}">
        <small>Ganancia</small>
        <strong>${Number(product.cost_price || 0) > 0 ? formatCurrency(profit) : "-"}</strong>
        <span>${Number(product.cost_price || 0) > 0 ? `${productMarginPercent(product)}% margen` : "Sin costo privado"}</span>
      </div>
      <div class="product-list-cell ${stockClass}">
        <small>Stock</small>
        <strong>${stock}</strong>
        <span>${escapeHtml(productStockAdminNote(product))}</span>
      </div>
      <div class="product-list-status">
        <div class="status-stack">
          <span class="status-pill ${product.active ? "" : "off"}">${product.active ? "Activo" : "Oculto"}</span>
          ${stock <= 0 ? `<span class="status-pill off">Sin stock</span>` : ""}
          ${productPromoAdmin(product)}
        </div>
        <span class="product-admin-private">${productCostAdmin(product)}</span>
        <div class="row-actions product-list-actions">
          <button class="small-button" data-edit-product="${product.id}" type="button">Editar</button>
          <button class="small-button danger" data-delete-product="${product.id}" type="button">Eliminar</button>
        </div>
      </div>
    </article>
  `;
}

function cleanProductBrand(product) {
  return String(product.brand || "").trim();
}

function renderAdminPagination(kind, container) {
  if (!container) return;
  const meta = adminState.pagination[kind] || {};
  const total = Number(meta.total || 0);
  if (!total) {
    container.innerHTML = "";
    return;
  }
  const limit = Number(meta.limit || ADMIN_PAGE_LIMIT);
  const page = Number(meta.page || 1);
  const start = (page - 1) * limit + 1;
  const end = Math.min(total, start + limit - 1);
  container.innerHTML = `
    <span>Mostrando ${start}-${end} de ${total}</span>
    <div>
      <button class="small-button" data-admin-pagination="${kind}" data-page-direction="prev" type="button" ${meta.hasPrev ? "" : "disabled"}>Anterior</button>
      <strong>Página ${page} de ${Number(meta.totalPages || 1)}</strong>
      <button class="small-button" data-admin-pagination="${kind}" data-page-direction="next" type="button" ${meta.hasNext ? "" : "disabled"}>Siguiente</button>
    </div>
  `;
}

function productMetricCard(label, value, detail = "", className = "") {
  return `
    <div class="product-metric-card ${className}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </div>
  `;
}

function renderBannerAdmin() {
  if (!adminEls.bannerAdminList) return;
  const activeCount = adminState.banners.filter((banner) => banner.active).length;
  setText(adminEls.bannerCountText, `${activeCount} activo${activeCount === 1 ? "" : "s"}`);

  adminEls.bannerAdminList.innerHTML = adminState.banners.map((banner) => `
    <article class="banner-admin-card ${banner.active ? "" : "is-hidden-banner"}">
      <img ${imageAttrs(banner.image_url, { width: 520, widths: ADMIN_PREVIEW_WIDTHS, sizes: "(max-width: 760px) 100vw, 320px" })} ${imageFrameAttrs(banner)} alt="${escapeAttr(banner.title)}">
      <div class="banner-admin-card-copy">
        <span>${escapeHtml(banner.kicker || "Promo")}</span>
        <strong>${escapeHtml(banner.title)}</strong>
        <small>${escapeHtml(banner.text || (banner.active ? "Visible en la tienda." : "Oculto de la tienda."))}</small>
        ${banner.category_slug ? `<small>Destino: ${escapeHtml(categoryNameBySlug(banner.category_slug))}</small>` : ""}
      </div>
      <div class="row-actions">
        <button class="small-button" data-edit-banner="${escapeAttr(banner.id)}" type="button">Editar</button>
        <button class="small-button" data-toggle-banner="${escapeAttr(banner.id)}" type="button">${banner.active ? "Ocultar" : "Activar"}</button>
        <button class="small-button danger" data-delete-banner="${escapeAttr(banner.id)}" type="button">Eliminar</button>
      </div>
    </article>
  `).join("") || emptyAdminState("No hay banners todavía.", "Sube una imagen y se verá en la cabecera de la tienda.");
}

function categoryNameBySlug(slug) {
  const category = adminState.categories.find((item) => item.slug === slug);
  return category?.name || slug;
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
  if (form.elements.category_slug) form.elements.category_slug.value = banner.category_slug || "";
  form.elements.image_url.value = banner.image_url || "";
  form.elements.active.checked = Boolean(banner.active);
  setBannerImageFrame(banner);
  renderBannerCategorySelect(banner.category_slug || "");
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
  if (form.elements.category_slug) form.elements.category_slug.value = "";
  setBannerImageFrame();
  renderBannerCategorySelect();
  renderBannerPreview("");
  if (!options.silent) setMessage(adminEls.bannerMessage, "");
}

function renderBannerPreview(src, banner = {}) {
  if (!adminEls.bannerPreview) return;
  const imageUrl = src || banner.image_url || "";
  if (!imageUrl) {
    adminEls.bannerPreview.innerHTML = "<span>Vista previa del banner</span>";
    return;
  }
  const frameSource = Object.keys(banner).length ? banner : currentBannerImageFrame();
  adminEls.bannerPreview.innerHTML = `
    <img ${imageAttrs(imageUrl, { width: 720, widths: ADMIN_PREVIEW_WIDTHS, sizes: "360px", loading: "eager", fetchPriority: "high" })} ${imageFrameAttrs(frameSource)} alt="${escapeAttr(banner.title || "Banner de tienda")}">
    <div>
      <span>${escapeHtml(banner.kicker || "Promo")}</span>
      <strong>${escapeHtml(banner.title || "Banner de tienda")}</strong>
    </div>
  `;
}

function previewSelectedBannerImage() {
  const file = adminEls.bannerForm?.elements.imageFile.files[0];
  if (!file) return;
  const objectUrl = URL.createObjectURL(file);
  setBannerImageFrame();
  renderBannerPreview(objectUrl, {
    kicker: adminEls.bannerForm.elements.kicker.value,
    title: adminEls.bannerForm.elements.title.value,
    ...currentBannerImageFrame()
  });
  const img = adminEls.bannerPreview?.querySelector("img");
  if (img) img.onload = () => URL.revokeObjectURL(objectUrl);
}

function currentBannerImageFrame() {
  const form = adminEls.bannerForm;
  if (!form) return normalizedImageFrame();
  return normalizedImageFrame({
    image_fit: form.elements.image_fit?.value,
    image_position_x: form.elements.image_position_x?.value,
    image_position_y: form.elements.image_position_y?.value,
    image_zoom: form.elements.image_zoom?.value
  });
}

function setBannerImageFrame(source = {}) {
  const form = adminEls.bannerForm;
  if (!form) return;
  const frame = normalizedImageFrame(source);
  if (form.elements.image_fit) form.elements.image_fit.value = frame.fit;
  if (form.elements.image_position_x) form.elements.image_position_x.value = String(Math.round(frame.x));
  if (form.elements.image_position_y) form.elements.image_position_y.value = String(Math.round(frame.y));
  if (form.elements.image_zoom) form.elements.image_zoom.value = String(frame.zoom);
  applyBannerImageFrame();
}

function resetBannerImageFrame() {
  setBannerImageFrame();
}

function updateBannerImageFrameReadouts(frame) {
  const form = adminEls.bannerForm;
  if (!form) return;
  const readouts = {
    image_zoom: `${frame.zoom.toFixed(2)}x`,
    image_position_x: `${Math.round(frame.x)}%`,
    image_position_y: `${Math.round(frame.y)}%`
  };
  Object.entries(readouts).forEach(([name, value]) => {
    const readout = form.querySelector(`[data-banner-frame-readout="${name}"]`);
    if (readout) readout.textContent = value;
  });
}

function applyBannerImageFrame() {
  const frame = currentBannerImageFrame();
  updateBannerImageFrameReadouts(frame);
  const img = adminEls.bannerPreview?.querySelector("img");
  if (!img) return;
  img.style.objectFit = frame.fit;
  img.style.objectPosition = `${frame.x}% ${frame.y}%`;
  img.style.transform = `scale(${frame.zoom})`;
  img.style.transformOrigin = `${frame.x}% ${frame.y}%`;
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
      (filter === "low" && Number(product.stock || 0) > 0 && Number(product.stock || 0) <= 2) ||
      (filter === "out" && Number(product.stock || 0) <= 0) ||
      (filter === "promo" && ((product.promo_type || "none") !== "none" || product.promo_label || Number(product.compare_price || 0) > Number(product.price || 0)));
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

function productProfitAmount(product) {
  return Number(product.price || 0) - Number(product.cost_price || 0);
}

function productMarginPercent(product) {
  const price = Number(product.price || 0);
  const cost = Number(product.cost_price || 0);
  if (price <= 0 || cost <= 0) return 0;
  return Math.round(((price - cost) / price) * 100);
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
  const orders = adminState.orders || [];
  adminEls.ordersList.innerHTML = orders.length
    ? groupOrdersByDay(orders).map(renderOrdersDayGroup).join("")
    : emptyAdminState("Todavía no hay pedidos.", "Cuando una clienta complete checkout, la orden aparecerá aquí.");
}

function renderOrdersOverview() {
  renderAdminPagination("orders", adminEls.ordersPagination);
  const orders = adminState.orders || [];
  const summary = adminState.summaries.orders || {};
  const newCount = Number(summary.newCount ?? orders.filter((order) => order.status === "new").length);
  const pendingCount = Number(summary.pendingCount ?? orders.filter((order) => ["new", "waiting_payment", "paid", "preparing", "ready", "sent"].includes(order.status)).length);
  const doneCount = Number(summary.doneCount ?? orders.filter((order) => ["completed", "cancelled"].includes(order.status)).length);
  const visibleTotal = summary.visibleTotal ?? orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  setText(adminEls.ordersNewCount, newCount);
  setText(adminEls.ordersPendingCount, pendingCount);
  setText(adminEls.ordersDoneCount, doneCount);
  setText(adminEls.ordersVisibleTotal, formatCurrency(visibleTotal));
}

function groupOrdersByDay(orders) {
  const groups = [];
  const index = new Map();
  orders.forEach((order) => {
    const key = orderDateKey(order.created_at);
    if (!index.has(key)) {
      const group = {
        key,
        label: orderDateGroupLabel(order.created_at),
        orders: [],
        total: 0
      };
      index.set(key, group);
      groups.push(group);
    }
    const group = index.get(key);
    group.orders.push(order);
    group.total += Number(order.total || 0);
  });
  return groups;
}

function renderOrdersDayGroup(group) {
  const count = group.orders.length;
  return `
    <section class="orders-day-group" aria-label="${escapeAttr(group.label)}">
      <div class="orders-day-heading">
        <strong>${escapeHtml(group.label)}</strong>
        <span>${count} pedido${count === 1 ? "" : "s"} · ${formatCurrency(group.total)} total</span>
      </div>
      <div class="orders-day-list">
        ${group.orders.map(renderOrderCard).join("")}
      </div>
    </section>
  `;
}

function renderOrderCard(order) {
  const nextAction = orderNextAction(order);
  const finalState = orderFinalState(order);
  const items = Array.isArray(order.items) ? order.items : [];
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const primaryItem = items[0]?.name || "Sin productos";
  const extraItems = items.length > 1 ? ` + ${items.length - 1} más` : "";
  const address = [order.customer_city, order.customer_address].filter(Boolean).join(" · ") || "Sin dirección adicional";
  const payment = paymentLabel(order.payment_method, order.payment_status);
  const clientName = order.customer_name || "Cliente sin nombre";
  const clientPhone = order.customer_phone || "Sin teléfono";
  const productSummary = `${itemCount} unidad${itemCount === 1 ? "" : "es"} · ${primaryItem}${extraItems}`;
  const paymentStateLabel = order.payment_status === "paid" ? "Pago confirmado" : "Pago pendiente";
  const orderTitle = orderDisplayTitle(order);
  return `
    <details class="order-card order-status-${escapeAttr(order.status || "new")}">
      <summary class="order-summary">
        <div class="order-summary-main">
          <div class="order-code-block">
            <h3>${escapeHtml(orderTitle)}</h3>
            <span>${escapeHtml(orderTimeLabel(order.created_at))}</span>
            <small>${escapeHtml(address)}</small>
          </div>
          <div class="order-snapshot">
            <div class="order-summary-badges">
              ${renderOrderBadge("Estado", statusLabels[order.status] || order.status, orderStatusClass(order.status))}
              ${renderOrderBadge("Entrega", orderDeliveryShortLabel(order), "")}
              ${renderOrderBadge("Pago", paymentStateLabel, order.payment_status === "paid" ? "success" : "warning")}
            </div>
            <p><strong>${escapeHtml(clientName)}</strong><span>${escapeHtml(clientPhone)}</span></p>
            <small>${escapeHtml(productSummary)}</small>
          </div>
        </div>
        <div class="order-summary-total">
          <small>Total</small>
          <strong>${formatCurrency(order.total)}</strong>
        </div>
      </summary>

      <div class="order-detail-body">
        <div class="order-detail-layout">
          <div class="order-detail-main">
            <div class="order-items-panel">
              <div class="order-items-heading">
                <span>Productos</span>
                <strong>${itemCount} unidad${itemCount === 1 ? "" : "es"}</strong>
              </div>
              <div class="order-items-list">
                ${items.map((item) => renderOrderItem(item)).join("")}
              </div>
              ${renderOrderTotals(order)}
            </div>

            ${order.notes ? `
              <div class="order-note">
                <span>Nota del pedido</span>
                <p>${escapeHtml(order.notes)}</p>
              </div>
            ` : ""}
          </div>

          <div class="order-detail-side">
            <div class="order-info-card">
              <span>Datos del cliente</span>
              <strong>${escapeHtml(order.customer_name || "Cliente sin nombre")}</strong>
              <small>${escapeHtml(order.customer_phone || "Sin teléfono")}</small>
              <small>${escapeHtml(order.customer_email || "Sin correo registrado")}</small>
            </div>
            <div class="order-info-card">
              <span>Entrega</span>
              <strong>${escapeHtml(orderDeliveryLabel(order))}</strong>
              <small>${escapeHtml(address)}</small>
            </div>
            <div class="order-info-card">
              <span>Pago</span>
              <strong>${escapeHtml(payment)}</strong>
              <small>${escapeHtml(order.payment_status === "paid" ? "Pago confirmado" : "Pendiente de confirmación")}</small>
            </div>
            <div class="order-next-step">
              <span>Siguiente paso</span>
              <strong>${escapeHtml(nextAction.text)}</strong>
            </div>
          </div>
        </div>

        ${finalState ? renderOrderFinalState(finalState) : ""}
        <div class="order-actions ${finalState ? "is-final" : ""}">
          ${finalState ? "" : `
            <label class="order-status-control">
              Estado del pedido
              <select data-order-status="${order.id}">
                ${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${order.status === value ? "selected" : ""}>${label}</option>`).join("")}
              </select>
            </label>
          `}
          <div class="order-action-buttons">
            ${nextAction.status ? `<button class="button ghost" data-order-id="${order.id}" data-order-next-status="${escapeAttr(nextAction.status)}" type="button">${escapeHtml(nextAction.label)}</button>` : ""}
            <button class="button primary" data-order-whatsapp="${order.id}" type="button">Mensaje al cliente</button>
            <button class="button ghost" data-order-print-label="${order.id}" type="button">Imprimir etiqueta</button>
          </div>
        </div>
      </div>
    </details>
  `;
}

function orderDisplayTitle(order) {
  const code = String(order?.order_code || "").trim();
  return code ? `#${code}` : "#";
}

function renderOrderBadge(label, value, className = "") {
  return `
    <span class="order-badge ${className ? `order-badge-${escapeAttr(className)}` : ""}">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value)}</strong>
    </span>
  `;
}

function renderOrderTotals(order) {
  return `
    <div class="order-total-breakdown">
      <div><span>Subtotal</span><strong>${formatCurrency(order.subtotal)}</strong></div>
      <div><span>Envío</span><strong>${formatCurrency(order.shipping)}</strong></div>
      <div class="is-total"><span>Total</span><strong>${formatCurrency(order.total)}</strong></div>
    </div>
  `;
}

function orderFinalState(order) {
  if (order.status === "completed") {
    return {
      className: "completed",
      label: "Estado definitivo",
      title: "Pedido entregado",
      detail: "Cerrado. Ya no se edita ni cambia de estado."
    };
  }
  if (order.status === "cancelled") {
    return {
      className: "cancelled",
      label: "Estado definitivo",
      title: "Pedido cancelado",
      detail: order.stock_restored_at
        ? "Stock devuelto al catálogo."
        : "Cerrado. No había stock reservado por devolver."
    };
  }
  return null;
}

function renderOrderFinalState(state) {
  return `
    <div class="order-final-state order-final-state-${escapeAttr(state.className)}">
      <span>${escapeHtml(state.label)}</span>
      <strong>${escapeHtml(state.title)}</strong>
      <small>${escapeHtml(state.detail)}</small>
    </div>
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

function orderDeliveryShortLabel(order) {
  return order.delivery_method === "pickup" ? "Retiro" : "Domicilio";
}

function orderStatusClass(status) {
  if (status === "cancelled") return "danger";
  if (["completed", "sent", "ready"].includes(status)) return "success";
  if (["waiting_payment", "paid", "preparing"].includes(status)) return "warning";
  return "";
}

function orderNextAction(order) {
  const delivery = order.delivery_method === "pickup" ? "retiro" : "envío";
  const map = {
    new: { status: "preparing", label: "Confirmar y preparar", text: `Contactar al cliente, confirmar datos y preparar el ${delivery}.` },
    waiting_payment: { status: "paid", label: "Marcar pagado", text: "Revisar el pago antes de preparar." },
    paid: { status: "preparing", label: "Preparar pedido", text: `Preparar productos para ${delivery}.` },
    preparing: { status: "ready", label: "Marcar listo", text: "Dejar el pedido listo para entrega." },
    ready: { status: order.delivery_method === "pickup" ? "completed" : "sent", label: order.delivery_method === "pickup" ? "Completar retiro" : "Marcar enviado", text: order.delivery_method === "pickup" ? "Coordinar retiro y cerrar el pedido." : "Enviar o coordinar entrega." },
    sent: { status: "completed", label: "Marcar entregado", text: "Confirmar entrega y cerrar el pedido." },
    completed: { status: "", label: "", text: "Pedido entregado y cerrado. No se puede cambiar." },
    cancelled: { status: "", label: "", text: "Pedido cancelado. El stock vuelve al catálogo." }
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
    form.elements.category_id.value = product.category?.id || "";
    form.elements.price.value = formatMoneyInput(product.price);
    form.elements.cost_price.value = product.cost_price ? formatMoneyInput(product.cost_price) : "";
    form.elements.compare_price.value = product.compare_price ? formatMoneyInput(product.compare_price) : "";
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
  const comparePrice = parseMoneyInput(form.elements.compare_price?.value);
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

  const comparePrice = parseMoneyInput(form.elements.compare_price?.value);
  const salePrice = parseMoneyInput(form.elements.price?.value);
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
  const compare = parseMoneyInput(comparePrice);
  const sale = parseMoneyInput(salePrice);
  if (!compare || !sale || compare <= sale) return 0;
  return Math.round(((compare - sale) / compare) * 100);
}

function formatMoneyInput(value) {
  return adminMoney.formatMoneyInput(value);
}

function normalizeLocalizedDecimalString(value) {
  return adminMoney.normalizeLocalizedDecimalString(value);
}

function normalizeMoneyTypingValue(value) {
  return adminMoney.normalizeMoneyTypingValue(value);
}

function parseMoneyInput(value) {
  return adminMoney.parseMoneyInput(value);
}

function normalizeMoneyField(field) {
  adminMoney.normalizeMoneyField(field);
}

function normalizeMoneyFields() {
  adminEls.productForm?.querySelectorAll("[data-money-input]").forEach(normalizeMoneyField);
}

function moneyPayloadValue(value) {
  return adminMoney.moneyPayloadValue(value);
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
  const salePrice = parseMoneyInput(priceRaw);
  const costPrice = parseMoneyInput(costRaw);
  const comparePrice = parseMoneyInput(compareRaw);
  const discountPercent = Number(discountPercentRaw);
  const stock = Number(stockRaw);
  const imageFile = form.elements.imageFile?.files?.[0];
  const imageUrl = String(form.elements.image_url?.value || "").trim();

  if (name.length < 2) addError("name", "Escribe el nombre del producto.");
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
  if (costRaw && (!Number.isFinite(costPrice) || costPrice < 0)) {
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
  normalizeMoneyFields();
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
    const salePrice = parseMoneyInput(formData.get("price"));
    const comparePrice = parseMoneyInput(formData.get("compare_price"));
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
      category_id: formData.get("category_id"),
      price: moneyPayloadValue(formData.get("price")),
      cost_price: moneyPayloadValue(formData.get("cost_price")),
      compare_price: hasDiscount ? moneyPayloadValue(formData.get("compare_price")) : "",
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

async function saveStoreSettings(event) {
  event.preventDefault();
  const form = adminEls.storeSettingsForm;
  if (!form) return;
  const submitButton = form.querySelector('button[type="submit"]');
  adminMoney?.normalizeMoneyField(form.elements.shipping_cost);
  const shippingCost = adminMoney
    ? adminMoney.moneyPayloadValue(form.elements.shipping_cost.value)
    : String(form.elements.shipping_cost.value || "0").replace(",", ".");

  setMessage(adminEls.storeSettingsMessage, "Guardando envío...");
  setButtonLoading(submitButton, true);
  try {
    const data = await adminApi("/api/admin/store-settings", {
      method: "PUT",
      body: { shipping_cost: shippingCost }
    });
    adminState.settings.shippingCost = Number(data.shippingCost || 0);
    renderStoreSettings();
    setMessage(adminEls.storeSettingsMessage, "Costo de envío actualizado.", false, true);
    showToast("Costo de envío actualizado.");
  } catch (error) {
    setMessage(adminEls.storeSettingsMessage, error.message, true);
  } finally {
    setButtonLoading(submitButton, false);
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
      category_slug: formData.get("category_slug") || "",
      image_url: imageUrl,
      image_fit: formData.get("image_fit") || "cover",
      image_position_x: formData.get("image_position_x") || "50",
      image_position_y: formData.get("image_position_y") || "50",
      image_zoom: formData.get("image_zoom") || "1",
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

function buildOrderLabelHtml(order) {
  const address = [order.customer_city, order.customer_address].filter(Boolean).join(" · ") || "Retiro / coordinar por WhatsApp";
  const orderTitle = orderDisplayTitle(order);
  const products = (order.items || []).map((item) => {
    const variants = [item.size && `Talla ${item.size}`, item.color && `Color ${item.color}`].filter(Boolean).join(" · ");
    return `<li><strong>${Number(item.quantity || 0)}x</strong> ${escapeHtml(item.name)}${variants ? `<small>${escapeHtml(variants)}</small>` : ""}</li>`;
  }).join("");

  return `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Etiqueta ${escapeHtml(orderTitle)}</title>
      <style>
        * { box-sizing: border-box; }
        @page { size: 100mm 150mm; margin: 6mm; }
        body { margin: 0; padding: 18px; color: #17130a; font-family: Arial, sans-serif; }
        .label { width: 100%; max-width: 380px; min-height: 520px; border: 2px solid #17130a; border-radius: 18px; padding: 18px; display: grid; gap: 14px; }
        .brand { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid #d8c8a9; padding-bottom: 12px; }
        .brand strong { font-size: 28px; letter-spacing: 0.08em; }
        .code { text-align: right; font-weight: 800; }
        h1 { margin: 0; font-size: 22px; }
        p { margin: 0; line-height: 1.35; }
        .block { border: 1px solid #e5d6b7; border-radius: 12px; padding: 12px; }
        .block span { display: block; color: #86631d; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
        .block strong { display: block; margin-top: 4px; font-size: 18px; }
        ul { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }
        li { display: grid; gap: 2px; padding-bottom: 6px; border-bottom: 1px dashed #d8c8a9; }
        li small { color: #63594b; }
        .footer { margin-top: auto; display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: #63594b; }
        @media print {
          body { padding: 0; }
          .label { border-radius: 0; max-width: none; min-height: auto; page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <section class="label">
        <div class="brand">
          <div>
            <strong>GSTORE</strong>
            <p>Etiqueta de paquete</p>
          </div>
          <div class="code">
            ${escapeHtml(orderTitle)}<br>
            ${escapeHtml(statusLabels[order.status] || order.status)}
          </div>
        </div>
        <div class="block">
          <span>Cliente</span>
          <strong>${escapeHtml(order.customer_name || "Cliente sin nombre")}</strong>
          <p>${escapeHtml(order.customer_phone || "Sin teléfono")}</p>
        </div>
        <div class="block">
          <span>Entrega</span>
          <strong>${escapeHtml(orderDeliveryLabel(order))}</strong>
          <p>${escapeHtml(address)}</p>
        </div>
        <div class="block">
          <span>Productos</span>
          <ul>${products || "<li>Sin productos en el pedido</li>"}</ul>
        </div>
        ${order.notes ? `<div class="block"><span>Nota</span><p>${escapeHtml(order.notes)}</p></div>` : ""}
        <div class="footer">
          <span>${escapeHtml(formatDate(order.created_at))}</span>
          <strong>${formatCurrency(order.total)}</strong>
        </div>
      </section>
    </body>
    </html>
  `;
}

function openOrderLabelPrintWindow(html) {
  const printWindow = window.open("", "_blank", "width=420,height=640");
  if (!printWindow) {
    showToast("El navegador bloqueó la impresión. Permite ventanas emergentes para imprimir la etiqueta.");
    return;
  }
  try {
    printWindow.opener = null;
  } catch {
    // Some browsers lock this property; the print window still works.
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    try {
      printWindow.print();
    } catch {
      showToast("No se pudo abrir el diálogo de impresión.");
    }
  }, 180);
  showToast("Etiqueta abierta para imprimir.");
}

function printOrderLabel(id) {
  const order = adminState.orders.find((item) => Number(item.id) === Number(id));
  if (!order) {
    showToast("No encontré ese pedido para imprimir.");
    return;
  }

  const html = buildOrderLabelHtml(order);
  openOrderLabelPrintWindow(html);
}

async function resendOrderEmail(id) {
  try {
    const data = await adminApi(`/api/admin/orders/${id}/email`, { method: "POST" });
    adminState.orders = adminState.orders.map((order) => (
      Number(order.id) === Number(id) ? data.order : order
    ));
    renderOrders();
    renderEmailModule();
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

function buildAdminUrl(path, params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    const text = String(value ?? "").trim();
    if (text && text !== "all") searchParams.set(key, text);
  });
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function normalizePagination(meta, fallbackPage = 1) {
  const page = Math.max(1, Number(meta?.page || fallbackPage || 1));
  const limit = Math.max(1, Number(meta?.limit || ADMIN_PAGE_LIMIT));
  const total = Math.max(0, Number(meta?.total || 0));
  const totalPages = Math.max(1, Number(meta?.totalPages || Math.ceil(total / limit) || 1));
  return {
    page: Math.min(page, totalPages),
    limit,
    total,
    totalPages,
    hasNext: Boolean(meta?.hasNext ?? page < totalPages),
    hasPrev: Boolean(meta?.hasPrev ?? page > 1)
  };
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
    fit: (source.image_fit || source.fit) === "contain" ? "contain" : "cover",
    x: clampFrameNumber(source.image_position_x ?? source.x, 0, 100, 50),
    y: clampFrameNumber(source.image_position_y ?? source.y, 0, 100, 50),
    zoom: clampFrameNumber(source.image_zoom ?? source.zoom, 1, 1.8, 1)
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

function paymentMethodLabel(method) {
  if (method === "paypal") return "PayPal";
  return "WhatsApp";
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

function orderDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin-fecha";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function orderDateGroupLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date).toUpperCase();
}

function orderTimeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-EC", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderEmailStatus() {
  const status = adminState.emailStatus;
  if (!status) return;
  const formatValid = status.fromValid !== false && status.ownerValid !== false && status.replyToValid !== false;
  const configured = Boolean(status.configured && status.ownerConfigured && formatValid);
  setText(adminEls.emailConfigured, configured ? "Activo" : "Falta configurar");
  setText(adminEls.emailFrom, status.fromConfigured
    ? (status.fromValid === false ? "Formato invalido" : status.fromEmail || "Configurado")
    : "Falta RESEND_FROM_EMAIL");
  setText(adminEls.emailOwner, status.ownerConfigured
    ? (status.ownerValid === false ? "Formato invalido" : status.ownerEmail || "Configurado")
    : "Falta RESEND_TO_EMAIL o STORE_OWNER_EMAIL");
  if (adminEls.emailHint) {
    const invalidFields = [
      status.fromValid === false ? "remitente" : "",
      status.ownerValid === false ? "admin" : "",
      status.replyToValid === false ? "reply-to" : ""
    ].filter(Boolean);
    adminEls.emailHint.innerHTML = configured
      ? "<strong>Correo</strong> Resend listo. Si falla con clientes externos, verifica el dominio en Resend."
      : `<strong>Correo</strong> ${invalidFields.length ? `Formato invalido en ${invalidFields.join(", ")}` : "Faltan variables de Resend"}`;
  }
}

function renderCustomers() {
  if (!adminEls.customersList) return;
  renderCustomersOverview();
  const customers = adminState.customers || [];
  adminEls.customersList.innerHTML = customers.map(renderCustomerRow).join("")
    || `<tr><td colspan="8">${emptyAdminState("Todavia no hay clientes guardados.", "Cuando entren pedidos con correo, apareceran aqui.")}</td></tr>`;
  renderAdminPagination("customers", adminEls.customersPagination);
}

function renderCustomersOverview() {
  const customers = adminState.customers || [];
  const summary = adminState.summaries.customers || {};
  const withEmail = Number(summary.withEmail ?? customers.filter((customer) => customer.email).length);
  const ordersTotal = Number(summary.ordersTotal ?? customers.reduce((sum, customer) => sum + Number(customer.order_count || 0), 0));
  const totalSpent = Number(summary.totalSpent ?? customers.reduce((sum, customer) => sum + Number(customer.total_spent || 0), 0));
  setText(adminEls.customersTotal, Number(summary.total ?? adminState.pagination.customers.total ?? customers.length));
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

function renderCustomerRow(customer) {
  const whatsappPhone = String(customer.phone || "").replace(/[^\d]/g, "");
  const lastOrder = customer.last_order_code ? `#${customer.last_order_code}` : "Sin codigo";
  const lastOrderDate = customer.last_order_at ? formatDate(customer.last_order_at) : "Sin fecha";
  return `
    <tr>
      <td data-label="Cliente">
        <strong>${escapeHtml(customer.name || "Cliente sin nombre")}</strong>
        <small>${escapeHtml(customer.marketing_status || "cliente")}</small>
      </td>
      <td data-label="Contacto">
        <strong>${escapeHtml(customer.email || "Sin correo")}</strong>
        <small>${escapeHtml(customer.phone || "Sin teléfono")}</small>
      </td>
      <td data-label="Ciudad">${escapeHtml(customer.city || "Sin ciudad")}</td>
      <td data-label="Dirección">${escapeHtml(customer.address || "Sin dirección")}</td>
      <td data-label="Pedidos">${Number(customer.order_count || 0)}</td>
      <td data-label="Total"><strong>${formatCurrency(customer.total_spent)}</strong></td>
      <td data-label="Ultimo pedido">
        <strong>${escapeHtml(lastOrder)}</strong>
        <small>${escapeHtml(lastOrderDate)}</small>
      </td>
      <td data-label="Acciones">
        <div class="row-actions">
          ${customer.email ? `<a class="small-button" href="mailto:${escapeAttr(customer.email)}">Email</a>` : ""}
          ${whatsappPhone ? `<a class="small-button" href="https://wa.me/${escapeAttr(whatsappPhone)}" target="_blank" rel="noreferrer">WhatsApp</a>` : ""}
        </div>
      </td>
    </tr>
  `;
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

function emailStatusDetail(order) {
  if (order.email_error) return friendlyEmailErrorText(order.email_error);
  if (order.email_sent_at) return `Ultimo intento: ${formatDate(order.email_sent_at)}`;
  return "Sin intento registrado";
}

function friendlyEmailErrorText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const reasons = [];

  if (lower.includes("reply_to") || lower.includes("email address needs to follow")) {
    reasons.push("Reply-to invalido. Revisa RESEND_REPLY_TO_EMAIL y el correo del cliente.");
  }

  if (lower.includes("testing emails") && lower.includes("own email address")) {
    reasons.push("Resend esta en modo prueba. Verifica el dominio/remitente o autoriza el correo del cliente.");
  }

  if (lower.includes("domain") && lower.includes("verified")) {
    reasons.push("Dominio/remitente de Resend pendiente de verificacion.");
  }

  if (reasons.length) return reasons.join(" ");
  return text.length > 180 ? `${text.slice(0, 177)}...` : text || "No se pudo enviar el correo.";
}

function renderEmailModule() {
  if (!adminEls.emailsTable) return;
  renderEmailOverview();
  const orders = adminState.orders || [];
  adminEls.emailsTable.innerHTML = orders.map(renderEmailRow).join("")
    || `<tr><td colspan="7">${emptyAdminState("No hay correos para este filtro.", "Ajusta la busqueda o revisa los pedidos recientes.")}</td></tr>`;
  renderAdminPagination("emails", adminEls.emailPagination);
}

function renderEmailOverview() {
  const orders = adminState.orders || [];
  const summary = adminState.summaries.emails || {};
  const states = orders.map(emailOrderState);
  setText(adminEls.emailFailedCount, Number(summary.failed ?? states.filter((state) => state === "failed").length));
  setText(adminEls.emailPendingCount, Number(summary.pending ?? states.filter((state) => state === "pending").length));
  setText(adminEls.emailSentCount, Number(summary.sent ?? states.filter((state) => state === "sent").length));
  setText(adminEls.emailTotalCount, Number(summary.total ?? adminState.pagination.emails.total ?? orders.length));
}

function filteredEmailOrders() {
  const orders = adminState.orders || [];
  const query = adminState.emailSearch;
  const filter = adminState.emailStatusFilter || "all";
  return orders.filter((order) => {
    const state = emailOrderState(order);
    const matchesStatus = filter === "all" || state === filter;
    const text = [
      order.order_code,
      order.customer_name,
      order.customer_phone,
      order.customer_email,
      emailStatusDetail(order),
      emailStatusLabel(order.admin_email_status),
      emailStatusLabel(order.customer_email_status)
    ].join(" ").toLowerCase();
    const matchesQuery = !query || text.includes(query);
    return matchesStatus && matchesQuery;
  });
}

function emailOrderState(order) {
  const statuses = [
    order.admin_email_status || "pending",
    order.customer_email_status || "pending"
  ];
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("pending")) return "pending";
  if (statuses.includes("sent")) return "sent";
  if (statuses.includes("skipped")) return "skipped";
  return "pending";
}

function renderEmailRow(order) {
  const customerStatus = emailStatusLabel(order.customer_email_status);
  const adminStatus = emailStatusLabel(order.admin_email_status);
  const detail = emailStatusDetail(order);
  const lastAttempt = order.email_sent_at ? formatDate(order.email_sent_at) : "Sin intento";
  return `
    <tr class="email-row email-row-${escapeAttr(emailOrderState(order))}">
      <td data-label="Pedido">
        <strong>${escapeHtml(orderDisplayTitle(order))}</strong>
        <small>${escapeHtml(formatDate(order.created_at))}</small>
      </td>
      <td data-label="Cliente">
        <strong>${escapeHtml(order.customer_name || "Cliente sin nombre")}</strong>
        <small>${escapeHtml(order.customer_phone || "Sin teléfono")}</small>
      </td>
      <td data-label="Cliente email">
        <span class="status-pill ${emailStatusClass(order.customer_email_status)}">${escapeHtml(customerStatus)}</span>
        <small>${escapeHtml(order.customer_email || "Sin correo")}</small>
      </td>
      <td data-label="Admin">
        <span class="status-pill ${emailStatusClass(order.admin_email_status)}">${escapeHtml(adminStatus)}</span>
      </td>
      <td data-label="Ultimo intento">${escapeHtml(lastAttempt)}</td>
      <td data-label="Detalle" class="email-detail-cell">${escapeHtml(detail)}</td>
      <td data-label="Acciones">
        <div class="row-actions">
          <button class="small-button" data-order-email="${order.id}" type="button">Reenviar</button>
          <a class="small-button" href="/admin-pedidos">Pedidos</a>
        </div>
      </td>
    </tr>
  `;
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
