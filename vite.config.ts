import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    ViteImageOptimizer({
      png: { quality: 60 },
      jpeg: { quality: 60 },
      webp: { quality: 35 },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    include: ["@tanstack/react-query"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router")) return "react-vendor";
          if (id.includes("/react-dom/") || id.includes("/react/")) return "react-vendor";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("@tanstack/react-query") || id.includes("@supabase/")) return "query";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("html-to-image")) return "html-to-image";
          if (id.includes("recharts")) return "charts";
          return undefined;
        },
      },
    },
  },
}));
