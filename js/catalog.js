(function () {
  "use strict";

  var grid = document.getElementById("catalogGrid");
  var filterBar = document.getElementById("catalogFilters");
  var searchInput = document.getElementById("catalogSearch");
  var emptyState = document.getElementById("catalogEmpty");
  if (!grid) return;

  var allProducts = [];
  var activeCategory = "All";

  function render() {
    var query = (searchInput && searchInput.value.trim().toLowerCase()) || "";

    var filtered = allProducts.filter(function (p) {
      var matchesCategory = activeCategory === "All" || p.category === activeCategory;
      var matchesQuery =
        !query ||
        (p.title && p.title.toLowerCase().indexOf(query) !== -1) ||
        (p.description && p.description.toLowerCase().indexOf(query) !== -1) ||
        (p.category && p.category.toLowerCase().indexOf(query) !== -1);
      return matchesCategory && matchesQuery;
    });

    grid.innerHTML = filtered
      .map(function (p) {
        var esc = window.Coral.escapeHTML;
        return (
          '<article class="catalog-card reveal">' +
          '<div class="catalog-card-media">' +
          '<img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" loading="lazy" decoding="async" width="900" height="900" />' +
          "</div>" +
          '<div class="catalog-card-body">' +
          '<span class="catalog-tag">' + esc(p.category) + "</span>" +
          "<h3>" + esc(p.title) + "</h3>" +
          "<p>" + esc(p.description) + "</p>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    if (emptyState) {
      emptyState.hidden = filtered.length !== 0;
    }

    if (window.Coral && window.Coral.initReveal) {
      window.Coral.initReveal();
    }
  }

  function buildFilters(categories) {
    if (!filterBar) return;
    var all = ["All"].concat(categories);
    filterBar.innerHTML = all
      .map(function (cat) {
        var isActive = cat === activeCategory ? " is-active" : "";
        return '<button type="button" class="filter-pill' + isActive + '" data-category="' + window.Coral.escapeHTML(cat) + '">' + window.Coral.escapeHTML(cat) + "</button>";
      })
      .join("");

    filterBar.querySelectorAll(".filter-pill").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeCategory = btn.getAttribute("data-category");
        filterBar.querySelectorAll(".filter-pill").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        render();
      });
    });
  }

  window.Coral.loadJSON("content/products.json")
    .then(function (products) {
      allProducts = products;
      var categories = Array.from(new Set(products.map(function (p) { return p.category; }))).sort();
      buildFilters(categories);
      render();
    })
    .catch(function () {
      grid.innerHTML = "<p class=\"catalog-error\">Sorry, the catalog could not be loaded right now. Please try again shortly.</p>";
    });

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      render();
    });
  }
})();
