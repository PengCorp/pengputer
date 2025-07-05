import { resolve } from "path";
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
});
