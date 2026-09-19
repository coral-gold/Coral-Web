(function () {
  "use strict";
  var esc = window.Coral.escapeHTML;

  window.Coral.loadJSON("api/content.php?page=home").then(function (data) {
    var eyebrow = document.getElementById("heroEyebrow");
    var heading = document.getElementById("heroHeading");
    var sub = document.getElementById("heroSub");
    var badgeNum = document.getElementById("heroBadgeNumber");
    var badgeLabel = document.getElementById("heroBadgeLabel");
    var ctaPrimary = document.getElementById("heroCtaPrimary");
    var ctaSecondary = document.getElementById("heroCtaSecondary");

    if (eyebrow) eyebrow.textContent = data.hero_eyebrow;
    if (heading) {
      var words = data.hero_heading.split(" ");
      var mid = Math.floor(words.length / 2);
      heading.innerHTML =
        esc(words.slice(0, mid).join(" ")) + " <em>" + esc(words[mid]) + "</em> " + esc(words.slice(mid + 1).join(" "));
    }
    if (sub) sub.textContent = data.hero_subtext;
    if (badgeNum) badgeNum.textContent = data.hero_badge_number;
    if (badgeLabel) badgeLabel.innerHTML = esc(data.hero_badge_label).replace(" ", "<br />");
    if (ctaPrimary) ctaPrimary.textContent = data.cta_primary_label;
    if (ctaSecondary) ctaSecondary.textContent = data.cta_secondary_label;
  });

  var grid = document.getElementById("featuredGrid");
  if (grid) {
    window.Coral.loadJSON("api/products.php").then(function (products) {
      var featured = products.filter(function (p) { return p.featured; }).slice(0, 4);
      grid.innerHTML = featured
        .map(function (p) {
          return (
            '<figure class="showcase-card reveal">' +
            '<img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" width="900" height="900" loading="lazy" decoding="async" />' +
            "<figcaption>" + esc(p.title) + "</figcaption>" +
            "</figure>"
          );
        })
        .join("");
      window.Coral.initReveal();
    });
  }
})();
