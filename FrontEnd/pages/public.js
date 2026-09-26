import "../components/site-header.js";
import "../components/hero-section.js";
import "../components/booking-section.js";
import "../components/cancellation-section.js";
import "../components/services-section.js";
import "../components/process-section.js";
import "../components/site-footer.js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("../sw.js", import.meta.url).href).catch(() => {
      // Service worker is optional; the app keeps working without it.
    });
  });
}