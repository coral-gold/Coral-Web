/* Shared behavior for every page: header/footer partial injection,
   nav + scroll-shrink header, footer year/social, and the scroll-reveal
   + count-up system used across pages. Page-specific rendering (home,
   about, catalog, wholesale, contact) lives in its own js/<page>.js file. */
(function () {
  "use strict";

  window.Coral = window.Coral || {};

  /* ---- tiny fetch-JSON helper shared by page scripts ---- */
  window.Coral.loadJSON = function (path) {
    return fetch(path).then(function (res) {
      if (!res.ok) throw new Error("Failed to load " + path);
      return res.json();
    });
  };

  /* ---- escape helper for content coming from CMS-edited JSON ---- */
  window.Coral.escapeHTML = function (str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  };

  function initHeader() {
    var header = document.querySelector(".site-header");
    if (header) {
      var onScroll = function () {
        header.classList.toggle("is-scrolled", window.scrollY > 12);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    var navToggle = document.getElementById("navToggle");
    var primaryNav = document.getElementById("primaryNav");
    if (navToggle && primaryNav) {
      navToggle.addEventListener("click", function () {
        var isOpen = primaryNav.classList.toggle("is-open");
        navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
      primaryNav.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          primaryNav.classList.remove("is-open");
          navToggle.setAttribute("aria-expanded", "false");
        });
      });
    }

    var currentPage = document.body.getAttribute("data-page");
    if (currentPage) {
      var activeLink = document.querySelector('[data-nav="' + currentPage + '"]');
      if (activeLink) activeLink.setAttribute("aria-current", "page");
    }
  }

  function initFooter() {
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    window.Coral.loadJSON("api/content.php?page=contact")
      .then(function (contact) {
        var fab = document.getElementById("whatsappFab");
        if (fab && contact.whatsapp_href) fab.href = contact.whatsapp_href;

        var ig = document.querySelector('[data-social="instagram"]');
        var fb = document.querySelector('[data-social="facebook"]');
        if (ig && contact.instagram_url) ig.href = contact.instagram_url;
        if (fb && contact.facebook_url) fb.href = contact.facebook_url;
      })
      .catch(function () {
        /* footer still works with default hrefs if content fails to load */
      });
  }

  function includePartial(selector, url, afterInject) {
    var slot = document.querySelector(selector);
    if (!slot) return Promise.resolve();
    return fetch(url)
      .then(function (res) {
        return res.text();
      })
      .then(function (html) {
        slot.outerHTML = html;
        if (afterInject) afterInject();
      });
  }

  /* ---- scroll reveal + count-up, shared across all pages ---- */
  window.Coral.initReveal = function () {
    var revealEls = document.querySelectorAll(".reveal");
    if (!revealEls.length) return;

    if (!("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var counted = new WeakSet();
    var runCounters = function (root) {
      root.querySelectorAll("[data-count]").forEach(function (el) {
        if (counted.has(el)) return;
        counted.add(el);
        var target = parseInt(el.getAttribute("data-count"), 10) || 0;
        var suffix = el.getAttribute("data-suffix") || "";
        var start = performance.now();
        var duration = 1100;
        var step = function (now) {
          var progress = Math.min((now - start) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    };

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            runCounters(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -60px 0px" }
    );

    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  };

  document.addEventListener("DOMContentLoaded", function () {
    Promise.all([
      includePartial("#header-placeholder", "partials/header.html", initHeader),
      includePartial("#footer-placeholder", "partials/footer.html", initFooter)
    ]).then(function () {
      document.dispatchEvent(new CustomEvent("partials:loaded"));
    });

    /* Reveal works on content already in the initial HTML; page scripts
       that render content dynamically call Coral.initReveal() again
       after they inject their markup. */
    window.Coral.initReveal();
  });
})();
