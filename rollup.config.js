import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";

const staticFileFolders = ["lang", "packs", "templates"];

// The bundled foundry-vtt-types is pinned to V9 (9.269.0) while this system targets
// Foundry v13/v14, so @rollup/plugin-typescript emits a large, benign set of type
// diagnostics (mostly "property does not exist" on game/foundry globals). These are
// inherited from upstream OSE, which builds against the same stale types. Suppress
// only these known noise codes so the build log is usable; ANY other TS code (e.g. a
// real new type error) still surfaces. `npm run typecheck` (tsc --noEmit) remains the
// full, unfiltered type gate. Remove this if/when the foundry types are migrated.
const SUPPRESSED_TS_CODES = new Set([
  "TS2304", "TS2314", "TS2322", "TS2339", "TS2345", "TS2445", "TS2488",
  "TS2531", "TS2532", "TS2538", "TS2551", "TS2554", "TS2571", "TS2578",
  "TS2694", "TS2722", "TS2739", "TS2769", "TS6133", "TS7006", "TS7008",
  "TS7019", "TS7030", "TS7053", "TS18046", "TS18047", "TS18048",
]);

export default {
  input: "src/ose.js",
  output: {
    file: "dist/ose.js",
    format: "es",
    sourcemap: true,
  },
  onwarn(warning, defaultHandler) {
    if (warning.plugin === "typescript" && SUPPRESSED_TS_CODES.has(warning.pluginCode)) {
      return;
    }
    defaultHandler(warning);
  },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      compilerOptions: {
        outDir: "dist",
      },
    }),
    copy({
      targets: staticFileFolders.map((folderName) => ({
        src: `src/${folderName}`,
        dest: "dist",
      })),
    }),
  ],
};
