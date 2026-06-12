const state = {
  config: { storeName: "GStore", currency: "USD", paypalEnabled: false, shippingCost: 0 },
  categories: [],
  products: [],
  banners: [],
  cart: loadCart(),
  productsPagination: { page: 1, limit: 48, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
  productsLoading: false,
  activeCategory: "all",
  activeSize: "all",
  sortOrder: "default",
  search: "",
  detail: null,
  checkoutStage: "review",
  productsRenderedOnce: false
};

const API_BASE = window.location.protocol === "file:" ? "http://localhost:4321" : "";
const CARD_IMAGE_WIDTHS = [180, 260, 360, 520];
const DETAIL_IMAGE_WIDTHS = [420, 640, 820, 1100];
const CART_IMAGE_WIDTHS = [96, 140, 180];
const SIZE_NONE = "__none";
let catalogFilters = null;
let catalogSearchTimer = null;

const els = {
  categoryFilters: document.querySelector("#categoryFilters"),
  sizeFilter: document.querySelector("#sizeFilter"),
  sortFilter: document.querySelector("#sortFilter"),
  clearCatalogFilters: document.querySelector("#clearCatalogFilters"),
  storeBanners: document.querySelector("#storeBanners"),
  productGrid: document.querySelector("#productGrid"),
  catalogPagination: document.querySelector("#catalogPagination"),
  loadMoreProducts: document.querySelector("#loadMoreProducts"),
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
  cartSubtotal: document.querySelector("#cartSubtotal"),
  cartShipping: document.querySelector("#cartShipping"),
  cartTotal: document.querySelector("#cartTotal"),
  checkoutSubtotal: document.querySelector("#checkoutSubtotal"),
  checkoutShipping: document.querySelector("#checkoutShipping"),
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
  catalogFilters = window.GStoreCatalogFilters?.createCatalogFilters({
    escapeAttr,
    escapeHtml,
    formatProductName,
    matchesSizeFilter,
    normalizeText,
    state
  });
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
    debounceCatalogLoad();
  });

  els.sizeFilter?.addEventListener("change", (event) => {
    state.activeSize = event.target.value || "all";
    renderCategories();
    renderProducts();
  });

  els.sortFilter?.addEventListener("change", (event) => {
    state.sortOrder = event.target.value || "default";
    loadProducts({ reset: true }).catch((error) => showToast(error.message || "No pudimos ordenar el catálogo."));
  });

  els.clearCatalogFilters?.addEventListener("click", () => {
    state.search = "";
    state.activeCategory = "all";
    state.activeSize = "all";
    state.sortOrder = "default";
    if (els.searchInput) els.searchInput.value = "";
    if (els.sizeFilter) els.sizeFilter.value = "all";
    if (els.sortFilter) els.sortFilter.value = "default";
    loadProducts({ reset: true }).catch((error) => showToast(error.message || "No pudimos limpiar filtros."));
  });

  els.loadMoreProducts?.addEventListener("click", () => {
    loadProducts({ append: true }).catch((error) => showToast(error.message || "No pudimos cargar más productos."));
  });

  document.addEventListener("click", (event) => {
    const bannerControl = event.target.closest("[data-banner-slide]");
    if (bannerControl) {
      scrollBannerCarousel(Number(bannerControl.dataset.bannerSlide || 1));
      return;
    }

    const categoryBanner = event.target.closest("[data-banner-category]");
    if (categoryBanner) {
      event.preventDefault();
      selectCategory(categoryBanner.dataset.bannerCategory, { scroll: true, updateHash: true });
      return;
    }

    const categoryButton = event.target.closest("[data-category-filter]");
    if (categoryButton) {
      selectCategory(categoryButton.dataset.categoryFilter, { scroll: false, updateHash: false });
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
    const [config, categories, banners] = await Promise.all([
      api("/api/config"),
      api("/api/categories"),
      api("/api/banners")
    ]);
    state.config = { ...state.config, ...config, shippingCost: Number(config.shippingCost || 0) };
    state.categories = categories.categories || [];
    state.banners = banners.banners || [];
    syncCategoryFromHash();
    renderStoreBanners();
    await loadProducts({ reset: true });
    renderCheckoutState();
  } catch (error) {
    showToast(error.message || "No pudimos cargar la tienda.");
  }
}

async function loadProducts(options = {}) {
  if (state.productsLoading) return;
  const append = Boolean(options.append);
  const reset = Boolean(options.reset);
  const nextPage = append ? Number(state.productsPagination.page || 1) + 1 : 1;
  state.productsLoading = true;
  renderCatalogPagination();
  try {
    const data = await api(buildProductListUrl(nextPage));
    const incoming = (data.products || []).filter((product) => Number(product.stock || 0) > 0);
    state.products = append && !reset ? [...state.products, ...incoming] : incoming;
    state.productsPagination = normalizeProductPagination(data.pagination, nextPage);
    renderCategories();
    renderCatalogOptions();
    renderProducts();
  } finally {
    state.productsLoading = false;
    renderCatalogPagination();
  }
}

function buildProductListUrl(page = 1) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(state.productsPagination.limit || 48));
  if (state.search) params.set("q", state.search);
  if (state.activeCategory && state.activeCategory !== "all") params.set("category", state.activeCategory);
  if (state.sortOrder && state.sortOrder !== "default") params.set("sort", state.sortOrder);
  return `/api/products?${params.toString()}`;
}

