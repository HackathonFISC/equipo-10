import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const webRoot = fileURLToPath(new URL(".", import.meta.url));
const outDir = fileURLToPath(new URL("../../dist/web", import.meta.url));

export default defineConfig({
  root: webRoot,
  envDir: webRoot,
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    cors: false,
  },
  build: {
    outDir,
    emptyOutDir: true,
  },
});
