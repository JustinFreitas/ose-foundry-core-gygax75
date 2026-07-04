import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.spec.ts"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "src/**/*.js"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/e2e/**/*",
        "src/module/__tests__/**/*",
        "test/**/*",
      ],
    },
  },
});
