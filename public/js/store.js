const state = {
  config: { storeName: "GStore", currency: "USD", paypalEnabled: false },
  categories: [],
  products: [],
  cart: loadCart(),
  activeCategory: "all",
  search: "",
  detail: null,
  checkoutStage: "review"
};

const API_BASE = window.location.protocol === "file:" ? "http://localhost:4321" : "";
const CARD_IMAGE_WIDTHS = [180, 260, 360, 520];
const DETAIL_IMAGE_WIDTHS = [420, 640, 820, 1100];
const CART_IMAGE_WIDTHS = [96, 140, 180];

const els = {
  categoryFilters: document.querySelector("#categoryFilters"),
  productGrid: document.querySelector("#productGrid"),
  emptyState: document.querySelector("#emptyState"),
  searchInput: document.querySelector("#searchInput"),
  cartCount: document.querySelector("#cartCount"),
  cartDrawer: document.querySelector("#cartDrawer"),
  productDrawer: document.querySelector("#productDrawer"),
  productDetail: document.querySelector("#productDetail"),
  drawerBackdrop: document.querySelector("#drawerBackdrop"),
  cartLines: document.querySelector("#cartLines"),
  cartEmpty: document.querySelector("#cartEmpty"),
  cartReviewFooter: document.querySelector("#cartReviewFooter"),
  cartTotal: document.querySelector("#cartTotal"),
  checkoutRecapTotal: document.querySelector("#checkoutRecapTotal"),
  checkoutForm: document.querySelector("#checkoutForm"),
  continueCheckoutButton: document.querySelector("#continueCheckoutButton"),
  editCartButton: document.querySelector("#editCartButton"),
  whatsappCheckoutButton: document.querySelector("#whatsappCheckoutButton"),
  paypalCheckoutButton: document.querySelector("#paypalCheckoutButton"),
  paypalNote: document.querySelector("#paypalNote"),
  deliveryAddressWrap: document.querySelector("#deliveryAddressWrap"),
  checkoutModeText: document.querySelector("#checkoutModeText"),
  pickupWhatsappNote: document.querySelector("#pickupWhatsappNote"),
  toast: document.querySelector("#toast")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  renderCart();
  await loadData();
  animateInitialView();
}

function bindEvents() {
  document.querySelector("#openCartButton")?.addEventListener("click", openCart);
  document.querySelector(".close-cart")?.addEventListener("click", closeCart);
  document.querySelector(".close-product")?.addEventListener("click", closeProduct);
  els.drawerBackdrop?.addEventListener("click", closeDrawers);
  document.querySelectorAll("[data-scroll-target]").forEach((link) => {
    link.addEventListener("click", handleInternalScroll);
  });

  els.searchInput?.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderProducts();
  });

  document.addEventListener("click", (event) => {
    const categoryButton = event.target.closest("[data-category-filter]");
    if (categoryButton) {
      state.activeCategory = categoryButton.dataset.categoryFilter;
      syncCategoryButtons();
      renderProducts();
      return;
    }

    const detailButton = event.target.closest("[data-open-product]");
    if (detailButton) {
      openProduct(Number(detailButton.dataset.openProduct));
      return;
    }

    const quickAdd = event.target.closest("[data-quick-add]");
    if (quickAdd) {
      const product = state.products.find((item) => item.id === Number(quickAdd.dataset.quickAdd));
      if (product) addToCart(product, { size: "", color: "" }, 1);
      return;
    }

    const removeButton = event.target.closest("[data-remove-line]");
    if (removeButton) {
      removeCartLine(removeButton.dataset.removeLine);
      return;
    }

    const quantityButton = event.target.closest("[data-line-quantity]");
    if (quantityButton) {
      changeLineQuantity(quantityButton.dataset.lineQuantity, Number(quantityButton.dataset.direction));
    }
  });

  els.checkoutForm?.addEventListener("submit", submitWhatsappOrder);
  els.continueCheckoutButton?.addEventListener("click", continueToCheckout);
  els.editCartButton?.addEventListener("click", returnToCartReview);
  els.paypalCheckoutButton?.addEventListener("click", submitPaypalOrder);
  document.querySelectorAll('input[name="delivery_method"]').forEach((input) => {
    input.addEventListener("change", renderCheckoutState);
  });
}

