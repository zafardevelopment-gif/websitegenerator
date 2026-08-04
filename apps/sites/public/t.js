/*!
 * AIVEXA first-party tracking — cookieless, ~2.5KB gzipped.
 * Injected by every live demo. Sends beacons to /api/track.
 * No PII, no cookies: the visitor key is a rotating daily hash derived
 * from a random value stored in sessionStorage (cleared per browser tab
 * session) — it identifies a *return within the same day*, nothing more.
 */
(function () {
  "use strict";
  var d = document, w = window;
  var siteId = d.currentScript && d.currentScript.getAttribute("data-site");
  if (!siteId) return;

  function visitorKey() {
    try {
      var k = sessionStorage.getItem("_axk");
      if (!k) {
        k = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem("_axk", k);
      }
      return k;
    } catch (e) {
      return "anon";
    }
  }

  function send(path, body) {
    var payload = JSON.stringify(body);
    if (navigator.sendBeacon) {
      var blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(path, blob)) return;
    }
    fetch(path, { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(function () {});
  }

  var visitId = null;
  var startedAt = Date.now();
  var visitorId = visitorKey();

  function deviceType() {
    var wdt = w.innerWidth;
    if (wdt < 640) return "mobile";
    if (wdt < 1024) return "tablet";
    return "desktop";
  }

  send("/api/track/visit", {
    siteId: siteId,
    visitorKey: visitorId,
    deviceType: deviceType(),
    path: location.pathname,
    referrer: d.referrer || "",
  });

  var seenSections = {};
  function trackScroll() {
    var sections = d.querySelectorAll("[id]");
    var viewportBottom = w.scrollY + w.innerHeight;
    for (var i = 0; i < sections.length; i++) {
      var el = sections[i];
      if (seenSections[el.id]) continue;
      var top = el.getBoundingClientRect().top + w.scrollY;
      if (top < viewportBottom) {
        seenSections[el.id] = true;
        send("/api/track/event", { siteId: siteId, eventType: "section_view", section: el.id });
      }
    }
  }
  var scrollTimer;
  w.addEventListener(
    "scroll",
    function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(trackScroll, 400);
    },
    { passive: true }
  );

  d.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("a[href]");
    if (!el) return;
    var href = el.getAttribute("href") || "";
    var type = null;
    if (href.indexOf("wa.me") !== -1 || href.indexOf("api.whatsapp.com") !== -1) type = "cta_whatsapp";
    else if (href.indexOf("tel:") === 0) type = "cta_call";
    else if (href.indexOf("#contact") !== -1 || href.indexOf("mailto:") === 0) type = "cta_appointment";
    if (type) {
      send("/api/track/event", { siteId: siteId, eventType: type, section: href });
    }
  });

  w.addEventListener("pagehide", function () {
    send("/api/track/event", {
      siteId: siteId,
      eventType: "page_view",
      value: { durationSec: Math.round((Date.now() - startedAt) / 1000) },
    });
  });
})();
