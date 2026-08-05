import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Dev only: in prod the server serves the built app itself
      "/api": "http://localhost:8787",
    },
  },
});
