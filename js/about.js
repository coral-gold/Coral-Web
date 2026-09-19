(function () {
  "use strict";
  var esc = window.Coral.escapeHTML;

  window.Coral.loadJSON("api/content.php?page=about").then(function (data) {
    var eyebrow = document.getElementById("aboutEyebrow");
    var heading = document.getElementById("aboutHeading");
    var story = document.getElementById("aboutStory");
    var mission = document.getElementById("aboutMission");
    var vision = document.getElementById("aboutVision");
    var facilityList = document.getElementById("facilityList");
    var statsWrap = document.getElementById("aboutStats");

    if (eyebrow) eyebrow.textContent = data.hero_eyebrow;
    if (heading) heading.textContent = data.hero_heading;
    if (story) story.textContent = data.story;
    if (mission) mission.textContent = data.mission_draft;
    if (vision) vision.textContent = data.vision_draft;

    if (facilityList) {
      facilityList.innerHTML = data.facility_highlights
        .map(function (item) { return "<li>" + esc(item) + "</li>"; })
        .join("");
    }

    if (statsWrap) {
      statsWrap.innerHTML = data.stats
        .map(function (s) {
          var isNumeric = /^\d+/.test(s.number);
          var digits = (s.number.match(/\d+/) || [""])[0];
          var suffix = s.number.replace(digits, "");
          if (isNumeric) {
            return (
              '<div class="stat"><span class="stat-number" data-count="' + digits + '" data-suffix="' + esc(suffix) + '">0</span>' +
              '<span class="stat-label">' + esc(s.label) + "</span></div>"
            );
          }
          return (
            '<div class="stat"><span class="stat-number">' + esc(s.number) + '</span>' +
            '<span class="stat-label">' + esc(s.label) + "</span></div>"
          );
        })
        .join("");
      window.Coral.initReveal();
    }
  });
})();
