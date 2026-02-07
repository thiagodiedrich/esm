import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
// VITE_HOST = onde escutar (ex.: "::"); VITE_ALLOWED_HOSTS = hosts permitidos (ex.: easytest.simc.com.br)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_PORT) || 8080;
  const host = env.VITE_HOST || "::";
  const extraHosts = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const allowedHosts = ["localhost", "127.0.0.1", ...extraHosts];
  return {
  server: {
    host,
    port,
    allowedHosts,
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
};
});
