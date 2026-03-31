/**
 * Wix-HubSpot Lead Capture Form — Embed Script
 *
 * Usage:
 * <script src="https://your-app.com/embed.js" data-instance-id="YOUR_INSTANCE_ID"></script>
 *
 * Optional attributes:
 * - data-instance-id: Your Wix app instance ID (required)
 * - data-theme: "light" or "dark" (default: "light")
 * - data-width: iframe width (default: "100%")
 * - data-height: iframe height (default: "600px")
 */
(function () {
  "use strict";

  // Find the current script tag
  var script =
    document.currentScript ||
    document.querySelector('script[data-instance-id]');

  if (!script) {
    console.error("Wix-HubSpot embed: Could not find script tag");
    return;
  }

  var instanceId = script.getAttribute("data-instance-id");
  var theme = script.getAttribute("data-theme") || "light";
  var width = script.getAttribute("data-width") || "100%";
  var height = script.getAttribute("data-height") || "600px";

  if (!instanceId) {
    console.error("Wix-HubSpot embed: data-instance-id is required");
    return;
  }

  // Determine the app base URL from the script src
  var scriptSrc = script.getAttribute("src");
  var baseUrl = scriptSrc
    ? scriptSrc.replace(/\/embed\.js.*$/, "")
    : window.location.origin;

  // Build the iframe URL
  var iframeUrl =
    baseUrl +
    "/embed/form?instanceId=" +
    encodeURIComponent(instanceId) +
    "&theme=" +
    encodeURIComponent(theme);

  // Create the iframe container
  var container = document.createElement("div");
  container.style.width = width;
  container.style.maxWidth = "500px";
  container.style.margin = "0 auto";

  var iframe = document.createElement("iframe");
  iframe.src = iframeUrl;
  iframe.style.width = "100%";
  iframe.style.height = height;
  iframe.style.border = "none";
  iframe.style.borderRadius = "12px";
  iframe.style.overflow = "hidden";
  iframe.setAttribute("title", "Contact Form");
  iframe.setAttribute("loading", "lazy");

  container.appendChild(iframe);

  // Insert after the script tag
  script.parentNode.insertBefore(container, script.nextSibling);

  // After iframe loads, send UTM data from the parent page
  iframe.addEventListener("load", function () {
    var params = new URLSearchParams(window.location.search);

    iframe.contentWindow.postMessage(
      {
        type: "UTM_DATA",
        utm_source: params.get("utm_source") || "",
        utm_medium: params.get("utm_medium") || "",
        utm_campaign: params.get("utm_campaign") || "",
        utm_term: params.get("utm_term") || "",
        utm_content: params.get("utm_content") || "",
        pageUrl: window.location.href,
        referrer: document.referrer,
      },
      "*"
    );
  });

  // Listen for resize messages from the iframe
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "FORM_RESIZE" && event.data.height) {
      iframe.style.height = event.data.height + "px";
    }
  });
})();
