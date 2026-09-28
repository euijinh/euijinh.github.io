/* Shows the static Figure A until the interactive frame reports its height.
   Reduced-motion readers keep the still until they open the figure. */
(function () {
  "use strict";

  var root = document.getElementById("ak-momentum-figure-a");
  if (!root || root.getAttribute("data-ak-ready") === "true") return;
  root.setAttribute("data-ak-ready", "true");

  var base = (root.getAttribute("data-asset-base") || "").replace(/\/$/, "");
  var frame = root.querySelector(".ak-figure-a__frame");
  var still = root.querySelector(".ak-figure-a__still");
  var openBtn = root.querySelector(".ak-figure-a__open");
  if (!base || !frame || !still) return;

  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var shownHeight = 0;
  var revealed = false;

  function applyHeight(height) {
    var next = Math.ceil(height) + 8;
    if (shownHeight && Math.abs(next - shownHeight) <= 12) return;
    shownHeight = next;
    frame.style.height = next + "px";
    if (revealed) return;
    revealed = true;
    root.classList.add("is-live");
    still.setAttribute("hidden", "");
    frame.removeAttribute("aria-hidden");
    frame.removeAttribute("tabindex");
    if (openBtn) openBtn.setAttribute("hidden", "");
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== window.location.origin) return;
    if (!frame.contentWindow || event.source !== frame.contentWindow) return;
    var data = event.data;
    if (!data || data.type !== "ak-figure-a-resize") return;
    var height = Number(data.height);
    if (!isFinite(height) || height < 80 || height > 6000) return;
    applyHeight(height);
  });

  function load() {
    if (frame.getAttribute("src")) return;
    frame.setAttribute("src", base + "/ak-momentum-figure-a.html");
  }

  if (reduceQuery.matches) {
    if (!openBtn) return;
    openBtn.removeAttribute("hidden");
    openBtn.addEventListener("click", function () {
      openBtn.textContent = "Opening the interactive figure…";
      openBtn.setAttribute("aria-busy", "true");
      load();
    });
    return;
  }

  if (!("IntersectionObserver" in window)) {
    load();
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    var visible = false;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) visible = true;
    }
    if (!visible) return;
    observer.disconnect();
    load();
  }, { rootMargin: "240px 0px", threshold: 0.01 });
  observer.observe(root);
})();
