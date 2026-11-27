import process from "node:process";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

const backendTarget = `http://127.0.0.1:${process.env.BACKEND_PORT || 3001}`;

export default defineConfig({
  plugins: [tanstackStart(), viteReact(), tailwindcss(), tsconfigPaths()],
  server: {
    port: 8080,
    host: true,
  },
});
