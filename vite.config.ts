import { defineConfig } from "vite";

// For GitHub Pages: set VITE_BASE="/<repo>/" if needed (e.g. in Actions).
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
});