function handleInternalScroll(event) {
  const targetId = event.currentTarget.dataset.scrollTarget;
  const target = document.getElementById(targetId);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  if (window.location.hash) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

async function loadData() {
  try {
    const [config, categories, products] = await Promise.all([
      api("/api/config"),
      api("/api/categories"),
      api("/api/products")
    ]);
    state.config = config;
    state.categories = categories.categories || [];
    state.products = products.products || [];
    renderCategories();
    renderProducts();
    renderCheckoutState();
  } catch (error) {
    showToast(error.message || "No pudimos cargar la tienda.");
  }
}

async function api(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Solicitud no disponible.");
  return data;
}

function assetUrl(value) {
  const url = String(value || "");
  if (window.location.protocol === "file:" && url.startsWith("/")) return `${API_BASE}${url}`;
  if (window.location.protocol === "file:" && url.startsWith("assets/")) return url;
  return url;
}

function pagePath(name) {
  return window.location.protocol === "file:" ? `${name}.html` : `/${name}`;
}

function isCloudinaryImage(url) {
  return /res\.cloudinary\.com\/.+\/image\/upload\//.test(url);
}

function isLocalOptimizableImage(url) {
  const path = localImagePath(url);
  return Boolean(path && !path.endsWith(".svg"));
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

function optimizedImageUrl(value, width = 420) {
  const url = assetUrl(value);
  if (!url || url.endsWith(".svg")) return url;
  const safeWidth = Math.max(96, Math.min(1400, Number(width) || 420));
  if (isCloudinaryImage(url)) {
    if (url.includes("/image/upload/f_auto")) return url;
    return url.replace("/image/upload/", `/image/upload/f_auto,q_auto:good,dpr_auto,fl_progressive,c_limit,w_${safeWidth}/`);
  }
  if (isLocalOptimizableImage(url)) {
    return `${API_BASE}/api/image?src=${encodeURIComponent(localImagePath(url))}&w=${safeWidth}`;
  }
  return url;
}

function imageSrcset(value, widths = CARD_IMAGE_WIDTHS) {
  const url = assetUrl(value);
  if (!url || url.endsWith(".svg") || (!isCloudinaryImage(url) && !isLocalOptimizableImage(url))) return "";
  return widths.map((width) => `${optimizedImageUrl(url, width)} ${width}w`).join(", ");
}

function imageAttrs(value, options = {}) {
  const {
    width = 420,
    sizes = "(max-width: 640px) 46vw, (max-width: 1080px) 30vw, 245px",
    loading = "lazy",
    fetchPriority = "low",
    widths = CARD_IMAGE_WIDTHS
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

function renderCategories() {
  els.categoryFilters.innerHTML = [
    `<button class="filter-chip is-active" data-category-filter="all" type="button">Todo</button>`,
    ...state.categories.map((category) => (
      `<button class="filter-chip" data-category-filter="${escapeAttr(category.slug)}" type="button">${escapeHtml(category.name)}</button>`
    ))
  ].join("");
  syncCategoryButtons();
}

function syncCategoryButtons() {
  document.querySelectorAll("[data-category-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.categoryFilter === state.activeCategory);
  });
}

function renderProducts() {
  const normalizedSearch = normalizeText(state.search);
  const products = state.products.filter((product) => {
    const categoryMatch = state.activeCategory === "all" || product.category?.slug === state.activeCategory;
    const searchText = normalizeText([
      product.name,
      product.description,
      product.category?.name,
      product.promo_label,
      product.promo_type,
      product.sizes.join(" "),
      product.colors.join(" ")
    ].join(" "));
    return categoryMatch && (!normalizedSearch || searchText.includes(normalizedSearch));
  });

  els.productGrid.innerHTML = products.map(productCard).join("");
  els.emptyState.hidden = products.length > 0;

  if (window.gsap && !prefersReducedMotion()) {
    gsap.fromTo(".product-card", { y: 18, opacity: 0 }, {
      y: 0,
      opacity: 1,
      duration: 0.42,
      ease: "power3.out",
      stagger: 0.035
    });
  }
}

function productCard(product, index = 0) {
  const needsChoice = product.sizes.length > 0 || product.colors.length > 0;
  const soldOut = product.stock <= 0;
  const promoLabel = getProductPromoLabel(product);
  const discount = getDiscountPercent(product);
  const variants = [
    product.sizes.length ? product.sizes.slice(0, 4).map((size) => `<span class="variant-pill">${escapeHtml(size)}</span>`).join("") : "",
    product.colors.length ? product.colors.slice(0, 3).map((color) => `<span class="variant-pill">${escapeHtml(color)}</span>`).join("") : ""
  ].filter(Boolean).join("");

  return `
    <article class="product-card">
      <button class="product-media" data-open-product="${product.id}" type="button" aria-label="Ver ${escapeAttr(product.name)}">
        <img ${imageAttrs(product.image_url, {
          loading: index < 4 ? "eager" : "lazy",
          fetchPriority: index < 2 ? "high" : "low"
        })} alt="${escapeAttr(product.name)}">
        <span class="stock-pill">${soldOut ? "Agotado" : `${product.stock} disponible${product.stock === 1 ? "" : "s"}`}</span>
        ${promoLabel ? `<span class="promo-pill">${escapeHtml(promoLabel)}</span>` : ""}
      </button>
      <div class="product-content">
        <div class="product-topline">
          <span>${escapeHtml(product.category?.name || "Producto")}</span>
          ${renderPriceStack(product)}
        </div>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description)}</p>
        <div class="variant-row">${variants || `<span class="variant-pill">Sin talla</span>`}</div>
        <div class="product-actions">
          <button class="button ghost" data-open-product="${product.id}" type="button">Ver</button>
          <button class="button primary" ${soldOut ? "disabled" : ""} ${needsChoice ? `data-open-product="${product.id}"` : `data-quick-add="${product.id}"`} type="button">
            ${needsChoice ? "Elegir" : "Agregar"}
          </button>
        </div>
      </div>
    </article>
  `;
}

function openProduct(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  state.detail = {
    product,
    size: product.sizes[0] || "",
    color: product.colors[0] || "",
    quantity: 1
  };
  renderProductDetail();
  openDrawer(els.productDrawer);
}

function renderProductDetail() {
  const detail = state.detail;
  if (!detail) return;
  const product = detail.product;
  const soldOut = product.stock <= 0;

  els.productDetail.innerHTML = `
    <img ${imageAttrs(product.image_url, { width: 820, widths: DETAIL_IMAGE_WIDTHS, sizes: "(max-width: 640px) 92vw, 520px", loading: "eager", fetchPriority: "high" })} alt="${escapeAttr(product.name)}">
    <div class="detail-content">
      <div class="detail-copy">
        <span class="eyebrow">${escapeHtml(product.category?.name || "Producto")}</span>
        <h2>${escapeHtml(product.name)}</h2>
        <p>${escapeHtml(product.description)}</p>
        <div class="detail-meta-row">
          ${renderPriceStack(product, "detail-price")}
          <span class="detail-stock">${soldOut ? "Agotado" : `${product.stock} disponible${product.stock === 1 ? "" : "s"}`}</span>
        </div>
        ${getProductPromoLabel(product) ? `<div class="detail-promo">${escapeHtml(getProductPromoLabel(product))}${getDiscountPercent(product) > 0 ? ` - ${getDiscountPercent(product)}% menos` : ""}</div>` : ""}
      </div>
      ${renderOptionGroup("Talla", "size", product.sizes, detail.size)}
      ${renderOptionGroup("Color", "color", product.colors, detail.color)}
      <div class="option-group">
        <strong>Cantidad</strong>
        <div class="quantity-control">
          <button type="button" data-detail-quantity="-1" aria-label="Restar cantidad">-</button>
          <span>${detail.quantity}</span>
          <button type="button" data-detail-quantity="1" aria-label="Sumar cantidad">+</button>
        </div>
      </div>
      <button class="button primary" id="addDetailToCart" ${soldOut ? "disabled" : ""} type="button">${soldOut ? "Agotado" : "Agregar al carrito"}</button>
    </div>
  `;

  els.productDetail.querySelectorAll("[data-option]").forEach((button) => {
    button.addEventListener("click", () => {
      detail[button.dataset.option] = button.dataset.value;
      renderProductDetail();
    });
  });

  els.productDetail.querySelectorAll("[data-detail-quantity]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = detail.quantity + Number(button.dataset.detailQuantity);
      detail.quantity = Math.max(1, Math.min(product.stock, next));
      renderProductDetail();
    });
  });

  els.productDetail.querySelector("#addDetailToCart")?.addEventListener("click", () => {
    addToCart(product, { size: detail.size, color: detail.color }, detail.quantity, { silent: true });
    closeProduct();
    openCart();
  });
}

