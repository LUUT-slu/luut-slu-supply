import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Clear stale lazy-chunk reload sentinel so a once-broken session can recover
try {
  sessionStorage.removeItem("chunk_reload");
} catch {
  /* ignore */
}

// Production boot diagnostics — surface bootstrap-time failures clearly so
// future publish regressions are immediately identifiable on the live domain.
if (typeof window !== "undefined") {
  console.info("[boot] main.tsx evaluating");
  window.addEventListener("error", (e) => {
    console.error("[boot] uncaught error:", e.message, e.error);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("[boot] unhandled promise rejection:", e.reason);
  });
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  console.error("[boot] #root element missing");
} else {
  try {
    createRoot(rootEl).render(<App />);
    console.info("[boot] React mounted");
  } catch (err) {
    console.error("[boot] React mount failed:", err);
  }
}
