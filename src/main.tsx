import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Clear stale lazy-chunk reload sentinel so a once-broken session can recover
try {
  sessionStorage.removeItem("chunk_reload");
} catch {
  /* ignore */
}

createRoot(document.getElementById("root")!).render(<App />);
