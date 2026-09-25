import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Cloud IDEs (CodeSandbox, etc.) serve this dev server through a
    // dynamically-generated preview hostname; Vite's host check would
    // otherwise reject those requests.
    allowedHosts: true,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/uploads": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
  // Used to serve the production build (`vite preview`) behind a public
  // tunnel -- import.meta.env.DEV is false in this build, so DevSwitcher is
  // already dead-code-eliminated from it. Mirrors the dev proxy above so
  // the same single public origin also reaches the API and uploads.
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/uploads": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
