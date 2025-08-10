import path, { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/computer",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@Toolbox": path.resolve(__dirname, "src/Toolbox"),
      "@Color": path.resolve(__dirname, "src/Color"),
    },
  },
});
