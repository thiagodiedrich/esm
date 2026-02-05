import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
// HOST e PORT do dev server vêm do .env (VITE_DEV_HOST, VITE_DEV_PORT)
export default defineConfig(({ mode }) => ({
  server: {
    host: process.env.VITE_DEV_HOST ?? "::",
    port: Number(process.env.VITE_DEV_PORT) || 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