function renderOptionGroup(label, key, values, selected) {
  if (!values.length) return "";
  return `
    <div class="option-group">
      <strong>${label}</strong>
      <div class="option-buttons">
        ${values.map((value) => `
          <button class="option-button ${value === selected ? "is-selected" : ""}" data-option="${key}" data-value="${escapeAttr(value)}" type="button">
            ${escapeHtml(value)}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function addToCart(product, options, quantity, settings = {}) {
  if (product.stock <= 0) {
    showToast("Ese producto está agotado.");
    return;
  }
  const key = cartKey(product.id, options.size, options.color);
  const current = state.cart.find((line) => line.key === key);
  const nextQuantity = Math.min(product.stock, (current?.quantity || 0) + quantity);

  if (current) {
    current.quantity = nextQuantity;
  } else {
    state.cart.push({
      key,
      productId: product.id,
      name: product.name,
      price: product.price,
      image: assetUrl(product.image_url),
      stock: product.stock,
      size: options.size || "",
      color: options.color || "",
      quantity: Math.max(1, Math.min(product.stock, quantity))
    });
  }

  saveCart();
  state.checkoutStage = "review";
  renderCart();
  if (!settings.silent) {
    showToast(`${product.name} agregado al carrito.`);
  }
}

function getDiscountPercent(product) {
  const compare = Number(product.compare_price || 0);
  const price = Number(product.price || 0);
  if (!compare || compare <= price || !price) return 0;
  return Math.round(((compare - price) / compare) * 100);
}

function getDiscountSavings(product) {
  const compare = Number(product.compare_price || 0);
  const price = Number(product.price || 0);
  if (!compare || compare <= price || !price) return 0;
  return Math.max(0, compare - price);
}

function getProductPromoLabel(product) {
  if (product.promo_label) return product.promo_label;
  if (getDiscountPercent(product) > 0 || product.promo_type === "discount") return "Oferta limitada";
  if (product.promo_type === "last_units" || product.stock <= 2) return "Últimas unidades";
  if (product.promo_type === "new_arrival") return "Recién llegado";
  return "";
}

function renderPriceStack(product, className = "") {
  const hasDiscount = Number(product.compare_price || 0) > Number(product.price || 0);
  const discountPercent = getDiscountPercent(product);
  const savings = getDiscountSavings(product);
  return `
    <span class="price-stack ${className}">
      ${hasDiscount ? `<small class="was-price">Antes ${formatCurrency(product.compare_price)}</small>` : ""}
      <strong>${formatCurrency(product.price)}</strong>
      ${hasDiscount ? `<span class="saving-price">Ahorras ${formatCurrency(savings)} · ${discountPercent}% menos</span>` : ""}
    </span>
  `;
}

function renderCart() {
  const count = state.cart.reduce((sum, line) => sum + line.quantity, 0);
  const total = state.cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  els.cartCount.textContent = count;
  els.cartTotal.textContent = formatCurrency(total);
  if (els.checkoutRecapTotal) els.checkoutRecapTotal.textContent = formatCurrency(total);
  els.cartEmpty.hidden = state.cart.length > 0;
  if (els.cartReviewFooter) els.cartReviewFooter.hidden = state.cart.length === 0;
  if (!state.cart.length) state.checkoutStage = "review";
  els.checkoutForm.hidden = state.cart.length === 0 || state.checkoutStage !== "checkout";

  els.cartLines.innerHTML = state.cart.map((line) => `
    <article class="cart-line">
      <img ${imageAttrs(line.image, { width: 180, widths: CART_IMAGE_WIDTHS, sizes: "64px" })} alt="${escapeAttr(line.name)}">
      <div class="cart-line-main">
        <h3>${escapeHtml(line.name)}</h3>
        <p>${escapeHtml([line.size && `Talla ${line.size}`, line.color && `Color ${line.color}`].filter(Boolean).join(" · ") || "Producto")}</p>
        <div class="cart-line-footer">
          <div class="quantity-control">
            <button type="button" data-line-quantity="${escapeAttr(line.key)}" data-direction="-1" aria-label="Restar">-</button>
            <span>${line.quantity}</span>
            <button type="button" data-line-quantity="${escapeAttr(line.key)}" data-direction="1" aria-label="Sumar">+</button>
          </div>
          <strong class="cart-line-total">${formatCurrency(line.price * line.quantity)}</strong>
        </div>
      </div>
      <button class="remove-line" data-remove-line="${escapeAttr(line.key)}" type="button" aria-label="Quitar ${escapeAttr(line.name)}">x</button>
    </article>
  `).join("");

  renderCheckoutState();
}

function renderCheckoutState() {
  const hasItems = state.cart.length > 0;
  const isPickup = getDeliveryMethod() === "pickup";
  const checkoutReady = hasItems && state.checkoutStage === "checkout";
  els.whatsappCheckoutButton.disabled = !checkoutReady;
  els.paypalCheckoutButton.disabled = !checkoutReady || !state.config.paypalEnabled || isPickup;
  els.paypalNote.textContent = isPickup
    ? "Para retiro, confirma por WhatsApp para coordinar hora y punto."
    : state.config.paypalEnabled
    ? "PayPal está activo. El pago se procesa de forma segura."
    : "PayPal se activa cuando llenes sus variables de entorno.";
  renderDeliveryState();
}

function continueToCheckout() {
  if (!state.cart.length) {
    showToast("Agrega al menos un producto.");
    return;
  }
  state.checkoutStage = "checkout";
  renderCart();
  if (navigator.vibrate) navigator.vibrate(10);
  requestAnimationFrame(() => {
    els.checkoutForm?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    els.checkoutForm?.elements.name?.focus({ preventScroll: true });
  });
}

function returnToCartReview() {
  state.checkoutStage = "review";
  renderCart();
  requestAnimationFrame(() => {
    document.querySelector(".cart-step")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  });
}

function getDeliveryMethod() {
  return document.querySelector('input[name="delivery_method"]:checked')?.value === "pickup"
    ? "pickup"
    : "delivery";
}

function getWhatsappCheckoutLabel() {
  return getDeliveryMethod() === "pickup"
    ? "Coordinar retiro por WhatsApp"
    : "Enviar pedido por WhatsApp";
}

function renderDeliveryState() {
  if (!els.checkoutForm) return;
  const isPickup = getDeliveryMethod() === "pickup";
  const addressInput = els.checkoutForm.elements.address;

  if (els.deliveryAddressWrap) els.deliveryAddressWrap.hidden = isPickup;
  if (els.pickupWhatsappNote) els.pickupWhatsappNote.hidden = !isPickup;
  if (els.checkoutModeText) {
    els.checkoutModeText.textContent = isPickup
      ? "Retiro seleccionado. La coordinación se hace por WhatsApp."
      : "Envío seleccionado. La dirección queda en el pedido.";
  }
  if (addressInput) {
    addressInput.required = !isPickup;
    addressInput.placeholder = isPickup ? "No hace falta dirección para retiro" : "Sector, referencia o dirección";
  }
  if (!els.whatsappCheckoutButton.disabled) {
    els.whatsappCheckoutButton.textContent = getWhatsappCheckoutLabel();
  }
}

function changeLineQuantity(key, direction) {
  const line = state.cart.find((item) => item.key === key);
  if (!line) return;
  line.quantity = Math.max(1, Math.min(line.stock, line.quantity + direction));
  state.checkoutStage = "review";
  saveCart();
  renderCart();
}

function removeCartLine(key) {
  state.cart = state.cart.filter((line) => line.key !== key);
  state.checkoutStage = "review";
  saveCart();
  renderCart();
}

async function submitWhatsappOrder(event) {
  event.preventDefault();
  if (!state.cart.length) return showToast("Agrega al menos un producto.");
  if (state.checkoutStage !== "checkout") {
    continueToCheckout();
    return;
  }

  const pendingWindow = window.open("", "_blank");
  if (pendingWindow) {
    pendingWindow.document.write("<p>Preparando pedido...</p>");
  }

  setCheckoutLoading(true, "Preparando WhatsApp...");
  try {
    const payload = buildOrderPayload();
    const data = await api("/api/orders/whatsapp", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    state.cart = [];
    saveCart();
    renderCart();

    if (pendingWindow) {
      pendingWindow.location.href = data.whatsappUrl;
    } else {
      window.open(data.whatsappUrl, "_blank", "noopener");
    }
    window.location.href = `${pagePath("success")}?order=${encodeURIComponent(data.order.order_code)}`;
  } catch (error) {
    if (pendingWindow) pendingWindow.close();
    showToast(error.message);
  } finally {
    setCheckoutLoading(false);
  }
}

async function submitPaypalOrder() {
  if (state.checkoutStage !== "checkout") {
    continueToCheckout();
    return;
  }
  if (getDeliveryMethod() === "pickup") {
    showToast("Para retiro, confirma por WhatsApp para coordinar directamente.");
    return;
  }
  if (!state.config.paypalEnabled) {
    showToast("PayPal todavía no está configurado.");
    return;
  }
  if (!state.cart.length) return showToast("Agrega al menos un producto.");

  setCheckoutLoading(true, "Conectando PayPal...");
  try {
    const data = await api("/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify(buildOrderPayload())
    });
    state.cart = [];
    saveCart();
    window.location.href = data.approvalUrl;
  } catch (error) {
    showToast(error.message);
  } finally {
    setCheckoutLoading(false);
  }
}

function buildOrderPayload() {
  const form = new FormData(els.checkoutForm);
  return {
    delivery_method: getDeliveryMethod(),
    customer: {
      name: form.get("name"),
      phone: form.get("phone"),
      email: form.get("email"),
      city: form.get("city"),
      address: form.get("address"),
      notes: form.get("notes")
    },
    items: state.cart.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      size: line.size,
      color: line.color
    }))
  };
}

