import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api/run": { target: "ws://127.0.0.1:7878", ws: true, changeOrigin: true },
      "/api": { target: "http://127.0.0.1:7878", changeOrigin: true },
    },
  },
});
