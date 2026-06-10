(function attachCatalogFilters(global) {
  function createCatalogFilters(deps) {
    const {
      escapeAttr,
      escapeHtml,
      formatProductName,
      matchesSizeFilter,
      normalizeText,
      state
    } = deps;

    function productMatchesCategory(product, categorySlug = "all") {
      return categorySlug === "all" || product.category?.slug === categorySlug;
    }

    function productMatchesActiveRefinements(product) {
      const normalizedSearch = normalizeText(state.search);
      if (!matchesSizeFilter(product)) return false;
      if (!normalizedSearch) return true;
      const searchText = normalizeText([
        product.name,
        formatProductName(product.name),
        product.description,
        product.category?.name,
        product.promo_label,
        product.promo_type,
        product.sizes.join(" "),
        product.colors.join(" ")
      ].join(" "));
      return searchText.includes(normalizedSearch);
    }

    function visibleCount(products, categorySlug) {
      return products.filter((product) => (
        productMatchesCategory(product, categorySlug) && productMatchesActiveRefinements(product)
      )).length;
    }

    function categoryFilterButton(category, count) {
      const slug = category.slug || "all";
      const name = category.name || "Categoria";
      const active = slug === state.activeCategory;
      const anchorId = slug === "all" ? "categoria-todo" : `categoria-${slug}`;
      return `
        <button id="${escapeAttr(anchorId)}" class="filter-chip ${active ? "is-active" : ""}" data-category-filter="${escapeAttr(slug)}" type="button" aria-pressed="${active ? "true" : "false"}" aria-label="${escapeAttr(`${name}: ${count} producto${count === 1 ? "" : "s"}`)}">
          <span class="filter-chip-label">${escapeHtml(name)} <em>· ${count}</em></span>
          <strong class="filter-chip-count">${count}</strong>
        </button>
      `;
    }

    return {
      categoryFilterButton,
      productMatchesActiveRefinements,
      productMatchesCategory,
      visibleCount
    };
  }

  global.GStoreCatalogFilters = { createCatalogFilters };
})(window);
