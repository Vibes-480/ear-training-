import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The notation library is a separate, lazily loaded chunk of about 1 MB.
  build: { chunkSizeWarningLimit: 1100 },
  test: {
    globals: true,
    environment: "node",
  },
});
