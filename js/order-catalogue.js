/**
 * Order-section catalogue: category switching, add-to-quotation and the
 * quotation panel, all without a page reload (batch 3, items 5 and 8).
 *
 * Weights are the primary figures on every card; piece quantity is
 * secondary (item 7).
 */
(function () {
  "use strict";

  var base = window.CORAL_BASE || "";
  var csrf = window.CORAL_CSRF || "";

  var grid = document.getElementById("productGrid");
  var filters = document.getElementById("categoryFilters");
  var pager = document.getElementById("pager");
  var fab = document.getElementById("quotationFab");
  var fabCount = document.getElementById("fabCount");
  var panel = document.getElementById("quotationPanel");
  var panelBody = document.getElementById("panelBody");
  var backdrop = document.getElementById("panelBackdrop");
  var generateBtn = document.getElementById("generateBtn");

  var category = 0;
  var page = 1;
  var basket = { lines: [], itemCount: 0, pieceCount: 0 };

  function u(path) { return base + "/" + path.replace(/^\//, ""); }

  function esc(value) {
    var d = document.createElement("div");
    d.textContent = value == null ? "" : String(value);
    return d.innerHTML;
  }

  /** Weights print trimmed ("8.420" not "8.4200"), or a dash when unset. */
  function weight(value) {
    if (value === null || value === undefined || value === "") return "—";
    var n = parseFloat(value);
    if (isNaN(n)) return "—";
    return String(n.toFixed(3)).replace(/0+$/, "").replace(/\.$/, "");
  }

  function text(value) {
    return value === null || value === undefined || value === "" ? "—" : esc(value);
  }

  function quantityFor(productId) {
    for (var i = 0; i < basket.lines.length; i++) {
      if (basket.lines[i].productId === productId) return basket.lines[i].quantity;
    }
    return 0;
  }

  // ------------------------------------------------------------ requests

  function postCart(action, productId, quantity) {
    var body = new URLSearchParams();
    body.set("action", action);
    if (productId) body.set("product_id", productId);
    if (quantity !== undefined) body.set("quantity", quantity);

    return fetch(u("api/cart.php"), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-CSRF-Token": csrf },
      body: body.toString()
    }).then(function (res) {
      if (res.status === 401) {
        window.location.href = u("login.php");
        throw new Error("signed out");
      }
      if (!res.ok) throw new Error("request failed");
      return res.json();
    }).then(function (data) {
      basket = data;
      renderBasket();
      return data;
    });
  }

  // ------------------------------------------------------------ rendering

  function cardControls(product) {
    var qty = quantityFor(product.id);
    if (qty > 0) {
      return '<div class="stepper" data-product="' + product.id + '">' +
        '<button type="button" class="step" data-step="-1" aria-label="Reduce quantity">&minus;</button>' +
        '<span class="step-qty">' + qty + '</span>' +
        '<button type="button" class="step" data-step="1" aria-label="Increase quantity">+</button>' +
        '</div><span class="added-flag">Added</span>';
    }
    return '<button type="button" class="btn btn-primary btn-sm btn-block add-btn" data-add="' + product.id + '">Add</button>';
  }

  function renderGrid(products) {
    if (!products.length) {
      grid.innerHTML = '<p class="empty-state">No products in this category yet.</p>';
      return;
    }

    grid.innerHTML = products.map(function (p) {
      return '<article class="product-card" data-card="' + p.id + '">' +
        '<div class="product-media">' +
        (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">' : '') +
        "</div>" +
        '<div class="product-body">' +
        '<span class="product-name">' + text(p.designNo || p.name) + "</span>" +

        // Weights lead — they are what the wholesaler judges the piece on.
        '<div class="weights">' +
        '<div class="weight"><span>Gross</span><strong>' + weight(p.grossWeight) + "</strong></div>" +
        '<div class="weight"><span>Net</span><strong>' + weight(p.netWeight) + "</strong></div>" +
        "</div>" +

        '<dl class="specs specs-minor">' +
        "<dt>Jewel Code</dt><dd>" + text(p.jewelCode) + "</dd>" +
        (p.quantity !== null && p.quantity !== undefined
          ? "<dt>Qty</dt><dd>" + esc(p.quantity) + "</dd>" : "") +
        "</dl>" +

        '<div class="card-actions">' + cardControls(p) + "</div>" +
        "</div></article>";
    }).join("");
  }

  /** Re-renders only the action area of each card, so images do not flicker. */
  function refreshCardControls() {
    grid.querySelectorAll("[data-card]").forEach(function (card) {
      var id = parseInt(card.getAttribute("data-card"), 10);
      var slot = card.querySelector(".card-actions");
      if (!slot) return;
      var qty = quantityFor(id);
      slot.innerHTML = qty > 0
        ? '<div class="stepper" data-product="' + id + '">' +
            '<button type="button" class="step" data-step="-1" aria-label="Reduce quantity">&minus;</button>' +
            '<span class="step-qty">' + qty + "</span>" +
            '<button type="button" class="step" data-step="1" aria-label="Increase quantity">+</button>' +
          '</div><span class="added-flag">Added</span>'
        : '<button type="button" class="btn btn-primary btn-sm btn-block add-btn" data-add="' + id + '">Add</button>';
    });
  }

  function renderBasket() {
    fabCount.textContent = basket.pieceCount;
    fab.hidden = basket.itemCount === 0;
    if (generateBtn) generateBtn.disabled = basket.itemCount === 0;

    if (!basket.lines.length) {
      panelBody.innerHTML = '<p class="empty-state">Nothing added yet.<br>Add pieces from the catalogue.</p>';
    } else {
      panelBody.innerHTML = basket.lines.map(function (l) {
        return '<div class="panel-line" data-product="' + l.productId + '">' +
          (l.image ? '<img src="' + esc(l.image) + '" alt="" loading="lazy">' : '<span class="panel-noimg"></span>') +
          '<div class="panel-line-main">' +
          '<span class="panel-line-name">' + text(l.designNo || l.name) + "</span>" +
          '<span class="panel-line-weights">Gross <strong>' + weight(l.grossWeight) +
            "</strong> &middot; Net <strong>" + weight(l.netWeight) + "</strong></span>" +
          '<span class="panel-line-code">' + text(l.jewelCode) + "</span>" +
          "</div>" +
          '<div class="panel-line-side">' +
          '<div class="stepper" data-product="' + l.productId + '">' +
          '<button type="button" class="step" data-step="-1" aria-label="Reduce quantity">&minus;</button>' +
          '<span class="step-qty">' + l.quantity + "</span>" +
          '<button type="button" class="step" data-step="1" aria-label="Increase quantity">+</button>' +
          "</div>" +
          '<button type="button" class="link-remove" data-remove="' + l.productId + '">Remove</button>' +
          "</div></div>";
      }).join("") +
        '<p class="panel-total"><strong>' + basket.itemCount + "</strong> item" +
        (basket.itemCount === 1 ? "" : "s") + " &middot; <strong>" + basket.pieceCount +
        "</strong> piece" + (basket.pieceCount === 1 ? "" : "s") + "</p>";
    }

    refreshCardControls();
  }

  function loadCatalogue() {
    grid.setAttribute("aria-busy", "true");
    var query = "?category=" + category + "&page=" + page;

    fetch(u("api/catalogue.php") + query, { headers: { Accept: "application/json" } })
      .then(function (res) {
        if (res.status === 401) { window.location.href = u("login.php"); throw new Error("signed out"); }
        return res.json();
      })
      .then(function (data) {
        renderGrid(data.products || []);
        renderPager(data.totalPages || 1);
        grid.setAttribute("aria-busy", "false");
      })
      .catch(function () {
        grid.innerHTML = '<p class="empty-state">Could not load the catalogue. Please try again.</p>';
        grid.setAttribute("aria-busy", "false");
      });
  }

  function renderPager(totalPages) {
    if (totalPages <= 1) { pager.hidden = true; pager.innerHTML = ""; return; }
    var out = "";
    for (var i = 1; i <= totalPages; i++) {
      out += '<button type="button" class="filter-pill' + (i === page ? " is-active" : "") +
        '" data-page="' + i + '">' + i + "</button>";
    }
    pager.innerHTML = out;
    pager.hidden = false;
  }

  // -------------------------------------------------------------- events

  filters.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-category]");
    if (!btn) return;
    category = parseInt(btn.getAttribute("data-category"), 10);
    page = 1;
    filters.querySelectorAll(".filter-pill").forEach(function (b) {
      b.classList.toggle("is-active", b === btn);
    });
    loadCatalogue();
  });

  pager.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-page]");
    if (!btn) return;
    page = parseInt(btn.getAttribute("data-page"), 10);
    loadCatalogue();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.addEventListener("click", function (ev) {
    var add = ev.target.closest("[data-add]");
    if (add) {
      add.disabled = true;
      add.textContent = "Adding…";
      postCart("add", parseInt(add.getAttribute("data-add"), 10), 1).catch(function () {
        add.disabled = false;
        add.textContent = "Add";
      });
      return;
    }

    var step = ev.target.closest(".step");
    if (step) {
      var wrap = step.closest(".stepper");
      var productId = parseInt(wrap.getAttribute("data-product"), 10);
      var delta = parseInt(step.getAttribute("data-step"), 10);
      var next = quantityFor(productId) + delta;
      postCart(next < 1 ? "remove" : "set", productId, Math.max(0, next));
      return;
    }

    var remove = ev.target.closest("[data-remove]");
    if (remove) {
      postCart("remove", parseInt(remove.getAttribute("data-remove"), 10));
      return;
    }
  });

  function openPanel() {
    panel.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add("panel-open");
  }
  function closePanel() {
    panel.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove("panel-open");
  }

  fab.addEventListener("click", openPanel);
  document.getElementById("panelClose").addEventListener("click", closePanel);
  backdrop.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && !panel.hidden) closePanel();
  });

  // ---------------------------------------------------------------- boot

  loadCatalogue();
  postCart("get").catch(function () { /* basket stays empty */ });
})();
