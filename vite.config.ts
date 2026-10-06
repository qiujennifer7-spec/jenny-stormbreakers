import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ["three"], react: ["react", "react-dom"] },
      },
    },
  },
  server: {
    port: 5417,
    strictPort: true,
    proxy: {
      "/ws": { target: "ws://127.0.0.1:3417", ws: true },
      "/health": "http://127.0.0.1:3417",
    },
  },
});
