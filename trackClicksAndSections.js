// trackClicksAndSections.js
// Sends three kinds of events to GoatCounter, on top of the normal page views:
//   1. download/<file>          a click on a paper or data file (site files + Dropbox)
//   2. section/<page>/<id>      a visitor scrolled to (or jumped to) a section, e.g. Working Papers
//   3. abstract/<paper>, media/<paper>   a visitor opened a paper's abstract or media list
//
// Why this is needed: GoatCounter's own script (count.js) only counts *page* views.
// Downloads, scrolling within a page and opening an abstract never load a new page,
// so they are invisible unless we report them ourselves.
//
// Nothing here is tagged by hand: new files, sections and papers that follow the same
// HTML structure as the existing ones are counted automatically.

(function () {

  // ---------------------------------------------------------------------------
  // Shared helper: send one event to GoatCounter.
  // goatcounter.count exists only once count.js has loaded (and isn't blocked by an
  // ad blocker). If it's missing we simply don't count; the page itself is never affected.
  // count.js also respects the "don't count me" marker (#toggle-goatcounter) for events.
  // ---------------------------------------------------------------------------
  function send(name) {
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path: name, title: name, event: true });
    }
  }

  // Short page name used in section events: "/" -> "home", "/data.html" -> "data".
  var PAGE = location.pathname.replace(/^.*\//, "").replace(/\.html$/, "") || "home";
  if (PAGE === "index") PAGE = "home";


  // ---------------------------------------------------------------------------
  // 1. Downloads
  // ---------------------------------------------------------------------------
  var FILE_TYPES = ["pdf", "csv", "dta", "parquet", "7z", "zip", "bib", "xlsx", "xls"];

  // Turn a link into a readable event name, or return null if it isn't a download.
  function downloadName(link) {
    var url;
    try { url = new URL(link.href); } catch (e) { return null; }   // mailto:, javascript:, broken hrefs

    var onMySite  = url.hostname === location.hostname;           // e.g. docs/..., sharedData/...
    var onDropbox = /(^|\.)dropbox\.com$/.test(url.hostname);     // GTD and replication files
    if (!onMySite && !onDropbox) return null;                     // other people's sites: ignore

    // Last part of the path = file name. decodeURIComponent turns "%20" back into spaces,
    // so "Felbermayr%20and%20Teti_2023.pdf" is recorded as "Felbermayr and Teti_2023.pdf".
    var file = decodeURIComponent(url.pathname.split("/").pop());
    var ext  = file.includes(".") ? file.split(".").pop().toLowerCase() : "";

    if (FILE_TYPES.includes(ext)) return "download/" + file;

    // Dropbox *folder* links have no file name in the URL (path ends in ".../h"),
    // so fall back to the link's visible text, e.g. "Dropbox folder: data & code".
    if (onDropbox) return "download/Dropbox folder: " + link.textContent.trim();

    return null;                                                  // a normal page link
  }

  function handleDownloadClick(event) {
    // closest("a") finds the link even if the click landed on an image or text inside it.
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link) return;
    var name = downloadName(link);
    if (name) send(name);
  }

  // "click" = normal left click; "auxclick" = middle click (open in new tab).
  document.addEventListener("click", handleDownloadClick);
  document.addEventListener("auxclick", handleDownloadClick);


  // ---------------------------------------------------------------------------
  // 2. Sections reached
  // A section counts as "reached" once the visitor has scrolled (or jumped, e.g. via the
  // "Research" menu link) far enough that its heading is in the top 40% of the screen
  // or above it. Each section is counted at most once per page load.
  //
  // Why "top 40%" and only after scrolling: on a large monitor the Working Papers heading
  // is already visible at ~57% of the screen when the page opens. Counting mere visibility
  // would credit every desktop visitor with "reached Research" without them moving.
  // Why "or above it": a fast scroll or a jump can carry a heading straight past the
  // zone; it was still passed, so it counts.
  //
  // Only sections with an id AND a heading (h2.section-title) are tracked, which skips
  // the About section at the top of the home page (every visitor sees it anyway).
  // ---------------------------------------------------------------------------
  var pending = Array.prototype.slice.call(document.querySelectorAll("section[id] h2.section-title"));
  var checkQueued = false;

  function checkSections() {
    checkQueued = false;
    var line = window.innerHeight * 0.4;                       // 40% down from the top of the screen
    pending = pending.filter(function (heading) {
      if (heading.getBoundingClientRect().top > line) return true;   // not reached yet: keep watching
      send("section/" + PAGE + "/" + heading.closest("section").id);
      return false;                                                  // counted: stop watching
    });
    if (!pending.length) window.removeEventListener("scroll", onScroll);   // all done
  }

  // Scroll events fire dozens of times per second; requestAnimationFrame bundles them
  // so the check runs at most once per screen refresh (cheap, no effect on smoothness).
  function onScroll() {
    if (!checkQueued) { checkQueued = true; window.requestAnimationFrame(checkSections); }
  }

  if (pending.length) window.addEventListener("scroll", onScroll, { passive: true });


  // ---------------------------------------------------------------------------
  // 3. Abstracts and media lists opened
  // The toggle links look like:  <a class="toggle-abstract" onclick="toggleAbstract('MissingTariffs')">
  // Media panels have the same id plus "Media", e.g. 'MissingTariffsMedia'.
  //
  // We listen in the *capture* phase (the `true` below), which runs BEFORE the page's own
  // toggleAbstract(). At that moment the panel still shows its old state, so
  // "not active yet" means this click is OPENING it. Closing clicks aren't counted.
  // ---------------------------------------------------------------------------
  document.addEventListener("click", function (event) {
    var toggle = event.target.closest && event.target.closest("a.toggle-abstract");
    if (!toggle) return;

    // Pull the panel id out of onclick="toggleAbstract('MissingTariffsMedia')".
    var match = /toggleAbstract\('([^']+)'\)/.exec(toggle.getAttribute("onclick") || "");
    if (!match) return;
    var id    = match[1];
    var panel = document.getElementById(id);
    if (!panel || panel.classList.contains("active")) return;   // already open -> this click closes it

    // "MissingTariffsMedia" -> media/MissingTariffs ; "MissingTariffs" -> abstract/MissingTariffs
    var isMedia = /Media$/.test(id);
    send((isMedia ? "media/" : "abstract/") + id.replace(/Media$/, ""));
  }, true);

})();
