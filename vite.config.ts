import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

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
          // Keep React + its ecosystem in ONE chunk to avoid runtime init order issues
          // IMPORTANT: recharts must live in the same chunk as react to avoid
          // "Cannot access 'P' before initialization" TDZ errors caused by
          // cross-chunk circular imports between recharts <-> react-vendor.
          // Bundle React, its ecosystem, recharts, AND @radix-ui all into one
          // chunk. Splitting @radix-ui into its own chunk causes a production
          // circular import with react-vendor, which leaves React's exports
          // (e.g. forwardRef) undefined when radix evaluates first and crashes
          // bootstrap with: "Cannot read properties of undefined (reading 'forwardRef')".
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router") ||
            id.includes("/scheduler/") ||
            id.includes("/@tanstack/react-query") ||
            id.includes("/@supabase/") ||
            id.includes("/@radix-ui/") ||
            id.includes("/recharts") ||
            id.includes("/d3-") ||
            id.includes("/victory-vendor")
          ) {
            return "react-vendor";
          }
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("html-to-image")) return "html-to-image";
          return undefined;
        },
      },
    },
  },
}));
