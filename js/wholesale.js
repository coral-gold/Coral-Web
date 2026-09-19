(function () {
  "use strict";
  var esc = window.Coral.escapeHTML;

  window.Coral.loadJSON("content/pages/wholesale.json").then(function (data) {
    var eyebrow = document.getElementById("wholesaleEyebrow");
    var heading = document.getElementById("wholesaleHeading");
    var intro = document.getElementById("wholesaleIntro");
    var sectionsWrap = document.getElementById("wholesaleSections");
    var cta = document.getElementById("wholesaleCta");

    if (eyebrow) eyebrow.textContent = data.hero_eyebrow;
    if (heading) heading.textContent = data.hero_heading;
    if (intro) intro.textContent = data.intro;
    if (cta) cta.textContent = data.cta_label;

    if (sectionsWrap) {
      sectionsWrap.innerHTML = data.sections
        .map(function (s) {
          return (
            '<div class="wholesale-block reveal">' +
            "<h3>" + esc(s.heading) + "</h3>" +
            "<p>" + esc(s.body) + "</p>" +
            "</div>"
          );
        })
        .join("");
      window.Coral.initReveal();
    }
  });
})();
