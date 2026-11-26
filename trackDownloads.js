// trackDownloads.js
// Counts clicks on download links (papers, data files, Dropbox links) in GoatCounter.
//
// Why this is needed: GoatCounter's own script (count.js) only counts *page* views.
// A PDF or CSV can't run a script, so downloads are invisible unless we count the
// click on the link that leads to them.
//
// How it works: instead of tagging every link by hand, we put ONE listener on the
// whole page. Every click bubbles up to it; we check whether the clicked link points
// to a file, and if so send a "download" event to GoatCounter named after the file.
// New files added to the site later are therefore counted automatically.

(function () {
  // File types that count as a download (compared in lowercase).
  var FILE_TYPES = ["pdf", "csv", "dta", "parquet", "7z", "zip", "bib", "xlsx", "xls"];

  // Turn a link into a readable event name, or return null if it isn't a download.
  function downloadName(link) {
    var url;
    try { url = new URL(link.href); } catch (e) { return null; }   // mailto:, broken hrefs, etc.

    var onMySite  = url.hostname === location.hostname;           // e.g. docs/..., sharedData/...
    var onDropbox = /(^|\.)dropbox\.com$/.test(url.hostname);     // GTD and replication files
    if (!onMySite && !onDropbox) return null;                     // other people's sites: ignore

    // Last part of the path = file name. decodeURIComponent turns "%20" back into spaces,
    // so "Felbermayr%20and%20Teti_2023.pdf" is recorded as "Felbermayr and Teti_2023.pdf".
    var file = decodeURIComponent(url.pathname.split("/").pop());
    var ext  = file.includes(".") ? file.split(".").pop().toLowerCase() : "";

    if (FILE_TYPES.includes(ext)) return file;

    // Dropbox *folder* links have no file name in the URL (path ends in ".../h"),
    // so fall back to the link's visible text, e.g. "Dropbox folder: data & code".
    if (onDropbox) return "Dropbox folder: " + link.textContent.trim();

    return null;                                                  // a normal page link
  }

  function handleClick(event) {
    // closest("a") finds the link even if the click landed on an image or text inside it.
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link) return;

    var name = downloadName(link);
    if (!name) return;

    // goatcounter.count exists only once count.js has loaded (and isn't blocked by an
    // ad blocker). If it's missing we simply don't count; the download itself is never affected.
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({
        path:  "download/" + name,   // "download/" prefix groups all downloads together in the dashboard
        title: name,
        event: true                  // tells GoatCounter this is a click event, not a page view
      });
    }
  }

  // "click" = normal left click; "auxclick" = middle click (open in new tab).
  document.addEventListener("click", handleClick);
  document.addEventListener("auxclick", handleClick);
})();
