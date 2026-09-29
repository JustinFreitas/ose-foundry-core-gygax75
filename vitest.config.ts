import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.spec.ts", "src/**/*.unit.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "src/**/*.js"],
      exclude: [
        "src/ose.js",
        "src/module/config.js",
        "src/module/config.ts",
        "src/types/**/*",
        "test/**/*",
      ],
    },
  },
});
