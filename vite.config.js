import path, { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/computer",
  resolve: {
    alias: {
      "@Toolbox": path.resolve(__dirname, "src/Toolbox"),
      "@Color": path.resolve(__dirname, "src/Color"),
      "@FileSystem": path.resolve(__dirname, "src/FileSystem"),
      "@src": path.resolve(__dirname, "src"),
      "@src_test": path.resolve(__dirname, "src_test"),
    },
  },
});
