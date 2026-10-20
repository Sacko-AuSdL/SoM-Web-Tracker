import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, isPreview }) => ({
  // Keep the development URL/port unchanged; production lives in a project site.
  base: command === "serve" && !isPreview ? "/" : "/SoM-Web-Tracker/",
  plugins: [react()],
}));