function normalizeProductPagination(meta, fallbackPage = 1) {
  const limit = Math.max(1, Number(meta?.limit || state.productsPagination.limit || 48));
  const total = Math.max(0, Number(meta?.total || 0));
  const totalPages = Math.max(1, Number(meta?.totalPages || Math.ceil(total / limit) || 1));
  const page = Math.min(Math.max(1, Number(meta?.page || fallbackPage || 1)), totalPages);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: Boolean(meta?.hasNext ?? page < totalPages),
    hasPrev: Boolean(meta?.hasPrev ?? page > 1)
  };
}

function debounceCatalogLoad() {
  window.clearTimeout(catalogSearchTimer);
  catalogSearchTimer = window.setTimeout(() => {
    loadProducts({ reset: true }).catch((error) => showToast(error.message || "No pudimos buscar productos."));
  }, 260);
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

function bannerLinkExtraAttrs(url) {
  const link = String(url || "");
  return /^https?:\/\//i.test(link) ? ' target="_blank" rel="noreferrer"' : "";
}

function renderStoreBanners() {
  if (!els.storeBanners) return;
  const banners = state.banners.filter((banner) => banner?.image_url).slice(0, 6);
  els.storeBanners.hidden = banners.length === 0;
  if (!banners.length) {
    els.storeBanners.innerHTML = "";
    return;
  }
  const slides = banners.map((banner, index) => {
    const categorySlug = cleanCategorySlug(banner.category_slug) || categorySlugFromBannerLink(banner.link_url);
    const bannerUrl = categorySlug ? `#categoria-${categorySlug}` : banner.link_url;
    const tag = bannerUrl ? "a" : "article";
    const href = bannerUrl ? ` href="${escapeAttr(bannerUrl)}"${categorySlug ? "" : bannerLinkExtraAttrs(bannerUrl)}` : "";
    const categoryAttrs = categorySlug ? ` data-banner-category="${escapeAttr(categorySlug)}"` : "";
    return `
      <${tag} class="store-banner ${index === 0 ? "is-featured" : ""}"${href}${categoryAttrs}>
        <img ${imageAttrs(banner.image_url, {
          width: index === 0 ? 1200 : 960,
          widths: index === 0 ? DETAIL_IMAGE_WIDTHS : CARD_IMAGE_WIDTHS,
          sizes: "(max-width: 760px) 92vw, 1120px",
          loading: index === 0 ? "eager" : "lazy",
          fetchPriority: index === 0 ? "high" : "low"
        })} ${imageFrameAttrs({ ...banner, image_fit: "contain", image_zoom: 1 }, { includeZoom: false })} alt="${escapeAttr(banner.title || "Banner de tienda")}">
      </${tag}>
    `;
  }).join("");
  els.storeBanners.innerHTML = `
    <div class="store-banner-carousel">
      <div class="store-banner-track" data-banner-track>${slides}</div>
      ${banners.length > 1 ? `
        <div class="store-banner-controls" aria-label="Controles de promociones">
          <button class="store-banner-control" data-banner-slide="-1" type="button" aria-label="Banner anterior">‹</button>
          <span>${banners.length} promociones</span>
          <button class="store-banner-control" data-banner-slide="1" type="button" aria-label="Banner siguiente">›</button>
        </div>
      ` : ""}
    </div>
  `;
}

function cleanCategorySlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function categorySlugFromBannerLink(value) {
  const match = String(value || "").match(/^#categoria-([a-z0-9-]+)$/i);
  return match ? cleanCategorySlug(match[1]) : "";
}

function scrollBannerCarousel(direction) {
  const track = els.storeBanners?.querySelector("[data-banner-track]");
  if (!track) return;
  track.scrollBy({
    left: direction * Math.max(280, track.clientWidth * 0.92),
    behavior: prefersReducedMotion() ? "auto" : "smooth"
  });
}

function selectCategory(slug, options = {}) {
  const categorySlug = cleanCategorySlug(slug);
  const exists = categorySlug === "all" || state.categories.some((category) => category.slug === categorySlug);
  state.activeCategory = exists ? categorySlug : "all";
  syncCategoryButtons();
  loadProducts({ reset: true }).catch((error) => showToast(error.message || "No pudimos filtrar productos."));
  if (options.scroll) {
    document.getElementById("catalogo")?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start"
    });
  }
  if (options.updateHash) {
    const hash = state.activeCategory === "all" ? "catalogo" : `categoria-${state.activeCategory}`;
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${hash}`);
  }
}

function syncCategoryFromHash() {
  const match = String(window.location.hash || "").match(/^#categoria-([a-z0-9-]+)$/i);
  if (!match) return;
  const categorySlug = cleanCategorySlug(match[1]);
  if (state.categories.some((category) => category.slug === categorySlug)) {
    state.activeCategory = categorySlug;
  }
}

function renderCategories() {
  const allCount = categoryVisibleCount("all");
  els.categoryFilters.innerHTML = [
    categoryFilterButton({ slug: "all", name: "Todo" }, allCount),
    ...state.categories.map((category) => categoryFilterButton(category, categoryVisibleCount(category.slug)))
  ].join("");
  syncCategoryButtons();
}

function categoryFilterButton(category, count) {
  if (catalogFilters) return catalogFilters.categoryFilterButton(category, count);
  return "";
}

function categoryVisibleCount(categorySlug) {
  if (!state.search && state.activeSize === "all") {
    if (categorySlug === "all") {
      return state.categories.reduce((sum, category) => sum + Number(category.product_count || 0), 0);
    }
    const category = state.categories.find((item) => item.slug === categorySlug);
    if (category) return Number(category.product_count || 0);
  }
  if (catalogFilters) return catalogFilters.visibleCount(state.products, categorySlug);
  return 0;
}

function syncCategoryButtons() {
  document.querySelectorAll("[data-category-filter]").forEach((button) => {
    const active = button.dataset.categoryFilter === state.activeCategory;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function renderCatalogOptions() {
  if (els.sizeFilter) {
    const sizes = uniqueProductSizes();
    const current = sizes.some((size) => size.value === state.activeSize) ? state.activeSize : "all";
    state.activeSize = current;
    els.sizeFilter.innerHTML = [
      `<option value="all">Todas</option>`,
      ...sizes.map((size) => `<option value="${escapeAttr(size.value)}">${escapeHtml(size.label)}</option>`)
    ].join("");
    els.sizeFilter.value = current;
  }
  if (els.sortFilter) {
    els.sortFilter.value = state.sortOrder;
  }
}

function uniqueProductSizes() {
  const sizeMap = new Map();
  let hasNoSize = false;
  state.products.forEach((product) => {
    if (!product.sizes.length) hasNoSize = true;
    product.sizes.forEach((size) => {
      const label = String(size || "").trim();
      if (!label) return;
      const value = normalizeText(label);
      if (!sizeMap.has(value)) sizeMap.set(value, label);
    });
  });
  const sizes = Array.from(sizeMap, ([value, label]) => ({ value, label }))
    .sort((a, b) => sizeSortRank(a.label) - sizeSortRank(b.label) || a.label.localeCompare(b.label, "es", { numeric: true, sensitivity: "base" }));
  if (hasNoSize) sizes.push({ value: SIZE_NONE, label: "Sin talla" });
  return sizes;
}

function sizeSortRank(size) {
  const normalized = normalizeText(size).toUpperCase();
  const order = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "UNITALLA"];
  const index = order.indexOf(normalized);
  if (index >= 0) return index;
  const number = Number(normalized);
  return Number.isFinite(number) ? 100 + number : 1000;
}

function renderProducts() {
  const filteredProducts = state.products.filter((product) => (
    Number(product.stock || 0) > 0
    && productMatchesCategory(product, state.activeCategory)
    && productMatchesActiveRefinements(product)
  ));
  const products = sortProducts(filteredProducts);

  els.productGrid.innerHTML = products.map(productCard).join("");
  els.emptyState.hidden = products.length > 0;
  renderCatalogPagination();

  const shouldAnimateCards = !state.productsRenderedOnce && products.length > 0 && products.length <= 12;
  state.productsRenderedOnce = true;

  if (shouldAnimateCards && window.gsap && !prefersReducedMotion()) {
    gsap.fromTo(".product-card", { y: 18, opacity: 0 }, {
      y: 0,
      opacity: 1,
      duration: 0.24,
      ease: "power3.out",
      stagger: 0.018
    });
  }
}

function renderCatalogPagination() {
  if (!els.catalogPagination || !els.loadMoreProducts) return;
  const meta = state.productsPagination || {};
  const hasNext = Boolean(meta.hasNext);
  els.catalogPagination.hidden = !hasNext && !state.productsLoading;
  els.loadMoreProducts.disabled = state.productsLoading || !hasNext;
  els.loadMoreProducts.textContent = state.productsLoading ? "Cargando..." : "Ver más productos";
}

function productMatchesCategory(product, categorySlug = "all") {
  return catalogFilters
    ? catalogFilters.productMatchesCategory(product, categorySlug)
    : categorySlug === "all" || product.category?.slug === categorySlug;
}

function productMatchesActiveRefinements(product) {
  if (catalogFilters) return catalogFilters.productMatchesActiveRefinements(product);
  return matchesSizeFilter(product);
}

function matchesSizeFilter(product) {
  if (state.activeSize === "all") return true;
  if (state.activeSize === SIZE_NONE) return product.sizes.length === 0;
  return product.sizes.some((size) => normalizeText(size) === state.activeSize);
}

function sortProducts(products) {
  const sorted = [...products];
  if (state.sortOrder === "price-asc") {
    return sorted.sort((a, b) => Number(a.price || 0) - Number(b.price || 0) || compareProductNames(a, b));
  }
  if (state.sortOrder === "price-desc") {
    return sorted.sort((a, b) => Number(b.price || 0) - Number(a.price || 0) || compareProductNames(a, b));
  }
  if (state.sortOrder === "name-asc") {
    return sorted.sort(compareProductNames);
  }
  return sorted;
}

function compareProductNames(a, b) {
  return formatProductName(a.name).localeCompare(formatProductName(b.name), "es", { numeric: true, sensitivity: "base" });
}

function productCard(product, index = 0) {
  const needsChoice = product.sizes.length > 0 || product.colors.length > 0;
  const soldOut = product.stock <= 0;
  const promoLabel = getProductCardPromoLabel(product);
  const displayName = formatProductName(product.name);
  const variants = [
    product.sizes.length ? product.sizes.slice(0, 4).map((size) => `<span class="variant-pill">${escapeHtml(size)}</span>`).join("") : "",
    product.colors.length ? product.colors.slice(0, 3).map((color) => `<span class="variant-pill">${escapeHtml(color)}</span>`).join("") : ""
  ].filter(Boolean).join("");

  return `
    <article class="product-card">
      <button class="product-media" data-open-product="${product.id}" type="button" aria-label="Ver ${escapeAttr(displayName)}">
        <img ${imageAttrs(product.image_url, {
          loading: index < 4 ? "eager" : "lazy",
          fetchPriority: index < 2 ? "high" : "low"
        })} ${imageFrameAttrs(product)} alt="${escapeAttr(displayName)}">
        <span class="stock-pill">${soldOut ? "Agotado" : `${product.stock} disponible${product.stock === 1 ? "" : "s"}`}</span>
        ${promoLabel ? `<span class="promo-pill">${escapeHtml(promoLabel)}</span>` : ""}
      </button>
      <div class="product-content">
        <div class="product-topline">
          <span>${escapeHtml(product.category?.name || "Producto")}</span>
          ${renderPriceStack(product)}
        </div>
        <h3>${escapeHtml(displayName)}</h3>
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
  const displayName = formatProductName(product.name);

  els.productDetail.innerHTML = `
    <div class="product-detail-media">
      <img ${imageAttrs(product.image_url, { width: 820, widths: DETAIL_IMAGE_WIDTHS, sizes: "(max-width: 640px) 92vw, 520px", loading: "eager", fetchPriority: "high" })} ${imageFrameAttrs(product)} alt="${escapeAttr(displayName)}">
    </div>
    <div class="detail-content">
      <div class="detail-copy">
        <span class="eyebrow">${escapeHtml(product.category?.name || "Producto")}</span>
        <h2>${escapeHtml(displayName)}</h2>
        <p>${escapeHtml(product.description)}</p>
        <div class="detail-meta-row">
          ${renderPriceStack(product, "detail-price")}
          <span class="detail-stock">${soldOut ? "Agotado" : `${product.stock} disponible${product.stock === 1 ? "" : "s"}`}</span>
        </div>
        ${getProductDetailPromoText(product) ? `<div class="detail-promo">${escapeHtml(getProductDetailPromoText(product))}</div>` : ""}
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
      <div class="detail-actions">
        <button class="button primary" id="addDetailToCart" ${soldOut ? "disabled" : ""} type="button">${soldOut ? "Agotado" : "Agregar al carrito"}</button>
        <button class="button ghost" id="viewCartFromDetail" type="button">Revisar pedido</button>
      </div>
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
    const result = addToCart(product, { size: detail.size, color: detail.color }, detail.quantity, { silent: true });
    if (!result?.added) return;
    const addButton = els.productDetail.querySelector("#addDetailToCart");
    if (!addButton) return;
    addButton.textContent = result.capped ? "Stock maximo" : "Listo en carrito";
    addButton.classList.add("is-confirmed");
    window.setTimeout(() => {
      addButton.textContent = "Agregar al carrito";
      addButton.classList.remove("is-confirmed");
    }, 1100);
  });

  els.productDetail.querySelector("#viewCartFromDetail")?.addEventListener("click", () => {
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
    return { added: false, capped: false };
  }
  const key = cartKey(product.id, options.size, options.color);
  const current = state.cart.find((line) => line.key === key);
  const currentQuantity = current?.quantity || 0;
  const requestedQuantity = Math.max(1, Number(quantity) || 1);
  const nextQuantity = Math.min(product.stock, currentQuantity + requestedQuantity);
  const addedQuantity = Math.max(0, nextQuantity - currentQuantity);

  if (!addedQuantity) {
    showToast("Ya tienes el stock disponible en tu carrito.");
    return { added: false, capped: true };
  }

  if (current) {
    current.quantity = nextQuantity;
  } else {
    state.cart.push({
      key,
      productId: product.id,
      name: product.name,
      price: product.price,
      image: assetUrl(product.image_url),
      image_fit: product.image_fit || "cover",
      image_position_x: product.image_position_x ?? 50,
      image_position_y: product.image_position_y ?? 50,
      image_zoom: product.image_zoom ?? 1,
      stock: product.stock,
      size: options.size || "",
      color: options.color || "",
      quantity: Math.max(1, Math.min(product.stock, requestedQuantity))
    });
  }

  saveCart();
  state.checkoutStage = "review";
  renderCart();
  pulseCartButton();
  if (!settings.silent) {
    const suffix = nextQuantity >= product.stock && product.stock > 1 ? " Es el maximo disponible." : "";
    showToast(`Listo, esta en tu carrito.${suffix}`);
  }
  return { added: true, capped: nextQuantity >= product.stock, quantity: addedQuantity };
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

function getProductCardPromoLabel(product) {
  const discountPercent = getDiscountPercent(product);
  if (discountPercent > 0 || product.promo_type === "discount") return `${discountPercent || ""}% menos`.trim();
  if (product.promo_type === "last_units" || product.stock <= 2) return "Ultimas unidades";
  if (product.promo_type === "new_arrival") return "Nuevo";
  return product.promo_label ? "Promo" : "";
}

function getProductDetailPromoText(product) {
  const custom = String(product.promo_label || "").trim();
  if (custom) return compactPromoText(custom);
  const discountPercent = getDiscountPercent(product);
  if (discountPercent > 0 || product.promo_type === "discount") return `${discountPercent || ""}% menos por tiempo limitado`.trim();
  if (product.promo_type === "last_units" || product.stock <= 2) return "Ultimas unidades disponibles";
  if (product.promo_type === "new_arrival") return "Recien llegado";
  return "";
}

function compactPromoText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const compact = text
    .replace(/^promo especial descuento\s*/i, "Promo especial ")
    .replace(/^descuento\s*/i, "")
    .replace(/\s*-\s*\d+%\s*menos\s*$/i, "")
    .trim();
  return compact || text;
}

function renderPriceStack(product, className = "") {
  const hasDiscount = Number(product.compare_price || 0) > Number(product.price || 0);
  return `
    <span class="price-stack ${className}">
      ${hasDiscount ? `<small class="was-price">Antes ${formatCurrency(product.compare_price)}</small>` : ""}
      <strong>${formatCurrency(product.price)}</strong>
    </span>
  `;
}

function renderCart() {
  const count = state.cart.reduce((sum, line) => sum + line.quantity, 0);
  els.cartCount.textContent = count;
  renderCartTotals();
  els.cartEmpty.hidden = state.cart.length > 0;
  if (els.cartReviewFooter) els.cartReviewFooter.hidden = state.cart.length === 0;
  if (!state.cart.length) state.checkoutStage = "review";
  els.checkoutForm.hidden = state.cart.length === 0 || state.checkoutStage !== "checkout";

  els.cartLines.innerHTML = state.cart.map((line) => `
    <article class="cart-line">
      <img ${imageAttrs(line.image, { width: 180, widths: CART_IMAGE_WIDTHS, sizes: "64px" })} ${imageFrameAttrs(line, { includeZoom: false })} alt="${escapeAttr(formatProductName(line.name))}">
      <div class="cart-line-main">
        <h3>${escapeHtml(formatProductName(line.name))}</h3>
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
      <button class="remove-line" data-remove-line="${escapeAttr(line.key)}" type="button" aria-label="Quitar ${escapeAttr(formatProductName(line.name))}">x</button>
    </article>
  `).join("");

  renderCheckoutState();
}

function cartSubtotal() {
  return state.cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

function currentShippingCost() {
  if (!state.cart.length || getDeliveryMethod() === "pickup") return 0;
  const amount = Number(state.config.shippingCost || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function renderCartTotals() {
  const subtotal = cartSubtotal();
  const shipping = currentShippingCost();
  const total = subtotal + shipping;
  if (els.cartSubtotal) els.cartSubtotal.textContent = formatCurrency(subtotal);
  if (els.cartShipping) els.cartShipping.textContent = formatCurrency(shipping);
  if (els.cartTotal) els.cartTotal.textContent = formatCurrency(total);
  if (els.checkoutSubtotal) els.checkoutSubtotal.textContent = formatCurrency(subtotal);
  if (els.checkoutShipping) els.checkoutShipping.textContent = formatCurrency(shipping);
  if (els.checkoutRecapTotal) els.checkoutRecapTotal.textContent = formatCurrency(total);
}

function renderCheckoutState() {
  const hasItems = state.cart.length > 0;
  const isPickup = getDeliveryMethod() === "pickup";
  const checkoutReady = hasItems && state.checkoutStage === "checkout";
  const paypalEnabled = Boolean(state.config.paypalEnabled);
  renderCartTotals();
  els.whatsappCheckoutButton.disabled = !checkoutReady;
  if (els.paypalCheckoutButton) {
    els.paypalCheckoutButton.hidden = !paypalEnabled;
    els.paypalCheckoutButton.disabled = !checkoutReady || !paypalEnabled || isPickup;
  }
  if (els.paypalNote) {
    const note = !paypalEnabled
      ? ""
      : isPickup
      ? "Para retiro, confirma por WhatsApp para coordinar hora y punto."
      : state.config.paypalMode === "live"
      ? "Pago seguro con PayPal. Te llevamos a PayPal y vuelves a GStore para confirmar."
      : "PayPal está en modo sandbox. Cambia PAYPAL_MODE=live cuando conectes la cuenta real.";
    els.paypalNote.textContent = note;
    els.paypalNote.hidden = !note;
  }
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
    : "Confirmar pedido por WhatsApp";
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
  renderCartTotals();
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
  if (!validateCheckoutForm()) return;

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
    showToast("PayPal no está disponible por ahora.");
    return;
  }
  if (!state.cart.length) return showToast("Agrega al menos un producto.");
  if (!validateCheckoutForm()) return;

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

function validateCheckoutForm() {
  if (!els.checkoutForm) return true;
  return typeof els.checkoutForm.reportValidity === "function"
    ? els.checkoutForm.reportValidity()
    : els.checkoutForm.checkValidity();
}

function setCheckoutLoading(isLoading, label = "") {
  const isPickup = getDeliveryMethod() === "pickup";
  const checkoutReady = state.cart.length && state.checkoutStage === "checkout";
  const paypalEnabled = Boolean(state.config.paypalEnabled);
  els.whatsappCheckoutButton.disabled = isLoading || !checkoutReady;
  if (els.paypalCheckoutButton) {
    els.paypalCheckoutButton.hidden = !paypalEnabled;
    els.paypalCheckoutButton.disabled = isLoading || !checkoutReady || !paypalEnabled || isPickup;
  }
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

function formatProductName(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const lower = text.toLocaleLowerCase("es-EC");
  return lower.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase("es-EC"));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("is-visible"), 1900);
}

function pulseCartButton() {
  const cartButton = document.querySelector("#openCartButton");
  if (!cartButton) return;
  cartButton.classList.remove("is-bumped");
  void cartButton.offsetWidth;
  cartButton.classList.add("is-bumped");
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
