import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: { global: "globalThis" }, // ExcelJS expects global
  // Remove optimizeDeps.exclude for exceljs when using the UMD/min build
});