function setCheckoutLoading(isLoading, label = "") {
  const isPickup = getDeliveryMethod() === "pickup";
  const checkoutReady = state.cart.length && state.checkoutStage === "checkout";
  els.whatsappCheckoutButton.disabled = isLoading || !checkoutReady;
  els.paypalCheckoutButton.disabled = isLoading || !checkoutReady || !state.config.paypalEnabled || isPickup;
  if (label) els.whatsappCheckoutButton.textContent = label;
  if (!isLoading) {
    els.whatsappCheckoutButton.textContent = getWhatsappCheckoutLabel();
  }
}

function openCart() {
  openDrawer(els.cartDrawer);
}

function closeCart() {
  closeDrawer(els.cartDrawer);
}

function closeProduct() {
  closeDrawer(els.productDrawer);
}

function closeDrawers() {
  closeCart();
  closeProduct();
}

function openDrawer(drawer) {
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  els.drawerBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  if (window.gsap && !prefersReducedMotion()) {
    const panel = drawer.querySelector(".drawer-panel");
    if (drawer.id === "productDrawer") {
      gsap.fromTo(panel, { y: 18, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.24, ease: "power3.out" });
    } else {
      gsap.fromTo(panel, { x: "104%" }, { x: "0%", duration: 0.34, ease: "power3.out" });
    }
  }
}

function closeDrawer(drawer) {
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  const anyOpen = document.querySelector(".drawer.is-open");
  if (!anyOpen) {
    els.drawerBackdrop.hidden = true;
    document.body.style.overflow = "";
  }
}

function animateInitialView() {
  if (!window.gsap || prefersReducedMotion()) return;
  gsap.fromTo("[data-animate='header']", { y: -18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power3.out" });
  gsap.fromTo(".catalog-heading > *", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.48, ease: "power3.out", stagger: 0.06 });
  gsap.fromTo(".catalog-tools", { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, ease: "power3.out", delay: 0.1 });
}

function cartKey(productId, size, color) {
  return [productId, size || "na", color || "na"].join("|");
}

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("gstore_cart") || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem("gstore_cart", JSON.stringify(state.cart));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: state.config.currency || "USD" }).format(Number(value || 0));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("is-visible"), 3200);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
